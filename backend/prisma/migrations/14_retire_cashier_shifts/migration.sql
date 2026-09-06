-- Cashier shifts were removed from the single-register POS workflow.
-- Preserve historical rows for audit, but close any row left open and retire
-- old queued shift commands so they cannot remain in a retry loop.
UPDATE "cashier_shifts"
SET
  "status" = 'CLOSED',
  "actual_closing_cash_minor" = "expected_cash_minor",
  "difference_minor" = 0,
  "closed_at" = COALESCE("closed_at", NOW())
WHERE "status" = 'OPEN';

UPDATE "sync_operations"
SET
  "status" = 'SUCCEEDED',
  "result" = '{"disabled":true,"reason":"SHIFT_FEATURE_RETIRED"}'::jsonb,
  "error_code" = NULL,
  "error_message" = NULL,
  "processed_at" = NOW()
WHERE
  "operation_type" IN ('OPEN_SHIFT', 'CLOSE_SHIFT')
  AND "status" <> 'SUCCEEDED';
