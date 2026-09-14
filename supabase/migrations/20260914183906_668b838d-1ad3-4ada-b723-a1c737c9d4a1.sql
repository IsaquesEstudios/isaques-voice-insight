CREATE TABLE public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  access_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, waba_id)
);
GRANT ALL ON public.whatsapp_accounts TO service_role;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages whatsapp_accounts" ON public.whatsapp_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_whatsapp_accounts_updated_at BEFORE UPDATE ON public.whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_number_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_numeros TO authenticated;
GRANT ALL ON public.whatsapp_numeros TO service_role;
ALTER TABLE public.whatsapp_numeros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own whatsapp numeros" ON public.whatsapp_numeros FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_whatsapp_numeros_updated_at BEFORE UPDATE ON public.whatsapp_numeros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();