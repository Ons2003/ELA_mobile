/*
  # Setup Admin User Account

  1. Admin User Setup
    - Creates admin user account with email elyesaccademylift@gmail.com
    - Sets up profile with admin role
    - Ensures proper authentication setup

  2. Security
    - Admin role assignment
    - Proper user creation with auth
*/

-- First, check if user already exists and delete if needed (for clean setup)
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Try to find existing user
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'elyesaccademylift@gmail.com';
    
    -- If user exists, delete them first for clean setup
    IF admin_user_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = admin_user_id;
    END IF;
END $$;

-- Create the admin user account
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'elyesaccademylift@gmail.com',
    crypt('admin123', gen_salt('bf')), -- Password: admin123
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"first_name": "Elyes", "last_name": "Admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- Create the admin profile
INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    experience_level,
    created_at,
    updated_at
) 
SELECT 
    id,
    'elyesaccademylift@gmail.com',
    'Elyes',
    'Admin',
    'admin',
    'advanced',
    NOW(),
    NOW()
FROM auth.users 
WHERE email = 'elyesaccademylift@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    first_name = 'Elyes',
    last_name = 'Admin',
    updated_at = NOW();

-- Create trigger function to ensure admin role is maintained
CREATE OR REPLACE FUNCTION ensure_admin_role()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is the admin email, ensure admin role
    IF NEW.email = 'elyesaccademylift@gmail.com' THEN
        NEW.role = 'admin';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain admin role
DROP TRIGGER IF EXISTS ensure_admin_role_trigger ON profiles;
CREATE TRIGGER ensure_admin_role_trigger
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_admin_role();