-- Public catalogue clients use explicit product fields.
begin;
revoke select on table public.products from anon;
grant select (
  id, name, slug, description, category, category_id, base_price, base_price_usd,
  discount_percent, featured, created_at, active, is_website_published
) on table public.products to anon;

do $$
begin
  if exists (
    select from pg_attribute where attrelid = 'public.products'::regclass
      and attname = 'stock_tracking_mode' and attnum > 0 and not attisdropped
  ) then
    grant select (stock_tracking_mode) on table public.products to anon;
  end if;
end;
$$;

create policy "Anonymous catalogue reads published active products"
  on public.products as restrictive for select to anon
  using (active and is_website_published);

commit;
