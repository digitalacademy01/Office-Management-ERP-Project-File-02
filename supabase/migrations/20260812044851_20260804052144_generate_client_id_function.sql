CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'LAC-' || lpad(nextval('client_id_seq')::text, 4, '0');
$$;

GRANT EXECUTE ON FUNCTION generate_client_id() TO authenticated;