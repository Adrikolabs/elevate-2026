-- Table-level SELECT overrides column grants, so revoke it and re-grant public columns only.
REVOKE SELECT ON public.students FROM anon, authenticated;
GRANT SELECT (id, student_code, full_name, department_id, avatar_url, bio, graduation_year,
  portfolio_url, github_url, behance_url, linkedin_url, is_nominee, is_active, is_demo, created_at, updated_at)
  ON public.students TO anon, authenticated;

-- Anonymous visitors never write anything.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.students, public.departments, public.projects, public.votes,
  public.graduation_messages, public.application_settings, public.admins, public.audit_logs, public.user_roles FROM anon;

-- Signed-in users never write votes directly or touch roles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.votes, public.user_roles FROM authenticated;

-- Students may only supply author + text when posting a wish.
REVOKE INSERT, UPDATE ON public.graduation_messages FROM authenticated;
GRANT INSERT (student_id, message) ON public.graduation_messages TO authenticated;
GRANT UPDATE (is_approved, message) ON public.graduation_messages TO authenticated;