-- ============================================================
-- クリダス モバイルオーダー RLS 修正
-- 既に mobile-order-foundation.sql を流した環境向け
-- ============================================================

-- 既存の anon 全許可ポリシーは残したまま、
-- 管理画面用に authenticated 向けポリシーを追加する

do $$ begin
  create policy "authenticated_own_rows" on vendor_stores
  for all to authenticated
  using (auth.uid() = vendor_user_id)
  with check (auth.uid() = vendor_user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on store_order_pages
  for all to authenticated
  using (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on store_order_schedules
  for all to authenticated
  using (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on mobile_order_products
  for all to authenticated
  using (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_schedule_inventory_access" on store_order_schedule_inventories
  for all to authenticated
  using (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_inventory_adjustment_access" on mobile_order_inventory_adjustments
  for all to authenticated
  using (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on mobile_order_option_groups
  for all to authenticated
  using (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_option_group_access" on mobile_order_option_choices
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_order_option_groups oog
      join vendor_stores vs on vs.id = oog.store_id
      where oog.id = group_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_order_option_groups oog
      join vendor_stores vs on vs.id = oog.store_id
      where oog.id = group_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_product_option_link_access" on mobile_order_product_option_groups
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_order_products p
      join vendor_stores vs on vs.id = p.store_id
      where p.id = product_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_order_products p
      join vendor_stores vs on vs.id = p.store_id
      where p.id = product_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_mobile_order_access" on mobile_orders
  for all to authenticated
  using (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from vendor_stores vs
      where vs.id = store_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_order_item_access" on mobile_order_items
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_order_item_option_access" on mobile_order_item_option_choices
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_order_items oi
      join mobile_orders mo on mo.id = oi.order_id
      join vendor_stores vs on vs.id = mo.store_id
      where oi.id = order_item_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_order_items oi
      join mobile_orders mo on mo.id = oi.order_id
      join vendor_stores vs on vs.id = mo.store_id
      where oi.id = order_item_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_notification_access" on mobile_order_notifications
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_audit_log_access" on mobile_order_audit_logs
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
