/*
  # User Settings storage

  1. New Tables
    - user_settings for notification, privacy, and display preferences

  2. Security
    - Enable RLS
    - Allow users to manage only their own settings
*/

CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy jsonb NOT NULL DEFAULT '{}'::jsonb,
  display jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON public.user_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON public.user_settings(user_id);
