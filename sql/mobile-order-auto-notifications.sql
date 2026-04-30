alter table mobile_order_notifications
  drop constraint if exists chk_mobile_order_notifications_type;

alter table mobile_order_notifications
  drop constraint if exists mobile_order_notifications_notification_type_check;

alter table mobile_order_notifications
  add constraint chk_mobile_order_notifications_type
  check (notification_type in ('order_completed', 'order_preparing', 'order_ready'));
