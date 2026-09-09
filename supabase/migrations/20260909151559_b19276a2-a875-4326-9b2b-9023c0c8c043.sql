CREATE TABLE public.atendentes_ia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sip_trunk_id text NOT NULL,
  telefone text,
  nome text,
  usar_ia boolean NOT NULL DEFAULT true,
  prompt text NOT NULL DEFAULT '',
  saudacao text NOT NULL DEFAULT '',
  voz_id text,
  numeros_transferencia jsonb NOT NULL DEFAULT '{}'::jsonb,
  numero_transferencia_padrao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, sip_trunk_id)
);

GRANT ALL ON public.atendentes_ia TO service_role;

ALTER TABLE public.atendentes_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages atendentes_ia"
ON public.atendentes_ia FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_atendentes_ia_updated_at
BEFORE UPDATE ON public.atendentes_ia
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();