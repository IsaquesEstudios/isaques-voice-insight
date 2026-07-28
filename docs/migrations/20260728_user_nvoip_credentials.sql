-- Credenciais Nvoip por usuário (substituição planejada da Twilio).
-- A Vapi não possui provider nativo "nvoip": a integração acontece via
-- BYO SIP Trunk, por isso guardamos tanto as credenciais da API REST
-- (https://api.nvoip.com.br/v2) quanto os dados do tronco SIP.
CREATE TABLE IF NOT EXISTS public.user_nvoip_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text,                       -- Napikey (autenticação simples da API)
  client_id text,                     -- OAuth2 (opcional)
  client_secret text,                 -- OAuth2 (opcional)
  sip_host text NOT NULL DEFAULT 'sip.nvoip.com.br',
  sip_username text NOT NULL,
  sip_password text NOT NULL,
  vapi_credential_id text,            -- id da credencial byo-sip-trunk criada na Vapi
  friendly_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_nvoip_credentials TO authenticated;
GRANT ALL ON public.user_nvoip_credentials TO service_role;

ALTER TABLE public.user_nvoip_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_nvoip_credentials_select_own" ON public.user_nvoip_credentials;
CREATE POLICY "user_nvoip_credentials_select_own"
  ON public.user_nvoip_credentials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_nvoip_credentials_insert_own" ON public.user_nvoip_credentials;
CREATE POLICY "user_nvoip_credentials_insert_own"
  ON public.user_nvoip_credentials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_nvoip_credentials_update_own" ON public.user_nvoip_credentials;
CREATE POLICY "user_nvoip_credentials_update_own"
  ON public.user_nvoip_credentials FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_nvoip_credentials_delete_own" ON public.user_nvoip_credentials;
CREATE POLICY "user_nvoip_credentials_delete_own"
  ON public.user_nvoip_credentials FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
