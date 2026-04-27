alter table mobile_order_notifications
  drop constraint if exists mobile_order_notifications_notification_type_check;

alter table mobile_order_notifications
  add constraint mobile_order_notifications_notification_type_check
  check (notification_type in ('order_completed', 'order_preparing', 'order_ready'));
