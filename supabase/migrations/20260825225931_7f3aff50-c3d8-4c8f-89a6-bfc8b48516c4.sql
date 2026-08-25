CREATE TABLE public.meeting_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  scheduled_at timestamp with time zone,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_rooms TO authenticated;
GRANT ALL ON public.meeting_rooms TO service_role;
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meeting rooms" ON public.meeting_rooms FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_meeting_rooms_updated_at BEFORE UPDATE ON public.meeting_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meeting_join_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code text NOT NULL REFERENCES public.meeting_rooms(code) ON DELETE CASCADE,
  guest_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT INSERT ON public.meeting_join_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_join_requests TO authenticated;
GRANT ALL ON public.meeting_join_requests TO service_role;
ALTER TABLE public.meeting_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guests create join requests" ON public.meeting_join_requests FOR INSERT TO anon WITH CHECK (status = 'pending' AND token IS NULL);
CREATE POLICY "host reads join requests" ON public.meeting_join_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.meeting_rooms m WHERE m.code = room_code AND m.user_id = auth.uid()));
CREATE POLICY "host updates join requests" ON public.meeting_join_requests FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.meeting_rooms m WHERE m.code = room_code AND m.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_rooms m WHERE m.code = room_code AND m.user_id = auth.uid()));
CREATE TRIGGER update_meeting_join_requests_updated_at BEFORE UPDATE ON public.meeting_join_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_guest_meeting_info(p_code text)
RETURNS TABLE(name text, scheduled_at timestamp with time zone, ended_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.name, m.scheduled_at, m.ended_at
  FROM public.meeting_rooms m
  WHERE m.code = p_code
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_meeting_join_status(p_id uuid)
RETURNS TABLE(status text, token text, room_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.status,
    CASE WHEN r.status = 'approved' THEN r.token ELSE NULL END,
    r.room_code
  FROM public.meeting_join_requests r
  WHERE r.id = p_id AND r.created_at > now() - interval '30 minutes';
$$;