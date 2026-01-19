/*
  # Create admin user for Elyes Academy

  1. Admin User Setup
    - Create admin profile for elyesaccademylift@gmail.com
    - Set role to 'admin'
    - Configure full admin permissions

  2. Security
    - Ensure admin has access to all admin functions
    - Maintain existing RLS policies for admin role
*/

-- Insert admin profile (will be linked when user signs up)
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  role,
  experience_level,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'elyesaccademylift@gmail.com',
  'Elyes',
  'Zerai',
  'admin',
  'advanced',
  now(),
  now()
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  first_name = 'Elyes',
  last_name = 'Zerai',
  experience_level = 'advanced',
  updated_at = now();

-- Create a function to automatically set admin role for this specific email
CREATE OR REPLACE FUNCTION handle_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the admin email
  IF NEW.email = 'elyesaccademylift@gmail.com' THEN
    -- Update or insert profile with admin role
    INSERT INTO profiles (
      id,
      email,
      first_name,
      last_name,
      role,
      experience_level
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Elyes'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Zerai'),
      'admin',
      'advanced'
    ) ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      email = NEW.email,
      first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', profiles.first_name, 'Elyes'),
      last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', profiles.last_name, 'Zerai'),
      experience_level = 'advanced',
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically handle admin user setup
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_admin_user();

-- Ensure existing admin policies work correctly
-- Update any existing profile for this email to admin role
UPDATE profiles 
SET 
  role = 'admin',
  first_name = 'Elyes',
  last_name = 'Zerai',
  experience_level = 'advanced',
  updated_at = now()
WHERE email = 'elyesaccademylift@gmail.com';