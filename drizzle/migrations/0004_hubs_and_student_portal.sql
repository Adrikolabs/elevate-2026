-- Hubs (admin-managed campus/location)
CREATE TABLE public.hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  slug text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hubs_name_lower_key ON public.hubs (lower(name));
CREATE UNIQUE INDEX hubs_slug_key ON public.hubs (slug);
GRANT SELECT ON public.hubs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hubs TO authenticated;
GRANT ALL ON public.hubs TO service_role;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hubs are public" ON public.hubs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage hubs" ON public.hubs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER hubs_updated_at BEFORE UPDATE ON public.hubs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS students_hub_idx ON public.students(hub_id);
GRANT SELECT (hub_id) ON public.students TO anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS students_email_lower_key ON public.students (lower(email));

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES public.hubs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_hub_idx ON public.projects(hub_id);

-- Own private profile (includes official read-only fields)
DROP FUNCTION IF EXISTS public.get_my_student();
CREATE FUNCTION public.get_my_student()
RETURNS TABLE(id uuid, full_name text, email text, phone text, student_code text, department_id uuid, department_name text,
  hub_id uuid, hub_name text, avatar_url text, bio text, graduation_year integer, is_nominee boolean, is_active boolean,
  portfolio_url text, github_url text, behance_url text, linkedin_url text, has_voted boolean, voted_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.full_name, s.email, s.phone, s.student_code, s.department_id, d.name, s.hub_id, h.name, s.avatar_url, s.bio,
    s.graduation_year, s.is_nominee, s.is_active, s.portfolio_url, s.github_url, s.behance_url, s.linkedin_url,
    (v.id IS NOT NULL), v.created_at, s.created_at
  FROM public.students s
  LEFT JOIN public.departments d ON d.id = s.department_id
  LEFT JOIN public.hubs h ON h.id = s.hub_id
  LEFT JOIN public.votes v ON v.voter_student_id = s.id
  WHERE s.auth_user_id = auth.uid()
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_student() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_student() TO authenticated;

-- Students edit only personal fields
CREATE OR REPLACE FUNCTION public.update_my_details(_full_name text, _phone text, _bio text, _portfolio_url text,
  _github_url text, _behance_url text, _linkedin_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text := trim(coalesce(_full_name, ''));
BEGIN
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN RAISE EXCEPTION 'NAME_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF char_length(coalesce(_phone, '')) > 30 OR coalesce(_phone, '') !~ '^[0-9+()\s-]*$' THEN RAISE EXCEPTION 'PHONE_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF char_length(coalesce(_bio, '')) > 600 THEN RAISE EXCEPTION 'BIO_TOO_LONG' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.students SET full_name = v_name, phone = nullif(trim(_phone), ''), bio = nullif(trim(_bio), ''),
    portfolio_url = nullif(trim(_portfolio_url), ''), github_url = nullif(trim(_github_url), ''),
    behance_url = nullif(trim(_behance_url), ''), linkedin_url = nullif(trim(_linkedin_url), '')
  WHERE auth_user_id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_REGISTERED' USING ERRCODE = 'P0001'; END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.update_my_details(text,text,text,text,text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_my_details(text,text,text,text,text,text,text) TO authenticated;

-- Admin roster listing with hub/account/project status
DROP FUNCTION IF EXISTS public.admin_list_students();
CREATE FUNCTION public.admin_list_students()
RETURNS TABLE(id uuid, student_code text, full_name text, email text, phone text, department_id uuid, hub_id uuid, avatar_url text,
  bio text, graduation_year integer, is_nominee boolean, is_active boolean, is_demo boolean, portfolio_url text, github_url text,
  behance_url text, linkedin_url text, account_linked boolean, has_voted boolean, votes_received bigint, project_status text,
  created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
  SELECT s.id, s.student_code, s.full_name, s.email, s.phone, s.department_id, s.hub_id, s.avatar_url, s.bio,
    s.graduation_year, s.is_nominee, s.is_active, s.is_demo, s.portfolio_url, s.github_url, s.behance_url,
    s.linkedin_url, (s.auth_user_id IS NOT NULL),
    EXISTS (SELECT 1 FROM public.votes v WHERE v.voter_student_id = s.id),
    (SELECT count(*) FROM public.votes v WHERE v.nominee_student_id = s.id),
    (SELECT p.submission_status FROM public.projects p WHERE p.student_id = s.id ORDER BY p.created_at LIMIT 1),
    s.created_at
  FROM public.students s ORDER BY s.full_name;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_students() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_students() TO authenticated;

-- Projects inherit hub from the student on save
CREATE OR REPLACE FUNCTION public.project_set_hub()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT hub_id INTO NEW.hub_id FROM public.students WHERE id = NEW.student_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER projects_set_hub BEFORE INSERT OR UPDATE OF student_id, title, cover_image_url, document_url, submission_status
  ON public.projects FOR EACH ROW EXECUTE FUNCTION public.project_set_hub();

-- Roster check used by the activation flow (server-side only)
CREATE OR REPLACE FUNCTION public.roster_lookup(_email text, _student_code text)
RETURNS TABLE(student_id uuid, is_active boolean, account_linked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.is_active, s.auth_user_id IS NOT NULL FROM public.students s
  WHERE lower(s.email) = lower(trim(_email)) AND upper(trim(coalesce(s.student_code, ''))) = upper(trim(_student_code))
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.roster_lookup(text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.roster_lookup(text, text) TO service_role;