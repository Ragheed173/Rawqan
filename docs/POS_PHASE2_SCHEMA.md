# POS Phase 2 — Database Foundation

This phase is schema-only. It adds no POS routes, command handlers, frontend,
Dexie database, sync endpoint, reporting engine, or print transport.

## Models

The migration adds 26 UUID-backed models:

- Device/room: `PosDevice`, `DiningTable`
- Orders: `Order`, `OrderTableAssignment`, `OrderItem`,
  `OrderItemModifier`, `OrderDiscount`
- Modifier catalog: `ModifierGroup`, `ModifierOption`,
  `MenuItemModifierGroup`
- Finance: `Invoice`, `InvoiceOrder`, `InvoiceTableSnapshot`, `InvoiceLine`,
  `InvoiceLineModifier`, `InvoiceDiscount`, `Payment`, `InvoiceVoid`, `Refund`,
  `RefundLine`, `RefundPayment`
- Operations: `Reservation`, `ReservationTable`, `CashierShift`,
  `ReceiptPrintEvent`, `SyncOperation`

Legacy `Admin`, menu, settings, audit, and analytics primary keys remain CUIDs.
Existing `MenuItem.price` and `discountPrice` remain `Decimal(10,2)`. Every POS
financial amount is a `BigInt` minor-unit field. Modifier catalog prices remain
Decimal at the existing catalog boundary and are snapshotted to minor units on
orders/invoices.

## Enums

- `DiningTableStatus`: `AVAILABLE`, `OCCUPIED`, `RESERVED`,
  `BILL_REQUESTED`, `DISABLED`
- `OrderStatus`: `OPEN`, `BILL_REQUESTED`, `PARTIALLY_BILLED`, `CLOSED`,
  `CANCELLED`, `MERGED`
- `ModifierGroupType`: `VARIANT`, `ADD_ON`
- `ModifierPriceType`: `DELTA`, `REPLACEMENT`
- `InvoiceStatus`: `OPEN`, `PAID`, `VOIDED`, `PARTIALLY_REFUNDED`, `REFUNDED`
- `DiscountType`: `PERCENTAGE`, `FIXED`
- `PaymentMethod`: `CASH`, `VISA`
- `PaymentStatus`: `COMPLETED`, `VOIDED`, `REFUNDED`
- `ReservationStatus`: `PENDING`, `CONFIRMED`, `SEATED`, `COMPLETED`,
  `CANCELLED`, `NO_SHOW`
- `CashierShiftStatus`: `OPEN`, `CLOSED`
- `ReceiptPrintType`: `INITIAL`, `REPRINT`
- `SyncOperationStatus`: `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`,
  `CONFLICT`

## Uniqueness and indexes

Primary keys exist on the UUID identity of every new table; `SyncOperation`
uses `operation_id` as its UUID primary key.

Unique indexes:

- `pos_devices_code_key`, `dining_tables_code_key`,
  `invoices_invoice_number_key`, `invoice_voids_invoice_id_key`
- `menu_item_modifier_groups_menu_item_id_group_id_key`
- `invoice_orders_invoice_id_order_id_key`
- `refund_lines_refund_id_invoice_line_id_key`
- `refund_payments_refund_id_payment_id_key`
- `reservation_tables_reservation_id_table_id_key`
- `sync_operations_device_id_local_sequence_key`
- Raw partial indexes: `order_table_assignments_one_active_table_key`,
  `order_table_assignments_one_active_primary_key`,
  `cashier_shifts_one_open_user_device_key`

Lookup/report indexes:

- Device/table: `pos_devices_is_active_idx`,
  `dining_tables_status_is_active_idx`,
  `dining_tables_is_active_sort_order_idx`
- Orders: `orders_status_business_date_idx`,
  `orders_business_date_opened_at_idx`, `orders_device_id_status_idx`,
  `orders_opened_by_id_opened_at_idx`, `orders_merged_into_order_id_idx`,
  `order_table_assignments_order_id_released_at_idx`,
  `order_table_assignments_table_id_released_at_idx`,
  `order_table_assignments_assigned_by_id_idx`,
  `order_table_assignments_released_by_id_idx`,
  `order_items_order_id_sort_order_idx`, `order_items_menu_item_id_idx`,
  `order_item_modifiers_order_item_id_idx`,
  `order_item_modifiers_modifier_option_id_idx`,
  `order_discounts_order_id_created_at_idx`, `order_discounts_actor_id_idx`
