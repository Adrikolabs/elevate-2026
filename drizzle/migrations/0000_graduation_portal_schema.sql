-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ===== Shared updated_at trigger =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== Departments =====
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Departments are public" ON public.departments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== Students =====
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  student_code text UNIQUE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email text NOT NULL UNIQUE CHECK (char_length(email) <= 255),
  department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  avatar_url text,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 600),
  graduation_year int NOT NULL DEFAULT 2026,
  phone text,
  portfolio_url text,
  github_url text,
  behance_url text,
  linkedin_url text,
  is_nominee boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX students_department_idx ON public.students(department_id);
CREATE INDEX students_nominee_idx ON public.students(department_id) WHERE is_nominee;

-- Public columns only (email, phone, auth link stay private)
GRANT SELECT (id, student_code, full_name, department_id, avatar_url, bio, graduation_year,
  portfolio_url, github_url, behance_url, linkedin_url, is_nominee, is_active, is_demo, created_at, updated_at)
  ON public.students TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active students are public" ON public.students FOR SELECT TO anon, authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert students" ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update students" ON public.students FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete students" ON public.students FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Admins (pre-registered admin emails) =====
CREATE TABLE public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  full_name text,
  role text NOT NULL DEFAULT 'super_admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage admins" ON public.admins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Normalise emails & link to existing confirmed auth accounts
CREATE OR REPLACE FUNCTION public.link_student_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF NEW.auth_user_id IS NULL THEN
    SELECT u.id INTO NEW.auth_user_id FROM auth.users u
      WHERE lower(u.email) = NEW.email AND u.email_confirmed_at IS NOT NULL LIMIT 1;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER students_link BEFORE INSERT OR UPDATE OF email ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.link_student_account();

CREATE OR REPLACE FUNCTION public.link_admin_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF NEW.auth_user_id IS NULL THEN
    SELECT u.id INTO NEW.auth_user_id FROM auth.users u
      WHERE lower(u.email) = NEW.email AND u.email_confirmed_at IS NOT NULL LIMIT 1;
  END IF;
  IF NEW.auth_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.auth_user_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER admins_link BEFORE INSERT OR UPDATE OF email ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.link_admin_account();

-- When an auth account's email is confirmed, link it to the matching student/admin record
CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND NEW.email IS NOT NULL THEN
    UPDATE public.students SET auth_user_id = NEW.id
      WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL;
    UPDATE public.admins SET auth_user_id = NEW.id
      WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL;
    IF EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = NEW.id) THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_confirmed();

-- Helper: the signed-in user's active student id
CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.students WHERE auth_user_id = auth.uid() AND is_active LIMIT 1
$$;

-- ===== Projects =====
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 150),
  description text CHECK (description IS NULL OR char_length(description) <= 3000),
  cover_image_url text,
  project_type text NOT NULL DEFAULT 'Other' CHECK (project_type IN ('Website','Graphic Design','Video','Photography','Motion Graphics','GitHub Project','Figma Project','Behance Project','PDF','Other')),
  project_url text,
  video_url text,
  document_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_department_idx ON public.projects(department_id);
CREATE INDEX projects_student_idx ON public.projects(student_id);
GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published projects are public" ON public.projects FOR SELECT TO anon, authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Application settings (single row) =====
CREATE TABLE public.application_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  graduation_date timestamptz NOT NULL,
  graduation_title text NOT NULL,
  graduation_location text,
  graduation_description text,
  voting_open boolean NOT NULL DEFAULT false,
  messages_enabled boolean NOT NULL DEFAULT true,
  public_results_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.application_settings TO anon;
GRANT SELECT, UPDATE ON public.application_settings TO authenticated;
GRANT ALL ON public.application_settings TO service_role;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are public" ON public.application_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.application_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.application_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Votes =====
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  nominee_student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT votes_one_per_voter UNIQUE (voter_student_id),
  CONSTRAINT votes_one_per_voter_department UNIQUE (voter_student_id, department_id)
);
CREATE INDEX votes_nominee_idx ON public.votes(nominee_student_id);
CREATE INDEX votes_department_idx ON public.votes(department_id);
GRANT SELECT ON public.votes TO authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voters see own vote, admins see all" ON public.votes FOR SELECT TO authenticated
  USING (voter_student_id = public.current_student_id() OR public.has_role(auth.uid(), 'admin'));
