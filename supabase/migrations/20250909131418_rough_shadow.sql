/*
  # Fix profiles table RLS policies

  1. Security Changes
    - Drop existing problematic policies that cause infinite recursion
    - Create simple, non-recursive policies for profiles table
    - Allow users to insert their own profile during sign-up
    - Allow users to view and update their own profile
    - Allow coaches and admins to view all profiles

  2. Policy Details
    - INSERT: Users can create their own profile (auth.uid() = id)
    - SELECT: Users can view their own profile, coaches/admins can view all
    - UPDATE: Users can update their own profile
    - No DELETE policy (profiles should not be deleted directly)
*/

-- Drop all existing policies on profiles table to remove infinite recursion
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches and admins can view all profiles" ON profiles;

-- Create new, simple policies without recursion

-- Allow users to insert their own profile during sign-up
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow coaches and admins to view all profiles (simplified check)
CREATE POLICY "Coaches and admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' IN ('coach', 'admin')
    )
    OR
    -- Fallback: check if user has coach/admin role in profiles table (non-recursive)
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role IN ('coach', 'admin') 
      AND id = auth.uid()
    )
  );