- Catalog: `modifier_groups_is_active_sort_order_idx`,
  `modifier_groups_type_is_active_idx`,
  `modifier_options_group_id_is_active_sort_order_idx`,
  `menu_item_modifier_groups_group_id_idx`
- Invoices: `invoices_status_business_date_idx`,
  `invoices_business_date_issued_at_idx`, `invoices_device_id_issued_at_idx`,
  `invoices_cashier_id_issued_at_idx`, `invoice_orders_order_id_idx`,
  `invoice_table_snapshots_invoice_id_idx`,
  `invoice_table_snapshots_table_id_idx`,
  `invoice_lines_invoice_id_sort_order_idx`,
  `invoice_lines_order_item_id_idx`, `invoice_lines_menu_item_id_idx`,
  `invoice_line_modifiers_invoice_line_id_idx`,
  `invoice_line_modifiers_modifier_option_id_idx`,
  `invoice_discounts_invoice_id_created_at_idx`,
  `invoice_discounts_actor_id_idx`
- Payments/refunds: `payments_invoice_id_paid_at_idx`, `payments_paid_at_idx`,
  `payments_device_id_paid_at_idx`, `payments_actor_id_idx`,
  `invoice_voids_actor_id_idx`, `invoice_voids_device_id_created_at_idx`,
  `invoice_voids_operation_id_idx`, `refunds_invoice_id_refunded_at_idx`,
  `refunds_refunded_at_idx`, `refunds_device_id_refunded_at_idx`,
  `refunds_actor_id_idx`, `refunds_operation_id_idx`,
  `refund_lines_invoice_line_id_idx`, `refund_payments_payment_id_idx`
- Reservations/shifts: `reservations_status_starts_at_idx`,
  `reservations_starts_at_idx`, `reservations_phone_idx`,
  `reservations_created_by_id_idx`, `reservation_tables_table_id_idx`,
  `cashier_shifts_user_id_device_id_status_idx`,
  `cashier_shifts_business_date_status_idx`,
  `cashier_shifts_device_id_opened_at_idx`
- Print/sync: `receipt_print_events_invoice_id_created_at_idx`,
  `receipt_print_events_device_id_created_at_idx`,
  `receipt_print_events_actor_id_idx`,
  `sync_operations_device_id_status_local_sequence_idx`,
  `sync_operations_status_created_at_idx`

## Raw PostgreSQL constraints

Prisma cannot express these checks/partial indexes, so the migration adds them
explicitly:

Exact check names:

- Device/table: `pos_devices_code_nonempty_check`,
  `pos_devices_name_nonempty_check`, `dining_tables_code_nonempty_check`,
  `dining_tables_capacity_positive_check`,
  `dining_tables_disabled_state_check`
- Orders: `orders_version_positive_check`,
  `orders_guest_count_positive_check`, `orders_merge_target_check`,
  `orders_closed_state_check`, `orders_closed_after_opened_check`,
  `order_table_assignments_release_check`,
  `order_table_assignments_release_time_check`,
  `order_items_quantity_positive_check`,
  `order_items_money_nonnegative_check`,
  `order_item_modifiers_quantity_positive_check`,
  `order_item_modifiers_money_nonnegative_check`,
  `order_discounts_reason_nonempty_check`,
  `order_discounts_amount_nonnegative_check`,
  `order_discounts_requested_value_check`
- Modifiers: `modifier_groups_selection_range_check`,
  `modifier_groups_required_selection_check`,
  `modifier_options_price_nonnegative_check`
- Invoices/payments/refunds: `invoices_currency_check`,
  `invoices_money_check`, `invoices_paid_state_check`,
  `invoice_lines_quantity_positive_check`, `invoice_lines_money_check`,
  `invoice_line_modifiers_quantity_positive_check`,
  `invoice_line_modifiers_money_nonnegative_check`,
  `invoice_discounts_reason_nonempty_check`,
  `invoice_discounts_amount_nonnegative_check`,
  `invoice_discounts_requested_value_check`,
  `payments_amount_positive_check`, `payments_cash_tender_check`,
  `invoice_voids_reason_nonempty_check`, `refunds_amount_positive_check`,
  `refunds_reason_nonempty_check`, `refund_lines_values_positive_check`,
  `refund_payments_amount_positive_check`
- Reservations/shifts: `reservations_guest_count_positive_check`,
  `reservations_version_positive_check`, `reservations_time_range_check`,
  `cashier_shifts_money_nonnegative_check`,
  `cashier_shifts_state_check`, `cashier_shifts_close_time_check`