-- No INSERT/UPDATE/DELETE policies: votes are only written by cast_vote().

-- ===== Graduation messages =====
CREATE TABLE public.graduation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 500),
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_created_idx ON public.graduation_messages(created_at DESC);
GRANT SELECT ON public.graduation_messages TO anon;
GRANT SELECT, DELETE ON public.graduation_messages TO authenticated;
GRANT INSERT (student_id, message) ON public.graduation_messages TO authenticated;
GRANT UPDATE (is_approved, message) ON public.graduation_messages TO authenticated;
GRANT ALL ON public.graduation_messages TO service_role;
ALTER TABLE public.graduation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved messages are public" ON public.graduation_messages FOR SELECT TO anon, authenticated
  USING (is_approved OR student_id = public.current_student_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students post as themselves" ON public.graduation_messages FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND EXISTS (SELECT 1 FROM public.application_settings s WHERE s.id = 1 AND s.messages_enabled)
  );
CREATE POLICY "Admins moderate messages" ON public.graduation_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors or admins delete messages" ON public.graduation_messages FOR DELETE TO authenticated
  USING (student_id = public.current_student_id() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER messages_updated_at BEFORE UPDATE ON public.graduation_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anti-spam: one message every 30 seconds, max 20 per student
CREATE OR REPLACE FUNCTION public.guard_message_spam()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.message := trim(NEW.message);
  IF EXISTS (SELECT 1 FROM public.graduation_messages
             WHERE student_id = NEW.student_id AND created_at > now() - interval '30 seconds') THEN
    RAISE EXCEPTION 'RATE_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.graduation_messages WHERE student_id = NEW.student_id) >= 20 THEN
    RAISE EXCEPTION 'MESSAGE_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_spam_guard BEFORE INSERT ON public.graduation_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_spam();

ALTER PUBLICATION supabase_realtime ADD TABLE public.graduation_messages;

-- ===== Audit logs =====
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

-- ===== Secure voting function =====
CREATE OR REPLACE FUNCTION public.cast_vote(_nominee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_voter public.students%ROWTYPE;
  v_nominee public.students%ROWTYPE;
  v_open boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001'; END IF;

  -- Lock the voter row so rapid duplicate requests are serialised
  SELECT * INTO v_voter FROM public.students WHERE auth_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_REGISTERED' USING ERRCODE = 'P0001'; END IF;
  IF NOT v_voter.is_active THEN RAISE EXCEPTION 'INACTIVE' USING ERRCODE = 'P0001'; END IF;
  IF v_voter.department_id IS NULL THEN RAISE EXCEPTION 'NO_DEPARTMENT' USING ERRCODE = 'P0001'; END IF;

  SELECT voting_open INTO v_open FROM public.application_settings WHERE id = 1;
  IF NOT COALESCE(v_open, false) THEN RAISE EXCEPTION 'VOTING_CLOSED' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_nominee FROM public.students WHERE id = _nominee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOMINEE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF NOT v_nominee.is_active OR NOT v_nominee.is_nominee THEN
    RAISE EXCEPTION 'NOMINEE_INELIGIBLE' USING ERRCODE = 'P0001';
  END IF;
  IF v_nominee.department_id IS DISTINCT FROM v_voter.department_id THEN
    RAISE EXCEPTION 'WRONG_DEPARTMENT' USING ERRCODE = 'P0001';
  END IF;
  IF v_nominee.id = v_voter.id THEN RAISE EXCEPTION 'SELF_VOTE' USING ERRCODE = 'P0001'; END IF;

  IF EXISTS (SELECT 1 FROM public.votes WHERE voter_student_id = v_voter.id) THEN
    RAISE EXCEPTION 'ALREADY_VOTED' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.votes (voter_student_id, nominee_student_id, department_id)
    VALUES (v_voter.id, v_nominee.id, v_voter.department_id);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_VOTED' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object('success', true, 'nominee_name', v_nominee.full_name);
END; $$;
REVOKE ALL ON FUNCTION public.cast_vote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid) TO authenticated;

-- ===== Signed-in student's own record (includes private fields for themselves) =====
CREATE OR REPLACE FUNCTION public.get_my_student()
RETURNS TABLE (id uuid, full_name text, email text, department_id uuid, department_name text,
  avatar_url text, bio text, graduation_year int, is_nominee boolean, is_active boolean,
  portfolio_url text, github_url text, behance_url text, linkedin_url text,
  has_voted boolean, voted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.full_name, s.email, s.department_id, d.name, s.avatar_url, s.bio, s.graduation_year,
    s.is_nominee, s.is_active, s.portfolio_url, s.github_url, s.behance_url, s.linkedin_url,
    (v.id IS NOT NULL), v.created_at
  FROM public.students s
  LEFT JOIN public.departments d ON d.id = s.department_id
  LEFT JOIN public.votes v ON v.voter_student_id = s.id
  WHERE s.auth_user_id = auth.uid()
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_my_student() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_student() TO authenticated;

-- Students can edit only their own bio and links
CREATE OR REPLACE FUNCTION public.update_my_profile(_bio text, _portfolio_url text, _github_url text, _behance_url text, _linkedin_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF char_length(coalesce(_bio, '')) > 600 THEN RAISE EXCEPTION 'BIO_TOO_LONG' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.students SET bio = nullif(trim(_bio), ''),
    portfolio_url = nullif(trim(_portfolio_url), ''), github_url = nullif(trim(_github_url), ''),
    behance_url = nullif(trim(_behance_url), ''), linkedin_url = nullif(trim(_linkedin_url), '')
  WHERE auth_user_id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_REGISTERED' USING ERRCODE = 'P0001'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text) TO authenticated;

-- ===== Public results (totals only, when enabled) =====
CREATE OR REPLACE FUNCTION public.get_public_results()
RETURNS TABLE (department_id uuid, nominee_id uuid, full_name text, avatar_url text, vote_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.department_id, s.id, s.full_name, s.avatar_url, count(v.id)
  FROM public.students s
  LEFT JOIN public.votes v ON v.nominee_student_id = s.id
  WHERE s.is_nominee AND s.is_active
    AND EXISTS (SELECT 1 FROM public.application_settings a WHERE a.id = 1 AND a.public_results_enabled)
  GROUP BY s.id
$$;
GRANT EXECUTE ON FUNCTION public.get_public_results() TO anon, authenticated;

-- ===== Admin: full student list incl. private fields and voting status =====
CREATE OR REPLACE FUNCTION public.admin_list_students()
RETURNS TABLE (id uuid, student_code text, full_name text, email text, phone text, department_id uuid,
  avatar_url text, bio text, graduation_year int, is_nominee boolean, is_active boolean, is_demo boolean,
  portfolio_url text, github_url text, behance_url text, linkedin_url text,
  account_linked boolean, has_voted boolean, votes_received bigint, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
  SELECT s.id, s.student_code, s.full_name, s.email, s.phone, s.department_id, s.avatar_url, s.bio,
    s.graduation_year, s.is_nominee, s.is_active, s.is_demo, s.portfolio_url, s.github_url, s.behance_url,
    s.linkedin_url, (s.auth_user_id IS NOT NULL),
    EXISTS (SELECT 1 FROM public.votes v WHERE v.voter_student_id = s.id),
    (SELECT count(*) FROM public.votes v WHERE v.nominee_student_id = s.id),
    s.created_at
  FROM public.students s ORDER BY s.full_name;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_students() TO authenticated;

-- ===== Seed: departments =====
INSERT INTO public.departments (name, slug, description) VALUES
  ('Virtual Assistant', 'virtual-assistant', 'Remote operations, client support and digital administration.'),
  ('Graphics Design', 'graphics-design', 'Brand identity, illustration, layout and visual communication.'),
  ('Website Development', 'website-development', 'Modern, responsive websites and web applications.'),
  ('Film & Photography', 'film-photography', 'Cinematography, editing and photographic storytelling.'),
  ('Motion Graphics', 'motion-graphics', 'Animation, kinetic typography and motion design.'),
  ('Fundamentals of Computer Science', 'computer-science', 'Programming, algorithms and computational thinking.');

-- ===== Seed: settings =====
INSERT INTO public.application_settings (id, graduation_date, graduation_title, graduation_location, graduation_description, voting_open, messages_enabled, public_results_enabled)
VALUES (1, '2026-12-12 10:00:00+03', 'Elevate Academy Class of December 2026 Graduation',
  'Elevate Academy Main Campus', 'Join us as we celebrate the creativity, growth and achievement of our December 2026 graduates.',
  true, true, false);