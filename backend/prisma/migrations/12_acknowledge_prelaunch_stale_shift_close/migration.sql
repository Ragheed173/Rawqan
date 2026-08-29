-- The final pre-launch cleanup intentionally removed all trial cashier shifts
-- and sync history. One close operation survived only in device IndexedDB and
-- was re-submitted after that cleanup, so its referenced shift can no longer
-- exist on the server. Acknowledge only that exact failed operation; current
-- shifts, invoices, payments, and every other queued operation are untouched.
UPDATE "sync_operations"
SET
  "status" = 'SUCCEEDED',
  "result" = '{"acknowledged":true,"reason":"prelaunch_trial_data_cleanup"}'::jsonb,
  "error_code" = NULL,
  "error_message" = NULL,
  "processed_at" = CURRENT_TIMESTAMP
WHERE "operation_id" = '4414bbeb-c4e2-4b39-ae1a-d88e9f175f79'::uuid
  AND "operation_type" = 'CLOSE_SHIFT'
  AND "status" = 'FAILED'
  AND "error_code" = 'SHIFT_NOT_OPEN';