- Print/sync: `receipt_print_events_paper_width_positive_check`,
  `sync_operations_sequence_nonnegative_check`,
  `sync_operations_request_hash_nonempty_check`,
  `sync_operations_type_nonempty_check`,
  `sync_operations_processed_state_check`

- Non-empty device/table codes and device name; positive optional table capacity
- `DiningTable.isActive` is true exactly when status is not `DISABLED`
- Positive optimistic versions and guest counts; valid order merge/closed states
- Consistent assignment release snapshots/timestamps
- Positive line/modifier quantities and non-negative monetary snapshots
- Percentage discounts use 0–10,000 basis points and no fixed value; fixed
  discounts use a non-negative minor-unit value and no percentage value
- Valid modifier selection ranges; required groups select at least one option;
  catalog modifier prices cannot be negative
- Invoice arithmetic: `total = subtotal - discount`, refund bounds, ILS/NIS
  currency, and paid/refunded statuses require `paidAt`
- Cash tender arithmetic: `tendered = amount + change`; VISA has no tender/change
- Non-empty void/refund/discount reasons and positive refund allocations
- Positive reservation guests/version and valid optional end time
- Shift money/state/close-time consistency
- Positive receipt width
- Non-negative sync sequence, non-empty hash/type, and processed timestamp/state
  consistency

The three partial unique indexes enforce one currently assigned order per table,
one current primary table per order, and one open shift per cashier/device pair.

## Delete and immutability decisions

`SET NULL` preserves public/admin compatibility when a mutable legacy record is
physically removed; every such relation has the required immutable snapshot:

- Admin links: order opener, table assign/release actors, order/invoice discount
  actors, invoice cashier, payment/void/refund actors, reservation creator,
  cashier-shift user, and receipt-print actor
- Menu/catalog links: order-item and invoice-line `MenuItem`, order/invoice line
  `ModifierOption`
  `RESTRICT` protects operational/financial identity and parent-child history:

- `PosDevice` from orders, invoices, payments, voids, refunds, shifts, print
  events, and sync operations
- `DiningTable` from active/history assignments, invoice table snapshots, and
  reservations
- Order merge targets; order assignments/items/discounts/invoice links from
  their order; invoice lines from referenced order items
- Modifier options from their group
- Invoice orders/table snapshots/lines/discounts/payments/voids/refunds/print
  events from their invoice
- Invoice-line modifiers/refund lines from invoice lines; refund allocations
  from refunds/payments
- Reservation-table rows from reservations and tables

`CASCADE` is limited to the non-financial catalog attachment
`MenuItemModifierGroup`: deleting a legacy menu item or an otherwise-unreferenced
modifier group removes only that join row. Historical order/invoice snapshots
never cascade.

Database triggers prohibit physical deletion of `orders`, `invoices`,
`payments`, and `cashier_shifts`. Append-only triggers prohibit update/delete on
`order_discounts`, `invoice_orders`, `invoice_table_snapshots`, `invoice_lines`,
`invoice_line_modifiers`, `invoice_discounts`, `invoice_voids`, `refunds`,
`refund_lines`, `refund_payments`, and `receipt_print_events`.

The append-only trigger permits exactly one compatibility exception: a nullable
`actorId`, `menuItemId`, or `modifierOptionId` may transition from its old value
to null during `ON DELETE SET NULL`. The trigger compares every other column and
rejects the update if any snapshot/fact changes, so legacy admin/menu deletion
does not become a hidden breaking change.

## Deferred questions and behavior

- Invoice-number allocation for `RWQ-P01-YYYY-######` remains deliberately
  unimplemented. The schema only reserves a unique `invoiceNumber`.
- `ModifierPriceType.REPLACEMENT` records the intent; command logic must define
  whether a replacement applies to the base item or a selected variant before
  modifier endpoints are built.
- Aggregate arithmetic across invoice lines, payments, refunds, and shift totals
  remains transactional domain logic. Row-local obvious-invalid values are the
  only values rejected by checks.
- Modifier services and catalog revision events are deferred because this phase
  adds no mutation services.
- `ActivityLog.operationId/deviceId` remain intentionally loose context values,
  avoiding brittle foreign keys while future financial commands write audit rows
  in the same transaction.

The development seed idempotently provisions device code `P01` as `Main POS`.
Production pairing/activation remains a later phase.
