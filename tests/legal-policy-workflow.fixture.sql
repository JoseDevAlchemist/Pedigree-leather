\set ON_ERROR_STOP on
-- Run only against a fresh disposable PostgreSQL database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.admin_users(email text PRIMARY KEY, role text NOT NULL);
INSERT INTO public.admin_users VALUES ('owner@fixture.test','owner'), ('worker@fixture.test','worker');
GRANT SELECT ON public.admin_users TO service_role;
\ir ../supabase/migrations/023_legal_pages.sql
GRANT SELECT ON public.legal_pages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.legal_pages TO service_role;
\ir ../supabase/migrations/027_legal_policy_workflow.sql

DO $$
BEGIN
  IF has_table_privilege('anon','public.legal_policy_revisions','SELECT') OR
     has_table_privilege('authenticated','public.legal_policy_revisions','SELECT') OR
     has_table_privilege('authenticated','public.legal_pages','UPDATE') OR
     has_function_privilege('authenticated','public.save_legal_policy(text,text,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Policy authorization grants are too broad';
  END IF;
END;
$$;

SET ROLE service_role;
DO $$
DECLARE
  owner_email constant text := 'owner@fixture.test';
  state jsonb;
  revision_id text;
  policy_slug text;
BEGIN
  FOR policy_slug IN SELECT unnest(ARRAY['terms','returns','delivery','cancellation','privacy']) LOOP
    state := public.read_legal_policy_editor(owner_email, policy_slug);
    IF state IS NULL OR state->>'published' IS NOT NULL THEN RAISE EXCEPTION 'Expected file fallback'; END IF;
    IF public.read_legal_policy_editor('worker@fixture.test',policy_slug) IS NOT NULL THEN
      RAISE EXCEPTION 'Worker can read policy state';
    END IF;
    BEGIN
      PERFORM public.save_legal_policy('worker@fixture.test',policy_slug,'Title','publish',NULL,'Worker','Baseline');
      RAISE EXCEPTION 'Worker published';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    state := public.save_legal_policy(owner_email,policy_slug,'Title','draft',NULL,'Private draft','Baseline');
    IF state->>'draft' IS DISTINCT FROM 'Private draft' OR EXISTS(
      SELECT FROM public.legal_pages WHERE slug=policy_slug AND published_at IS NOT NULL
    ) THEN RAISE EXCEPTION 'Draft was not isolated'; END IF;

    revision_id := state->>'revision';
    state := public.save_legal_policy(owner_email,policy_slug,'Title','publish',revision_id,'Published one','Baseline');
    IF state->>'published' IS DISTINCT FROM 'Published one' OR state->>'draft' IS NOT NULL OR
       state->>'publishedBy' IS DISTINCT FROM owner_email OR state->>'publishedAt' IS NULL THEN
      RAISE EXCEPTION 'Publication state invalid';
    END IF;
    BEGIN
      PERFORM public.save_legal_policy(owner_email,policy_slug,'Title','publish',revision_id,'Stale','Baseline');
      RAISE EXCEPTION 'Stale publication succeeded';
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;

    revision_id := state->>'revision';
    state := public.save_legal_policy(owner_email,policy_slug,'Title','draft',revision_id,'Private second draft','Baseline');
    IF (SELECT content FROM public.legal_pages WHERE slug=policy_slug) IS DISTINCT FROM 'Published one' THEN
      RAISE EXCEPTION 'Draft changed the current publication';
    END IF;
    revision_id := state->>'revision';
    state := public.save_legal_policy(owner_email,policy_slug,'Title','publish',revision_id,'Published two','Baseline');
    revision_id := state->>'revision';
    state := public.save_legal_policy(owner_email,policy_slug,'Title','restore',revision_id,NULL,'Baseline');
    IF state->>'published' IS DISTINCT FROM 'Published one' OR NOT EXISTS(
      SELECT FROM public.legal_policy_revisions
      WHERE slug=policy_slug AND action='restore' AND actor=owner_email AND created_at IS NOT NULL
    ) THEN RAISE EXCEPTION 'Restore or audit failed'; END IF;
  END LOOP;
END;
$$;
RESET ROLE;
