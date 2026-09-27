-- Add SUPER_ADMIN role
ALTER TYPE user_role
ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Promote the existing primary admin
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE phone_number = '9000000001';