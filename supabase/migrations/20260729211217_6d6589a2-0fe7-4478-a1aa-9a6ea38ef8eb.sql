CREATE TABLE public.user_vapi_credentials (
  user_id UUID PRIMARY KEY,
  private_key TEXT,
  public_key TEXT,
  friendly_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vapi_credentials TO authenticated;
GRANT ALL ON public.user_vapi_credentials TO service_role;
ALTER TABLE public.user_vapi_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vapi credentials" ON public.user_vapi_credentials FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_nvoip_credentials (
  user_id UUID PRIMARY KEY,
  api_key TEXT,
  client_id TEXT,
  client_secret TEXT,
  sip_host TEXT,
  sip_username TEXT,
  sip_password TEXT,
  friendly_label TEXT,
  vapi_credential_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_nvoip_credentials TO authenticated;
GRANT ALL ON public.user_nvoip_credentials TO service_role;
ALTER TABLE public.user_nvoip_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nvoip credentials" ON public.user_nvoip_credentials FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  friendly_name TEXT,
  provider TEXT,
  twilio_sid TEXT,
  region TEXT,
  country_iso TEXT,
  capabilities JSONB,
  monthly_cost NUMERIC,
  assistant_id TEXT,
  vapi_phone_number_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_phone_numbers TO authenticated;
GRANT ALL ON public.user_phone_numbers TO service_role;
ALTER TABLE public.user_phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phone numbers" ON public.user_phone_numbers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_test_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT,
  phone_e164 TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_test_contacts TO authenticated;
GRANT ALL ON public.user_test_contacts TO service_role;
ALTER TABLE public.user_test_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own test contacts" ON public.user_test_contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_vapi_settings (
  user_id UUID PRIMARY KEY,
  credits_budget NUMERIC,
  low_balance_threshold NUMERIC NOT NULL DEFAULT 0.2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vapi_settings TO authenticated;
GRANT ALL ON public.user_vapi_settings TO service_role;
ALTER TABLE public.user_vapi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vapi settings" ON public.user_vapi_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);