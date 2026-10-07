-- Projects: submission review workflow (existing rows stay approved/public)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS tools_used text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submission_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS admin_feedback text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.projects ALTER COLUMN submission_status SET DEFAULT 'draft';
ALTER TABLE public.projects ADD CONSTRAINT projects_submission_status_check
  CHECK (submission_status IN ('draft','pending','approved','rejected'));
CREATE INDEX IF NOT EXISTS projects_student_idx ON public.projects(student_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(submission_status);

DROP POLICY IF EXISTS "Published projects are public" ON public.projects;
CREATE POLICY "Approved projects are public, owners and admins see all" ON public.projects
  FOR SELECT TO anon, authenticated
  USING ((is_published AND submission_status = 'approved')
         OR student_id = public.current_student_id()
         OR public.has_role(auth.uid(), 'admin'));

-- Students create/edit their own single project; ownership derived from auth.uid()
CREATE OR REPLACE FUNCTION public.save_my_project(
  _title text, _short_description text, _description text, _project_type text,
  _project_url text, _cover_image_url text, _document_url text, _tools_used text[], _submit boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_found boolean;
  v_status text;
  v_changed boolean;
  v_title text := trim(coalesce(_title, ''));
  v_short text := nullif(trim(coalesce(_short_description, '')), '');
  v_desc text := nullif(trim(coalesce(_description, '')), '');
  v_type text := trim(coalesce(_project_type, ''));
  v_url text := nullif(trim(coalesce(_project_url, '')), '');
  v_cover text := nullif(trim(coalesce(_cover_image_url, '')), '');
  v_doc text := nullif(trim(coalesce(_document_url, '')), '');
  v_tools text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_student FROM public.students WHERE auth_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_REGISTERED' USING ERRCODE = 'P0001'; END IF;
  IF NOT v_student.is_active THEN RAISE EXCEPTION 'INACTIVE' USING ERRCODE = 'P0001'; END IF;
  IF v_student.department_id IS NULL THEN RAISE EXCEPTION 'NO_DEPARTMENT' USING ERRCODE = 'P0001'; END IF;

  IF char_length(v_title) < 2 OR char_length(v_title) > 120 THEN RAISE EXCEPTION 'TITLE_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF char_length(coalesce(v_short, '')) > 200 THEN RAISE EXCEPTION 'SHORT_TOO_LONG' USING ERRCODE = 'P0001'; END IF;
  IF char_length(coalesce(v_desc, '')) > 5000 THEN RAISE EXCEPTION 'DESCRIPTION_TOO_LONG' USING ERRCODE = 'P0001'; END IF;
  IF v_type NOT IN ('Website','Graphic Design','Photography','Film','Motion Graphics','Virtual Assistant Project',
      'Computer Science Project','Presentation','Research / Documentation','Portfolio','PDF Project','Other') THEN
    RAISE EXCEPTION 'TYPE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_url IS NOT NULL AND (char_length(v_url) > 500 OR v_url !~* '^https?://[^\s/?#]+\.[^\s]+$') THEN
    RAISE EXCEPTION 'URL_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(DISTINCT left(trim(t), 40)) INTO v_tools
    FROM unnest(coalesce(_tools_used, '{}')) AS t WHERE trim(t) <> '';
  v_tools := coalesce(v_tools[1:20], '{}');

  SELECT * INTO v_project FROM public.projects WHERE student_id = v_student.id ORDER BY created_at LIMIT 1 FOR UPDATE;
  v_found := FOUND;

  -- Uploaded files must live in this student's own storage folder (or be the unchanged existing file)
  IF v_cover IS NOT NULL AND NOT (v_found AND v_cover = v_project.cover_image_url)
     AND (v_cover NOT LIKE 'storage:project-images/' || v_student.id::text || '/%' OR v_cover LIKE '%..%') THEN
    RAISE EXCEPTION 'FILE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_doc IS NOT NULL AND NOT (v_found AND v_doc = v_project.document_url)
     AND (v_doc NOT LIKE 'storage:project-pdfs/' || v_student.id::text || '/%' OR v_doc LIKE '%..%') THEN
    RAISE EXCEPTION 'FILE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF _submit THEN
    IF v_short IS NULL THEN RAISE EXCEPTION 'SHORT_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF v_cover IS NULL AND v_url IS NULL AND v_doc IS NULL THEN RAISE EXCEPTION 'SUBMIT_INCOMPLETE' USING ERRCODE = 'P0001'; END IF;
  END IF;

  IF NOT v_found THEN
    INSERT INTO public.projects (student_id, department_id, title, short_description, description, project_type,
      project_url, cover_image_url, document_url, tools_used, submission_status, is_published, submitted_at)
    VALUES (v_student.id, v_student.department_id, v_title, v_short, v_desc, v_type, v_url, v_cover, v_doc, v_tools,
      CASE WHEN _submit THEN 'pending' ELSE 'draft' END, true, CASE WHEN _submit THEN now() END)
    RETURNING * INTO v_project;
  ELSE
    v_changed := (v_project.title, v_project.short_description, v_project.description, v_project.project_type,
                  v_project.project_url, v_project.cover_image_url, v_project.document_url, v_project.tools_used)
      IS DISTINCT FROM (v_title, v_short, v_desc, v_type, v_url, v_cover, v_doc, v_tools);
    v_status := CASE
      WHEN v_project.submission_status = 'approved' AND NOT v_changed THEN 'approved'
      WHEN _submit OR v_project.submission_status = 'approved' THEN 'pending'
      ELSE v_project.submission_status END;
    UPDATE public.projects SET
      department_id = v_student.department_id, title = v_title, short_description = v_short, description = v_desc,
      project_type = v_type, project_url = v_url, cover_image_url = v_cover, document_url = v_doc, tools_used = v_tools,
      submission_status = v_status,
      admin_feedback = CASE WHEN v_status = 'pending' AND v_project.submission_status <> 'pending' THEN NULL ELSE admin_feedback END,
      submitted_at = CASE WHEN v_status = 'pending' AND v_project.submission_status <> 'pending' THEN now() ELSE submitted_at END
    WHERE id = v_project.id
    RETURNING * INTO v_project;
  END IF;

  RETURN jsonb_build_object('id', v_project.id, 'status', v_project.submission_status);
END; $$;

-- Students set their own headshot; path must be inside their own folder
CREATE OR REPLACE FUNCTION public.set_my_headshot(_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := public.current_student_id();
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'NOT_REGISTERED' USING ERRCODE = 'P0001'; END IF;
  IF _path IS NOT NULL AND (_path NOT LIKE 'storage:student-headshots/' || v_id::text || '/%' OR _path LIKE '%..%') THEN
    RAISE EXCEPTION 'FILE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.students SET avatar_url = _path WHERE id = v_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.save_my_project(text,text,text,text,text,text,text,text[],boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_my_project(text,text,text,text,text,text,text,text[],boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_my_headshot(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_my_headshot(text) TO authenticated;

-- Storage: headshots (public read; owner folder write)
CREATE POLICY "Headshots are viewable" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'student-headshots');
CREATE POLICY "Students upload own headshot" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-headshots' AND (storage.foldername(name))[1] = public.current_student_id()::text);
CREATE POLICY "Students update own headshot" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'student-headshots' AND (storage.foldername(name))[1] = public.current_student_id()::text)
  WITH CHECK (bucket_id = 'student-headshots' AND (storage.foldername(name))[1] = public.current_student_id()::text);
CREATE POLICY "Students delete own headshot" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'student-headshots' AND (storage.foldername(name))[1] = public.current_student_id()::text);

