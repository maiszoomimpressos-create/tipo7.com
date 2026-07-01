-- =============================================================
-- MIGRATION 001 — Usuários, Papéis e Organizações
-- Cria toda a estrutura base de usuários, papéis da plataforma,
-- organizações, eventos, cargos personalizados e permissões.
-- =============================================================


-- ---------------------------------------------------------------
-- FUNÇÃO AUXILIAR: atualiza o campo updated_at automaticamente
-- sempre que um registro for modificado
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------
-- TABELA: profiles
-- Estende o usuário do Supabase Auth com dados do perfil
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  cpf         TEXT        UNIQUE,
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Atualiza updated_at automaticamente ao editar o perfil
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Quando um usuário se cadastra no Auth, cria o perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------
-- TIPO: platform_role
-- Papéis fixos da plataforma (definidos pelo sistema)
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.platform_role AS ENUM (
    'comprador',        -- padrão para todo usuário, pode comprar ingressos
    'promotor',         -- cria e gerencia seus próprios eventos
    'estabelecimento',  -- dono de local/venue
    'gestor',           -- gerencia operações de um evento específico
    'admin'             -- administrador geral da plataforma Tipo7.com
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------
-- TABELA: user_platform_roles
-- Um usuário pode ter múltiplos papéis na plataforma ao mesmo tempo
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_platform_roles (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        platform_role NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, role) -- impede papéis duplicados para o mesmo usuário
);


-- ---------------------------------------------------------------
-- TIPO: organization_type
-- Tipo da organização: empresa promotora de eventos ou local/venue
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.organization_type AS ENUM (
    'promotora',       -- empresa ou pessoa que organiza eventos
    'estabelecimento'  -- dono de local onde os eventos acontecem
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------
-- TABELA: organizations
-- Empresas/organizações cadastradas na plataforma
-- Um usuário pode criar/pertencer a várias organizações
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID              DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT              NOT NULL,
  type        organization_type NOT NULL,
  owner_id    UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ       DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ       DEFAULT NOW() NOT NULL
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- TABELA: organization_members
-- Usuários que fazem parte de uma organização com seus papéis
-- Ex: João é gestor na promotora "Festas XYZ"
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role             platform_role NOT NULL,
  status           TEXT          DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'active', 'inactive')),
  invited_by       UUID          REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  UNIQUE (organization_id, user_id) -- um usuário tem apenas um vínculo por organização
);


-- ---------------------------------------------------------------
-- TIPO: event_status
-- Estado atual do evento
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM (
    'rascunho',   -- sendo criado, não visível ao público
    'publicado',  -- visível e com vendas abertas
    'cancelado',  -- evento cancelado
    'encerrado'   -- evento já aconteceu
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------
-- TABELA: events
-- Eventos criados pelas organizações promotoras
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title            TEXT          NOT NULL,
  description      TEXT,
  cover_url        TEXT,
  date_start       TIMESTAMPTZ   NOT NULL,
  date_end         TIMESTAMPTZ,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  status           event_status  DEFAULT 'rascunho' NOT NULL,
  created_by       UUID          REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- TABELA: event_positions
-- Cargos personalizados criados pelo promotor para cada evento
-- Ex: "Segurança Portão A", "Garçom", "Coordenador"
-- O promotor cria, edita e remove esses cargos livremente
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_positions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL, -- nome do cargo, ex: "Segurança Portão A"
  description TEXT,                 -- descrição opcional do cargo
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER trg_event_positions_updated_at
  BEFORE UPDATE ON public.event_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- TIPO: event_permission
-- Lista de permissões que podem ser atribuídas a um cargo de evento
-- O promotor escolhe quais permissões cada cargo tem
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.event_permission AS ENUM (
    'validar_ingresso',      -- pode escanear e validar ingressos na entrada
    'ver_lista_convidados',  -- pode ver a lista de compradores/convidados
    'ver_relatorios',        -- pode ver relatórios de vendas e presença
    'gerenciar_checkin',     -- pode controlar entrada e saída no evento
    'gerenciar_equipe'       -- pode convidar e gerenciar outros membros da equipe
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------
-- TABELA: event_position_permissions
-- Permissões atribuídas a cada cargo de evento
-- Ex: cargo "Segurança" tem permissão "validar_ingresso"
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_position_permissions (
  id                  UUID             DEFAULT gen_random_uuid() PRIMARY KEY,
  event_position_id   UUID             NOT NULL REFERENCES public.event_positions(id) ON DELETE CASCADE,
  permission          event_permission NOT NULL,
  UNIQUE (event_position_id, permission) -- cada permissão aparece uma vez por cargo
);


-- ---------------------------------------------------------------
-- TABELA: event_staff
-- Usuários com cargos atribuídos em eventos específicos
-- Ex: João tem o cargo "Segurança Portão A" no evento "Festa Junina"
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_staff (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id            UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_position_id   UUID        REFERENCES public.event_positions(id) ON DELETE SET NULL,
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status              TEXT        DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'active', 'rejected', 'inactive')),
  invited_by          UUID        REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (event_id, user_id) -- cada usuário tem apenas um cargo por evento
);

CREATE TRIGGER trg_event_staff_updated_at
  BEFORE UPDATE ON public.event_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
