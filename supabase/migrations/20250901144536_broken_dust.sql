/*
  # Initial Database Schema for Elyes Lift Academy

  1. New Tables
    - `profiles` - User profile information extending Supabase auth.users
    - `programs` - Training programs offered by the academy
    - `program_enrollments` - User enrollments in programs
    - `workouts` - Individual workout sessions
    - `workout_exercises` - Exercises within each workout
    - `exercise_sets` - Individual sets for each exercise
    - `strength_assessments` - User strength assessment results
    - `coach_feedback` - Feedback from coaches to users
    - `progress_photos` - User progress photos
    - `notifications` - System notifications for users
    - `payment_records` - Payment transaction records

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Add policies for admin/coach access

  3. Functions and Triggers
    - Auto-create profile on user signup
    - Update timestamps automatically
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'coach', 'admin');
CREATE TYPE program_level AS ENUM ('beginner', 'intermediate', 'advanced', 'all_levels');
CREATE TYPE program_type AS ENUM ('powerlifting', 'olympic_weightlifting', 'general_fitness', 'mobility', 'competition_prep');
CREATE TYPE enrollment_status AS ENUM ('pending', 'active', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE notification_type AS ENUM ('workout_reminder', 'coach_feedback', 'program_update', 'payment', 'achievement');

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  phone text,
  date_of_birth date,
  location text,
  bio text,
  role user_role DEFAULT 'user',
  experience_level program_level DEFAULT 'beginner',
  bodyweight numeric(5,2),
  height numeric(5,2),
  units text DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  description text,
  program_type program_type NOT NULL,
  level program_level NOT NULL,
  duration_weeks integer NOT NULL,
  price numeric(10,2) NOT NULL,
  currency text DEFAULT 'TND',
  image_url text,
  features text[] DEFAULT '{}',
  is_popular boolean DEFAULT false,
  is_active boolean DEFAULT true,
  max_participants integer,
  current_participants integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Program enrollments
CREATE TABLE IF NOT EXISTS program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  status enrollment_status DEFAULT 'pending',
  enrolled_at timestamptz DEFAULT now(),
  start_date date,
  end_date date,
  progress_percentage numeric(5,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- Strength assessments
CREATE TABLE IF NOT EXISTS strength_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  squat_max numeric(6,2),
  bench_max numeric(6,2),
  deadlift_max numeric(6,2),
  overhead_press_max numeric(6,2),
  bodyweight_at_assessment numeric(5,2),
  assessment_date date DEFAULT CURRENT_DATE,
  goals text[],
  limitations text,
  overall_level text,
  recommended_programs uuid[],
  created_at timestamptz DEFAULT now()
);

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  workout_date date DEFAULT CURRENT_DATE,
  duration_minutes integer,
  is_completed boolean DEFAULT false,
  coach_notes text,
  user_notes text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workout exercises
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  exercise_type text, -- 'squat', 'bench', 'deadlift', 'accessory', etc.
  order_in_workout integer NOT NULL,
  target_sets integer,
  target_reps text, -- Can be ranges like "8-10" or specific like "5"
  target_weight numeric(6,2),
  target_rpe numeric(3,1), -- Rate of Perceived Exertion
  rest_seconds integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Exercise sets
CREATE TABLE IF NOT EXISTS exercise_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number integer NOT NULL,
  weight numeric(6,2),
  reps integer,
  rpe numeric(3,1),
  is_completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Coach feedback
CREATE TABLE IF NOT EXISTS coach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id uuid REFERENCES workouts(id) ON DELETE SET NULL,
  feedback_text text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Progress photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_type text DEFAULT 'progress', -- 'progress', 'form_check', 'before', 'after'
  bodyweight numeric(5,2),
  notes text,
  taken_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL,
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);

-- Payment records
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'TND',
  status payment_status DEFAULT 'pending',
  payment_method text,
  transaction_id text,
  payment_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Coaches and admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Anyone can view active programs"
  ON programs FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Coaches and admins can manage programs"
  ON programs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Users can view own enrollments"
  ON program_enrollments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own enrollments"
  ON program_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches and admins can view all enrollments"
  ON program_enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches and admins can update enrollments"
  ON program_enrollments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Users can view own assessments"
  ON strength_assessments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own assessments"
  ON strength_assessments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches and admins can view all assessments"
  ON strength_assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Users can view own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Coaches and admins can view all workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Users can view own workout exercises"
  ON workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own workout exercises"
  ON workout_exercises FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own exercise sets"
  ON exercise_sets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workouts ON workouts.id = workout_exercises.workout_id
      WHERE workout_exercises.id = exercise_sets.workout_exercise_id
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own exercise sets"
  ON exercise_sets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workouts ON workouts.id = workout_exercises.workout_id
      WHERE workout_exercises.id = exercise_sets.workout_exercise_id
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view feedback directed to them"
  ON coach_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Coaches can create feedback"
  ON coach_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can view all feedback"
  ON coach_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Users can view own progress photos"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own progress photos"
  ON progress_photos FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Coaches can view all progress photos"
  ON progress_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own payment records"
  ON payment_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payment records"
  ON payment_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can create payment records"
  ON payment_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Functions and Triggers

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON program_enrollments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON payment_records
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_programs_type ON programs(program_type);
CREATE INDEX IF NOT EXISTS idx_programs_level ON programs(level);
CREATE INDEX IF NOT EXISTS idx_programs_active ON programs(is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON program_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program ON program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON program_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_program ON workouts(program_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(workout_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_records(status);
