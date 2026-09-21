CREATE TABLE public.whatsapp_ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  provider text NOT NULL DEFAULT 'gemini' CHECK (provider = 'gemini'),
  area text NOT NULL CHECK (area IN ('suporte', 'vendas', 'educacao')),
  mission text NOT NULL CHECK (char_length(mission) BETWEEN 3 AND 500),
  tone text NOT NULL CHECK (tone IN ('acolhedor', 'formal', 'descontraido', 'tecnico')),
  emoji_usage text NOT NULL CHECK (emoji_usage IN ('nunca', 'raramente', 'frequente')),
  language text NOT NULL DEFAULT 'pt-BR' CHECK (language = 'pt-BR'),
  response_length text NOT NULL CHECK (response_length IN ('curtas', 'medias', 'detalhadas')),
  restrictions text NOT NULL DEFAULT '',
  knowledge text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_ai_agents TO authenticated;
GRANT ALL ON public.whatsapp_ai_agents TO service_role;
ALTER TABLE public.whatsapp_ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own whatsapp ai agents" ON public.whatsapp_ai_agents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service role manages whatsapp ai agents" ON public.whatsapp_ai_agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX whatsapp_ai_agents_user_idx ON public.whatsapp_ai_agents(user_id, created_at DESC);

ALTER TABLE public.whatsapp_numeros
  ADD COLUMN whatsapp_ai_agent_id uuid REFERENCES public.whatsapp_ai_agents(id) ON DELETE SET NULL;
CREATE INDEX whatsapp_numeros_agent_idx ON public.whatsapp_numeros(whatsapp_ai_agent_id);

CREATE TABLE public.whatsapp_ai_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gemini_api_key_ciphertext text NOT NULL,
  gemini_api_key_last_four text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_ai_credentials TO service_role;
ALTER TABLE public.whatsapp_ai_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages whatsapp ai credentials" ON public.whatsapp_ai_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_ai_conversation_controls (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  manual_takeover boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
GRANT ALL ON public.whatsapp_ai_conversation_controls TO service_role;
ALTER TABLE public.whatsapp_ai_conversation_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages whatsapp ai conversation controls" ON public.whatsapp_ai_conversation_controls
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.whatsapp_ai_runs (
  inbound_message_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  agent_id uuid REFERENCES public.whatsapp_ai_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_ai_runs TO service_role;
ALTER TABLE public.whatsapp_ai_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages whatsapp ai runs" ON public.whatsapp_ai_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX whatsapp_ai_runs_user_idx ON public.whatsapp_ai_runs(user_id, created_at DESC);

CREATE TRIGGER update_whatsapp_ai_agents_updated_at
BEFORE UPDATE ON public.whatsapp_ai_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_ai_credentials_updated_at
BEFORE UPDATE ON public.whatsapp_ai_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_ai_controls_updated_at
BEFORE UPDATE ON public.whatsapp_ai_conversation_controls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_ai_runs_updated_at
BEFORE UPDATE ON public.whatsapp_ai_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();