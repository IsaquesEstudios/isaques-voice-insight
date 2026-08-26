ALTER TABLE public.meeting_rooms
  ADD COLUMN transcrever boolean NOT NULL DEFAULT false,
  ADD COLUMN assistente_ativa boolean NOT NULL DEFAULT false;

CREATE TABLE public.transcricoes_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_sala text NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX transcricoes_reunioes_nome_sala_key ON public.transcricoes_reunioes (nome_sala);

GRANT SELECT ON public.transcricoes_reunioes TO authenticated;
GRANT ALL ON public.transcricoes_reunioes TO service_role;

ALTER TABLE public.transcricoes_reunioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own meeting transcripts select"
ON public.transcricoes_reunioes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);