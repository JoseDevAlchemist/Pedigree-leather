-- Install after catalogue-sized-stock.review.sql and the canonical POS size migration.
begin;

-- Provider confirmations can still record money received after cancellation.
-- The fulfilment status stays terminal even if a writer read an older status.
create function public.website_keep_order_cancelled() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'cancelled' then
    new.status := 'cancelled';
  elsif new.status = 'cancelled' and current_user <> (
    select pg_get_userbyid(proowner) from pg_proc
    where oid = to_regprocedure('public.website_cancel_order(uuid,text,text,text)')
  ) then
    raise exception 'website_use_cancel_order' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger website_keep_order_cancelled before update of status on public.orders
for each row execute function public.website_keep_order_cancelled();
revoke all on function public.website_keep_order_cancelled() from public, anon, authenticated;

create function public.website_cancel_order(
  p_order_id uuid, p_actor_email text, p_actor_role text, p_note text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  saved public.orders%rowtype;
  movement record;
  balance integer;
begin
  if p_actor_email is null or btrim(p_actor_email) = '' or p_actor_role is null
     or p_actor_role not in ('owner', 'worker') then
    raise exception 'website_cancel_unauthorized' using errcode = '42501';
  end if;

  select * into saved from public.orders where id = p_order_id for update;
  if not found then raise exception 'website_cancel_order_not_found' using errcode = 'P0002'; end if;
  if saved.status = 'cancelled' then return false; end if;
  if saved.status not in ('pending_payment', 'paid', 'preparing', 'ready_for_delivery')
     or (p_actor_role = 'worker' and saved.status not in ('pending_payment', 'paid')) then
    raise exception 'website_cancel_ineligible' using errcode = '23514';
  end if;

  -- Only committed website deductions are evidence that stock was reserved.
  -- The order lock serializes cancellations and the entire release is atomic.
  if saved.website_request_id is not null and not exists (
    select 1 from public.stock_movements m
    where m.reference_uuid = saved.website_request_id and m.reason = 'website_order_cancelled'
  ) then
    perform p.id from public.products p where p.id in (
      select m.product_id from public.stock_movements m
      where m.reference_uuid = saved.website_request_id and m.reason = 'website_order' and m.delta < 0
    ) order by p.id for update;
    perform c.id from public.product_colors c where c.id in (
      select m.color_id from public.stock_movements m
      where m.reference_uuid = saved.website_request_id and m.reason = 'website_order' and m.delta < 0
    ) order by c.id for update;

    for movement in
      select m.product_id, m.color_id, m.size_id, m.size_system, m.size_label, -m.delta as quantity
      from public.stock_movements m
      where m.reference_uuid = saved.website_request_id and m.reason = 'website_order' and m.delta < 0
      order by m.product_id, m.color_id, m.size_id, m.id
    loop
      balance := public.pos_change_variant_stock(
        movement.product_id, movement.color_id, movement.size_id, movement.quantity, true
      );
      if balance is null then raise exception 'website_cancel_stock_unavailable'; end if;
      insert into public.stock_movements (
        product_id, color_id, size_id, size_system, size_label, delta, quantity_after, reason, reference_uuid
      ) values (
        movement.product_id, movement.color_id, movement.size_id, movement.size_system, movement.size_label,
        movement.quantity, balance, 'website_order_cancelled', saved.website_request_id
      );
    end loop;
  end if;

  update public.orders set status = 'cancelled' where id = saved.id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by_email, note)
  values (saved.id, saved.status, 'cancelled', p_actor_email, nullif(btrim(p_note), ''));
  return true;
end;
$$;
revoke all on function public.website_cancel_order(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.website_cancel_order(uuid,text,text,text) to service_role;

-- The exact size of a colour-only reservation is unknown. Finish or cancel
-- open website orders before converting their product to size-level stock.
create function public.website_guard_reserved_stock_mode() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.stock_tracking_mode = 'color' and new.stock_tracking_mode = 'size' and exists (
    select 1 from public.stock_movements m
    join public.orders o on o.website_request_id = m.reference_uuid
    where m.product_id = old.id and m.size_id is null and m.reason = 'website_order' and m.delta < 0
      and o.status in ('pending_payment', 'paid', 'preparing', 'ready_for_delivery')
  ) then
    raise exception 'website_open_colour_reservation' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger website_guard_reserved_stock_mode before update of stock_tracking_mode on public.products
for each row execute function public.website_guard_reserved_stock_mode();
revoke all on function public.website_guard_reserved_stock_mode() from public, anon, authenticated;

commit;