-- Storage: project images & PDFs (owner/admin, or public once the project is approved)
CREATE POLICY "Project files readable when approved" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('project-images', 'project-pdfs') AND (
    (storage.foldername(name))[1] = public.current_student_id()::text
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.projects p
               WHERE p.is_published AND p.submission_status = 'approved'
                 AND (p.cover_image_url = 'storage:' || objects.bucket_id || '/' || objects.name
                      OR p.document_url = 'storage:' || objects.bucket_id || '/' || objects.name))));
CREATE POLICY "Students upload own project files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('project-images', 'project-pdfs') AND (storage.foldername(name))[1] = public.current_student_id()::text);
CREATE POLICY "Students update own project files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('project-images', 'project-pdfs') AND (storage.foldername(name))[1] = public.current_student_id()::text)
  WITH CHECK (bucket_id IN ('project-images', 'project-pdfs') AND (storage.foldername(name))[1] = public.current_student_id()::text);
CREATE POLICY "Students delete own project files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('project-images', 'project-pdfs') AND (storage.foldername(name))[1] = public.current_student_id()::text);

-- Admins manage all portal files
CREATE POLICY "Admins manage portal files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('student-headshots', 'project-images', 'project-pdfs') AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id IN ('student-headshots', 'project-images', 'project-pdfs') AND public.has_role(auth.uid(), 'admin'));