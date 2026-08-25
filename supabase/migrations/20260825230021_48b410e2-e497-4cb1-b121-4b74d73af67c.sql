REVOKE EXECUTE ON FUNCTION public.get_guest_meeting_info(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_meeting_join_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_meeting_info(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_meeting_join_status(uuid) TO service_role;