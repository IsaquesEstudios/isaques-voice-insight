REVOKE EXECUTE ON FUNCTION public.get_guest_meeting_info(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_meeting_join_status(uuid) FROM anon, authenticated;