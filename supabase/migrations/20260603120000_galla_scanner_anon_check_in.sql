-- Galla scanner: allow check-in without KontrolCenter login (secret URL + QR security_code).
-- Table reads stay authenticated-only; check-in remains SECURITY DEFINER RPC.

GRANT EXECUTE ON FUNCTION public.galla_check_in_ticket(bigint, text, bigint, text) TO anon;
