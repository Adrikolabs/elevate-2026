ALTER TABLE public.students ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_account_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_account_status_check CHECK (account_status IN ('pending_verification','active','disabled'));
CREATE UNIQUE INDEX IF NOT EXISTS students_email_lower_key ON public.students (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS hubs_name_key ON public.hubs (name);

CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _hub uuid; _dept uuid; _name text;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND NEW.email IS NOT NULL THEN
    UPDATE public.students SET auth_user_id = NEW.id
      WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL;
    UPDATE public.admins SET auth_user_id = NEW.id
      WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL;
    IF EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = NEW.id) THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    ELSIF NOT EXISTS (SELECT 1 FROM public.students WHERE auth_user_id = NEW.id)
          AND NEW.raw_user_meta_data ? 'hub_id' THEN
      BEGIN
        _hub := NULLIF(NEW.raw_user_meta_data->>'hub_id','')::uuid;
        _dept := NULLIF(NEW.raw_user_meta_data->>'department_id','')::uuid;
        _name := left(coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'),''), split_part(NEW.email,'@',1)), 120);
        IF NOT EXISTS (SELECT 1 FROM public.hubs WHERE id = _hub AND is_active) THEN _hub := NULL; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = _dept) THEN _dept := NULL; END IF;
        INSERT INTO public.students(auth_user_id, full_name, email, hub_id, department_id, student_code, account_status, is_active)
        VALUES (NEW.id, _name, lower(NEW.email), _hub, _dept,
                NULLIF(left(trim(coalesce(NEW.raw_user_meta_data->>'student_code','')),40),''), 'active', true)
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'student auto-create failed: %', SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END; $$;