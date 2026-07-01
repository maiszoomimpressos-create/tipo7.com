CREATE TABLE IF NOT EXISTS public.platform_team (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL CHECK (role IN ('super_admin', 'admin', 'member')),
  permissions TEXT[]  NOT NULL DEFAULT '{}',
  added_by    UUID    REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id         UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  key        TEXT  NOT NULL UNIQUE,
  value      TEXT  NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO public.platform_settings (key, value)
VALUES ('default_fee_pct', '10')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_team    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='team_service_only' AND tablename='platform_team') THEN
    CREATE POLICY team_service_only ON public.platform_team USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='settings_service_only' AND tablename='platform_settings') THEN
    CREATE POLICY settings_service_only ON public.platform_settings USING (false);
  END IF;
END $$;

-- Insere o super admin inicial
DO $$
DECLARE v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'maiszoomimpressos@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.platform_team (user_id, role, permissions)
    VALUES (v_uid, 'super_admin', ARRAY[
      'ver_dashboard','gerenciar_promotores','gerenciar_eventos',
      'gerenciar_financeiro','gerenciar_equipe'
    ])
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
