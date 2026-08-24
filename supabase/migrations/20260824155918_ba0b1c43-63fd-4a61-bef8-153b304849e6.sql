CREATE TABLE public.livekit_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  perfil text,
  contexto text,
  voz text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.livekit_agents TO authenticated;
GRANT ALL ON public.livekit_agents TO service_role;
ALTER TABLE public.livekit_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own livekit agents" ON public.livekit_agents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_livekit_agents_updated_at BEFORE UPDATE ON public.livekit_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();