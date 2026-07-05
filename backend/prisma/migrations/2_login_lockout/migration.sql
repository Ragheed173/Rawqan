-- Per-account brute-force lockout (H3): track failed logins and lock window.
ALTER TABLE "admins" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admins" ADD COLUMN "locked_until" TIMESTAMP(3);
