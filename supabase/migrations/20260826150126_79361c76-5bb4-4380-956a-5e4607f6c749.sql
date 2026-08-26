GRANT ALL ON public.transcricoes_reunioes TO service_role;
GRANT SELECT ON public.transcricoes_reunioes TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS transcricoes_reunioes_nome_sala_key
  ON public.transcricoes_reunioes (nome_sala);

CREATE OR REPLACE FUNCTION public.set_transcricao_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT m.user_id INTO NEW.user_id
    FROM public.meeting_rooms m
    WHERE m.code = NEW.nome_sala
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_transcricao_user_id_trg ON public.transcricoes_reunioes;
CREATE TRIGGER set_transcricao_user_id_trg
BEFORE INSERT OR UPDATE ON public.transcricoes_reunioes
FOR EACH ROW EXECUTE FUNCTION public.set_transcricao_user_id();