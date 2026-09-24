-- TrackInstall: Installer/Admin account activation support
-- Run once against the existing trackinstall_db database.

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS activation_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_activation_token_hash
  ON users(activation_token_hash);