-- Requires canonical POS size inventory and the website order schema.
begin;

create table public.excel_catalogue_imports (
  workbook_sha256 text not null check (workbook_sha256 ~ '^[a-f0-9]{64}$'),
  sheet_name text not null,
  source_row integer not null check (source_row > 0),
  product_id uuid not null references public.products(id),
  approved_product jsonb not null,
  application_id uuid not null,
  applied_at timestamptz not null default now(),
  primary key (workbook_sha256, sheet_name, source_row)
);
alter table public.excel_catalogue_imports enable row level security;
revoke all on public.excel_catalogue_imports from public, anon, authenticated;
revoke all on public.excel_catalogue_imports from service_role;
grant select on public.excel_catalogue_imports to service_role;

-- A committed plan and its immutable variant balance snapshots. Source rows
-- are carried as an array so continuation rows never multiply stock totals.
create table public.excel_catalogue_batches (
  batch_id text primary key check (batch_id ~ '^[a-f0-9]{64}$'),
  workbook_sha256 text not null check (workbook_sha256 ~ '^[a-f0-9]{64}$'),
  plan_digest text not null,
  recorded_at timestamptz not null default clock_timestamp()
);
create table public.excel_catalogue_batch_audit (
  batch_id text not null references public.excel_catalogue_batches(batch_id),
  application_id uuid not null,
  product_id uuid not null,
  product_code text not null,
  source_rows jsonb not null,
  action text not null check (action in ('create','link','reconcile')),
  outcome text not null check (outcome in ('IMPORTED','SKIPPED')),
  variants jsonb not null,
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (batch_id, application_id)
);
create unique index excel_catalogue_applied_variant_snapshot
  on public.excel_catalogue_batch_audit(application_id) where outcome = 'IMPORTED';
alter table public.excel_catalogue_batches enable row level security;
alter table public.excel_catalogue_batch_audit enable row level security;
revoke all on public.excel_catalogue_batches, public.excel_catalogue_batch_audit
  from public, anon, authenticated, service_role;
grant select on public.excel_catalogue_batches, public.excel_catalogue_batch_audit to service_role;

-- Build the audit from the final variant UUIDs, the approved quantities and
-- the movements written by this application, including explicit zero balances.
create function public.catalogue_import_variant_audit(
  p_entry jsonb, p_product_id uuid, p_application_id uuid
) returns jsonb language sql set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'color_id', c.id, 'colour', c.color_name, 'size_id', s.id,
    'size_system', s.size_system, 'size_label', s.size_label,
    'approved_quantity', (q.variant->>'quantity')::integer,
    'approved_delta', case p_entry->>'action'
      when 'create' then (q.variant->>'quantity')::integer
      when 'link' then 0
      else (q.variant->>'quantity')::integer - (q.variant->>'expected_quantity')::integer end,
    'committed_quantity', coalesce(s.stock_quantity, c.stock_quantity),
    'stock_quantity_applied', movement.delta
  ) order by c.id, s.id), '[]'::jsonb)
  from jsonb_array_elements(p_entry->'colours') v(colour)
  join public.product_colors c on c.product_id = p_product_id and c.color_name = v.colour->>'name'
  cross join lateral jsonb_array_elements(case when p_entry->>'size_system' is null
    then jsonb_build_array(v.colour) else v.colour->'sizes' end) q(variant)
  left join public.product_color_sizes s on s.color_id = c.id
    and s.size_system = p_entry->>'size_system' and s.size_label = q.variant->>'label'
  cross join lateral (
    select coalesce(sum(m.delta), 0) as delta from public.stock_movements m
    where m.reference_uuid = p_application_id and m.reason = 'excel_catalogue_import'
      and m.product_id = p_product_id and m.color_id = c.id and m.size_id is not distinct from s.id
  ) movement
  where p_entry->>'size_system' is null or s.id is not null;
$$;
revoke all on function public.catalogue_import_variant_audit(jsonb,uuid,uuid)
  from public, anon, authenticated, service_role;

-- Detect normalized collisions before installing this constraint in staging.
create unique index products_normalized_catalogue_code
  on public.products (lower(btrim(barcode))) where barcode is not null;

-- Called only by the importer with the parent product and colour locked.
create function public.catalogue_import_set_stock(
  p_product_id uuid, p_color_id uuid, p_size_id uuid, p_quantity integer, p_application_id uuid
) returns void language plpgsql set search_path = '' as $$
declare
  v_size public.product_color_sizes%rowtype;
  v_before integer;
  v_after integer;
  v_delta integer;
