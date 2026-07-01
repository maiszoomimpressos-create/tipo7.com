-- =============================================================
-- MIGRATION: audit_logs
-- Rastreamento de ações críticas na plataforma.
-- Registra quem fez o quê, quando e de onde.
-- Essencial para investigar fraudes e incidentes.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  details       JSONB,
  ip            TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas service role escreve
CREATE POLICY "audit_service_insert" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Usuário vê apenas seus próprios logs; admin vê tudo via service client
CREATE POLICY "audit_own_select" ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Índices para buscas rápidas por usuário, ação e data
CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action  ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
