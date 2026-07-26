-- Configuração de orçamento/créditos Vapi por usuário.
-- A Vapi não expõe endpoint oficial de saldo, então o app calcula o saldo
-- estimado subtraindo o gasto real das chamadas do orçamento informado pelo usuário.
CREATE TABLE IF NOT EXISTS public.user_vapi_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_budget numeric(12,4) DEFAULT 0,
  low_balance_threshold numeric(5,4) DEFAULT 0.2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vapi_settings TO authenticated;
GRANT ALL ON public.user_vapi_settings TO service_role;

ALTER TABLE public.user_vapi_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_vapi_settings_select_own" ON public.user_vapi_settings;
CREATE POLICY "user_vapi_settings_select_own"
  ON public.user_vapi_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_vapi_settings_insert_own" ON public.user_vapi_settings;
CREATE POLICY "user_vapi_settings_insert_own"
  ON public.user_vapi_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_vapi_settings_update_own" ON public.user_vapi_settings;
CREATE POLICY "user_vapi_settings_update_own"
  ON public.user_vapi_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_vapi_settings_delete_own" ON public.user_vapi_settings;
CREATE POLICY "user_vapi_settings_delete_own"
  ON public.user_vapi_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
