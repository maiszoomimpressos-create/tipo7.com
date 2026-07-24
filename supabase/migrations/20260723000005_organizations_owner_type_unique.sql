-- =============================================================
-- Corrige duplicidade de organizações do mesmo usuário e impede que
-- volte a acontecer.
--
-- Causa raiz: web/src/app/criar-evento/TipoPessoaModal.tsx verificava
-- organização existente só por owner_id (sem filtrar type), usando
-- .maybeSingle(). Quando já havia mais de uma linha pra esse owner_id
-- (de qualquer tipo), a query retornava erro — ignorado pelo código —
-- e o fluxo caía no "senão", criando mais uma organização. Autoalimentado:
-- quanto mais duplicatas, mais fácil criar a próxima.
--
-- Regra de negócio: cada usuário tem no máximo UMA organização por tipo
-- (uma "promotora", uma "estabelecimento") — o código T7 do promotor é
-- fixo por usuário, não se multiplica.
-- =============================================================

-- Remove as duplicatas órfãs (sem eventos, sem membros) geradas pelo bug,
-- mantendo a organização com dados reais ("moises eventos",
-- 85b44300-469e-48d1-86fa-a4ae2ef81531) como a canônica do usuário.
DELETE FROM public.organizations
WHERE id IN (
  '994e1ab4-e837-40c1-af51-3de8a2f2e99d',
  'abdeb69c-1323-4a52-b151-8a7846745b87',
  '00bd4268-a5ff-4c8a-b0e5-a52bb657e13a',
  '0d725938-98d5-4784-acc8-640769cfc601'
);

-- Impede fisicamente duplicidade daqui pra frente: um usuário só pode
-- ser dono de uma organização por tipo.
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_owner_type_unique UNIQUE (owner_id, type);
