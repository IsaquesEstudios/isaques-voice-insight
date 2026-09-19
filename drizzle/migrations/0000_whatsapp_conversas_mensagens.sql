CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_number_id text NOT NULL,
  contato_wa_id text NOT NULL,
  contato_nome text,
  ultima_mensagem text,
  ultima_em timestamptz NOT NULL DEFAULT now(),
  nao_lidas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id, contato_wa_id)
);
GRANT ALL ON public.whatsapp_conversas TO service_role;
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages whatsapp_conversas" ON public.whatsapp_conversas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_user ON public.whatsapp_conversas (user_id, ultima_em DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  wa_message_id text UNIQUE,
  direcao text NOT NULL CHECK (direcao IN ('entrada','saida')),
  tipo text NOT NULL DEFAULT 'text',
  texto text,
  status text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_mensagens TO service_role;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages whatsapp_mensagens" ON public.whatsapp_mensagens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_conversa ON public.whatsapp_mensagens (conversa_id, criado_em);

CREATE TRIGGER update_whatsapp_conversas_updated_at BEFORE UPDATE ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.whatsapp_numeros ADD CONSTRAINT whatsapp_numeros_phone_number_id_key UNIQUE (phone_number_id);