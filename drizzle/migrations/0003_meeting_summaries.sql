CREATE TABLE public.meeting_summaries (
  code text PRIMARY KEY,
  summary jsonb NOT NULL,
  transcript_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meeting_summaries TO service_role;
ALTER TABLE public.meeting_summaries ENABLE ROW LEVEL SECURITY;