/*
  # Auth Settings Update
  
  This migration must run outside a transaction block to update system-wide auth settings.
  
  Changes:
  - Set OTP expiry to 1 hour
  - Enable leaked password protection
*/

-- Set transaction handling
\set ON_ERROR_STOP on
\set AUTOCOMMIT on

-- Update auth settings
ALTER SYSTEM SET auth.otp_expiry_seconds = 3600;
ALTER SYSTEM SET auth.enable_leaked_password_protection = true;