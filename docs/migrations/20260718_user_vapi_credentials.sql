-- Run this in your Supabase SQL editor (external project) before deploying.
-- Mirrors the pattern of `user_twilio_credentials`.
CREATE TABLE IF NOT EXISTS public.user_vapi_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  private_key text NOT NULL,
  public_key text,
  friendly_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: add the column if the table pre-existed without it.
ALTER TABLE public.user_vapi_credentials
  ADD COLUMN IF NOT EXISTS public_key text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vapi_credentials TO authenticated;
GRANT ALL ON public.user_vapi_credentials TO service_role;

ALTER TABLE public.user_vapi_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_vapi_credentials_select_own" ON public.user_vapi_credentials;
CREATE POLICY "user_vapi_credentials_select_own"
  ON public.user_vapi_credentials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_vapi_credentials_insert_own" ON public.user_vapi_credentials;
CREATE POLICY "user_vapi_credentials_insert_own"
  ON public.user_vapi_credentials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_vapi_credentials_update_own" ON public.user_vapi_credentials;
CREATE POLICY "user_vapi_credentials_update_own"
  ON public.user_vapi_credentials FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_vapi_credentials_delete_own" ON public.user_vapi_credentials;
CREATE POLICY "user_vapi_credentials_delete_own"
  ON public.user_vapi_credentials FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
