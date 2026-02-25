
CREATE OR REPLACE FUNCTION public.create_shared_link(
  p_company_id uuid,
  p_created_by uuid,
  p_password text,
  p_label text DEFAULT 'Contabilidade'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.shared_links (company_id, created_by, password_hash, label)
  VALUES (p_company_id, p_created_by, extensions.crypt(p_password, extensions.gen_salt('bf')), p_label)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_shared_link_password(
  p_link_id uuid,
  p_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT password_hash INTO v_hash FROM public.shared_links WHERE id = p_link_id;
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN v_hash = extensions.crypt(p_password, v_hash);
END;
$$;