begin
  if p_quantity is null or p_quantity not between 0 and 100000 then
    raise exception 'invalid_catalogue_quantity';
  end if;
  if p_size_id is null then
    select c.stock_quantity into strict v_before from public.product_colors c
      where c.id = p_color_id and c.product_id = p_product_id;
  else
    select * into strict v_size from public.product_color_sizes s
      where s.id = p_size_id and s.color_id = p_color_id and not s.archived;
    v_before := v_size.stock_quantity;
  end if;
  v_delta := p_quantity - v_before;
  if v_delta = 0 then return; end if;
  v_after := public.pos_change_variant_stock(p_product_id, p_color_id, p_size_id, v_delta, false);
  if v_after is distinct from p_quantity then raise exception 'catalogue_stock_change_failed'; end if;
  insert into public.stock_movements (
    product_id, color_id, size_id, size_system, size_label, delta, quantity_after, reason, reference_uuid
  ) values (
    p_product_id, p_color_id, v_size.id, v_size.size_system, v_size.size_label,
    v_delta, v_after, 'excel_catalogue_import', p_application_id
  );
end;
$$;
revoke all on function public.catalogue_import_set_stock(uuid,uuid,uuid,integer,uuid)
  from public, anon, authenticated, service_role;

create function public.apply_excel_catalogue(p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  digest text := p_plan->>'workbook_sha256';
  batch_key text := p_plan->>'batch_id';
  fingerprint text := encode(sha256(convert_to(p_plan::text, 'UTF8')), 'hex');
  entry_audit jsonb;
  source_refs jsonb;
  audit_count integer;
  entry jsonb;
  source jsonb;
  colour jsonb;
  size jsonb;
  target public.products%rowtype;
  matches integer;
  retained integer;
  colour_id uuid;
  variant_id uuid;
  application_id uuid;
  sort integer;
  quantity_field text;
  reconciles boolean;
  reconciled_count integer := 0;
  created_count integer := 0;
  linked_count integer := 0;
  replay_count integer := 0;
begin
  if batch_key is null or batch_key !~ '^[a-f0-9]{64}$'
     or digest is null or digest !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_plan->'products') is distinct from 'array'
     or jsonb_array_length(p_plan->'products') = 0 then
    raise exception 'invalid_catalogue_plan';
  end if;
  -- Opening-stock import is a maintenance operation. Lock products first,
  -- matching website/POS stock operations, and serialize all import claims.
  lock table public.products in exclusive mode;

  insert into public.excel_catalogue_batches (batch_id, workbook_sha256, plan_digest)
  values (batch_key, digest, fingerprint) on conflict (batch_id) do nothing;
  if not exists (select 1 from public.excel_catalogue_batches b
    where b.batch_id = batch_key and b.plan_digest = fingerprint) then
    raise exception 'catalogue_batch_payload_mismatch';
  end if;

  for entry in select value from jsonb_array_elements(p_plan->'products') loop
    if jsonb_typeof(entry->'source_rows') is distinct from 'array'
       or jsonb_array_length(entry->'source_rows') = 0
       or entry->>'action' is null or entry->>'action' not in ('create','link','reconcile')
       or coalesce(btrim(entry->>'code'), '') = ''
       or coalesce((entry->>'base_price')::integer, 0) <= 0
       or jsonb_typeof(entry->'colours') is distinct from 'array'
       or jsonb_array_length(entry->'colours') not between 1 and 8 then
      raise exception 'invalid_catalogue_plan';
    end if;

    select jsonb_agg(jsonb_build_object('sheet', r->>'sheet', 'row', (r->>'row')::integer)
      order by r->>'sheet', (r->>'row')::integer)
    into source_refs from jsonb_array_elements(entry->'source_rows') r;

    select count(*)::integer, count(*) filter (where i.approved_product = entry)::integer
      into matches, retained
    from public.excel_catalogue_imports i
    join jsonb_array_elements(entry->'source_rows') r
      on i.sheet_name = r->>'sheet' and i.source_row = (r->>'row')::integer
    where i.workbook_sha256 = digest;
    if matches > 0 then
      if retained <> jsonb_array_length(entry->'source_rows') then
        raise exception 'catalogue_source_rows_already_claimed';
      end if;
      -- Preserve an exact batch replay's original receipt. For a different
      -- batch claiming the same rows, record a skip with the original IDs.
      insert into public.excel_catalogue_batch_audit
        (batch_id, application_id, product_id, product_code, source_rows, action, outcome, variants)
      select batch_key, i.application_id, i.product_id, entry->>'code', source_refs,
        entry->>'action', 'SKIPPED', coalesce((
          select jsonb_agg(jsonb_build_object('color_id', v->'color_id', 'size_id', v->'size_id',
            'colour', v->'colour', 'size_system', v->'size_system', 'size_label', v->'size_label',
            'approved_quantity', v->'approved_quantity', 'approved_delta', 0,
            'committed_quantity', null, 'stock_quantity_applied', 0))
          from public.excel_catalogue_batch_audit a cross join lateral jsonb_array_elements(a.variants) v
          where a.application_id = i.application_id and a.outcome = 'IMPORTED'
        ), '[]'::jsonb)
      from public.excel_catalogue_imports i
      where i.workbook_sha256 = digest and i.sheet_name = entry->'source_rows'->0->>'sheet'
        and i.source_row = (entry->'source_rows'->0->>'row')::integer
      on conflict on constraint excel_catalogue_batch_audit_pkey do nothing;
      replay_count := replay_count + 1;
      continue;
    end if;

    if not exists (select 1 from public.categories c
      where c.id = (entry->>'category_id')::uuid and c.is_active) then
      raise exception 'catalogue_category_unavailable';
    end if;

    application_id := gen_random_uuid();
    reconciles := entry->>'action' = 'reconcile';
    quantity_field := case when reconciles then 'expected_quantity' else 'quantity' end;
    if reconciles and ((entry->>'stock_cutoff')::timestamptz is null or
                       coalesce(btrim(entry->>'evidence'), '') = '') then
      raise exception 'catalogue_reconciliation_requires_approval';
    end if;

    if entry->>'action' = 'create' then
      if exists (select 1 from public.products p
        where lower(btrim(p.barcode)) = lower(btrim(entry->>'code')) or p.slug = entry->>'slug'
          or (lower(btrim(p.name)) = lower(btrim(entry->>'name'))
              and not coalesce((entry->>'allow_same_name')::boolean, false))) then
        raise exception 'catalogue_possible_existing_product';
      end if;
      insert into public.products (
        name, slug, description, category, category_id, barcode, base_price,
        active, is_website_published, publish_to_pos, stock_tracking_mode
      ) values (
        entry->>'name', entry->>'slug', entry->>'description', entry->>'category',
        (entry->>'category_id')::uuid, entry->>'code', (entry->>'base_price')::integer,
        false, false, false, case when entry->>'category' = 'shoe' then 'size' else 'color' end
      ) returning * into target;

      sort := 0;
      for colour in select value from jsonb_array_elements(entry->'colours') loop
        insert into public.product_colors (product_id, color_name, color_hex, sort_order, stock_quantity)
        values (target.id, colour->>'name', colour->>'hex', sort,
          0)
        returning id into colour_id;
        if target.stock_tracking_mode = 'size' then
          for size in select value from jsonb_array_elements(colour->'sizes') loop
            insert into public.product_color_sizes (color_id, size_system, size_label)
            values (colour_id, entry->>'size_system', size->>'label') returning id into variant_id;
            perform public.catalogue_import_set_stock(target.id, colour_id, variant_id,
              (size->>'quantity')::integer, application_id);
          end loop;
          if not exists (select 1 from public.product_colors c where c.id = colour_id
                         and c.stock_quantity = (colour->>'quantity')::integer) then
            raise exception 'catalogue_size_total_mismatch';
          end if;
        else
          perform public.catalogue_import_set_stock(target.id, colour_id, null,
            (colour->>'quantity')::integer, application_id);
        end if;
        sort := sort + 1;
      end loop;
      created_count := created_count + 1;
    else
      select * into target from public.products p where p.id = (entry->>'product_id')::uuid for update;
      if not found or (target.name, target.slug, target.category, target.category_id, target.base_price, target.stock_tracking_mode)
         is distinct from (entry->>'name', entry->>'slug', entry->>'category',
           (entry->>'category_id')::uuid, (entry->>'base_price')::integer, case when entry->>'category' = 'shoe' then 'size' else 'color' end)
         or (target.barcode is not null and lower(btrim(target.barcode)) <> lower(btrim(entry->>'code'))) then
        raise exception 'catalogue_existing_product_mismatch';
      end if;
      perform c.id from public.product_colors c where c.product_id = target.id order by c.id for update;
      for colour in select value from jsonb_array_elements(entry->'colours') loop
        select c.id into colour_id from public.product_colors c where c.product_id = target.id
          and c.color_name = colour->>'name' and c.stock_quantity = (colour->>quantity_field)::integer;
        if not found then raise exception 'catalogue_existing_stock_mismatch'; end if;
        if target.stock_tracking_mode = 'size' and exists (
          (select s.size_label, s.stock_quantity from public.product_color_sizes s
           where s.color_id = colour_id and not s.archived and s.size_system = entry->>'size_system'
           except select v->>'label', (v->>quantity_field)::integer from jsonb_array_elements(colour->'sizes') v)
          union all
          (select v->>'label', (v->>quantity_field)::integer from jsonb_array_elements(colour->'sizes') v
           except select s.size_label, s.stock_quantity from public.product_color_sizes s
           where s.color_id = colour_id and not s.archived and s.size_system = entry->>'size_system')
        ) then raise exception 'catalogue_existing_stock_mismatch'; end if;
        if target.stock_tracking_mode = 'size' and exists (select 1 from public.product_color_sizes s
            where s.color_id = colour_id and (s.archived or s.size_system <> entry->>'size_system')) then
          raise exception 'catalogue_existing_stock_mismatch';
        end if;
      end loop;
      if (select count(*) from public.product_colors c where c.product_id = target.id)
           <> jsonb_array_length(entry->'colours') then
        raise exception 'catalogue_existing_stock_mismatch';
      end if;
      if reconciles then
        for colour in select value from jsonb_array_elements(entry->'colours') loop
          select c.id into colour_id from public.product_colors c
            where c.product_id = target.id and c.color_name = colour->>'name';
          if target.stock_tracking_mode = 'size' then
            for size in select value from jsonb_array_elements(colour->'sizes') loop
              select s.id into strict variant_id from public.product_color_sizes s
              where s.color_id = colour_id and not s.archived
                and s.size_system = entry->>'size_system' and s.size_label = size->>'label';
              perform public.catalogue_import_set_stock(target.id, colour_id, variant_id,
                (size->>'quantity')::integer, application_id);
            end loop;
            if not exists (select 1 from public.product_colors c where c.id = colour_id
                           and c.stock_quantity = (colour->>'quantity')::integer) then
              raise exception 'catalogue_size_total_mismatch';
            end if;
          else
            perform public.catalogue_import_set_stock(target.id, colour_id, null,
              (colour->>'quantity')::integer, application_id);
          end if;
        end loop;
        reconciled_count := reconciled_count + 1;
      else
        linked_count := linked_count + 1;
      end if;

      -- An approved match may fill a missing code. Keep merchandising and photos.
      if target.barcode is null then
        update public.products set barcode = entry->>'code' where id = target.id;
      end if;
    end if;

    entry_audit := public.catalogue_import_variant_audit(entry, target.id, application_id);
    select sum(case when entry->>'size_system' is null then 1 else jsonb_array_length(c->'sizes') end)
      into audit_count from jsonb_array_elements(entry->'colours') c;
    if jsonb_array_length(entry_audit) <> audit_count then
      raise exception 'catalogue_import_incomplete_audit';
    end if;
    if exists (select 1 from jsonb_array_elements(entry_audit) v
      where v->'approved_quantity' is distinct from v->'committed_quantity'
         or v->'approved_delta' is distinct from v->'stock_quantity_applied') then
      raise exception 'catalogue_import_stock_audit_mismatch';
    end if;
    insert into public.excel_catalogue_batch_audit
      (batch_id, application_id, product_id, product_code, source_rows, action, outcome, variants)
    values (batch_key, application_id, target.id, entry->>'code', source_refs,
      entry->>'action', 'IMPORTED', entry_audit);

    for source in select value from jsonb_array_elements(entry->'source_rows') loop
      insert into public.excel_catalogue_imports (workbook_sha256, sheet_name, source_row, product_id, approved_product, application_id)
      values (digest, source->>'sheet', (source->>'row')::integer, target.id, entry, application_id);
    end loop;
  end loop;
  return jsonb_build_object('created', created_count, 'linked', linked_count, 'reconciled', reconciled_count, 'replayed', replay_count);
end;
$$;
revoke all on function public.apply_excel_catalogue(jsonb) from public, anon, authenticated;
grant execute on function public.apply_excel_catalogue(jsonb) to service_role;

commit;
