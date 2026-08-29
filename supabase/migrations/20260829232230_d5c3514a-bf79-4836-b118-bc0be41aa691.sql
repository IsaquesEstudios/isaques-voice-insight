CREATE TABLE IF NOT EXISTS public.telefones_usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telefones_usuarios TO authenticated;
GRANT ALL ON public.telefones_usuarios TO service_role;
ALTER TABLE public.telefones_usuarios ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'telefones_usuarios' AND policyname = 'own telefones_usuarios') THEN
    CREATE POLICY "own telefones_usuarios" ON public.telefones_usuarios FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DROP TRIGGER IF EXISTS update_telefones_usuarios_updated_at ON public.telefones_usuarios;
CREATE TRIGGER update_telefones_usuarios_updated_at BEFORE UPDATE ON public.telefones_usuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();