BEGIN;

-- Existing legal rows remain intact. Only workflow publications override the approved files.
ALTER TABLE public.legal_pages ADD COLUMN published_at timestamptz;
REVOKE INSERT, UPDATE, DELETE ON public.legal_pages FROM PUBLIC, anon, authenticated;

CREATE TABLE public.legal_policy_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL CHECK (slug IN ('terms','returns','delivery','cancellation','privacy')),
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 30000),
  action text NOT NULL CHECK (action IN ('baseline','draft','publish','restore')),
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX legal_policy_revisions_slug_id_idx ON public.legal_policy_revisions(slug, id DESC);
ALTER TABLE public.legal_policy_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legal_policy_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.legal_policy_revisions TO service_role;
GRANT USAGE ON SEQUENCE public.legal_policy_revisions_id_seq TO service_role;

CREATE FUNCTION public.read_legal_policy_editor(p_actor text, p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'revision', latest.id::text,
    'draft', CASE WHEN latest.action = 'draft' THEN latest.content END,
    'published', CASE WHEN page.published_at IS NOT NULL THEN page.content END,
    'publishedAt', page.published_at,
    'publishedBy', (
      SELECT actor FROM public.legal_policy_revisions WHERE slug = p_slug AND action IN ('publish','restore')
      ORDER BY id DESC LIMIT 1
    ),
    'canRestore', EXISTS (SELECT FROM (
      SELECT id FROM public.legal_policy_revisions
      WHERE slug = p_slug AND action IN ('baseline','publish','restore')
      ORDER BY id DESC OFFSET 1 LIMIT 1
    ) AS previous)
  )
  FROM (SELECT p_slug AS slug) AS target
  LEFT JOIN public.legal_pages AS page USING (slug)
  LEFT JOIN LATERAL (
    SELECT id, action, content FROM public.legal_policy_revisions
    WHERE slug = p_slug ORDER BY id DESC LIMIT 1
  ) AS latest ON true
  WHERE p_slug IN ('terms','returns','delivery','cancellation','privacy')
    AND EXISTS (SELECT FROM public.admin_users WHERE email = p_actor AND role = 'owner');
$$;

CREATE FUNCTION public.save_legal_policy(
  p_actor text, p_slug text, p_title text, p_action text, p_revision text,
  p_content text, p_baseline text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  latest_id text;
  next_content text := p_content;
BEGIN
  IF NOT EXISTS (SELECT FROM public.admin_users WHERE email = p_actor AND role = 'owner') THEN
    RAISE EXCEPTION 'legal_owner_required' USING ERRCODE = '42501';
  END IF;
  IF p_slug IS NULL OR p_slug NOT IN ('terms','returns','delivery','cancellation','privacy')
     OR p_action IS NULL OR p_action NOT IN ('draft','publish','restore') THEN
    RAISE EXCEPTION 'invalid_legal_request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pedigree_legal_policy'), hashtext(p_slug));
  SELECT revision.id::text INTO latest_id FROM public.legal_policy_revisions AS revision
  WHERE revision.slug = p_slug ORDER BY revision.id DESC LIMIT 1;
  IF latest_id IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'legal_policy_stale' USING ERRCODE = '40001';
  END IF;

  IF p_action = 'restore' THEN
    SELECT content INTO next_content FROM public.legal_policy_revisions
    WHERE slug = p_slug AND action IN ('baseline','publish','restore')
    ORDER BY id DESC OFFSET 1 LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'legal_previous_version_missing' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF coalesce(length(btrim(next_content)), 0) NOT BETWEEN 1 AND 30000 THEN
    RAISE EXCEPTION 'invalid_legal_content' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'publish' AND NOT EXISTS (
    SELECT FROM public.legal_policy_revisions WHERE slug = p_slug AND action IN ('publish','restore')
  ) THEN
    INSERT INTO public.legal_policy_revisions(slug, content, action, actor)
    VALUES (p_slug, p_baseline, 'baseline', p_actor);
  END IF;

  INSERT INTO public.legal_policy_revisions(slug, content, action, actor)
    VALUES (p_slug, next_content, p_action, p_actor);

  IF p_action IN ('publish','restore') THEN
    INSERT INTO public.legal_pages(slug, title, content, updated_at, published_at)
      VALUES (p_slug, p_title, next_content, clock_timestamp(), clock_timestamp())
    ON CONFLICT (slug) DO UPDATE SET title = excluded.title, content = excluded.content,
      updated_at = excluded.updated_at, published_at = excluded.published_at;
  END IF;

  RETURN public.read_legal_policy_editor(p_actor, p_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.read_legal_policy_editor(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_legal_policy(text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_legal_policy_editor(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_legal_policy(text,text,text,text,text,text,text) TO service_role;

COMMIT;
