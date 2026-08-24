-- Pedido do usuário (24/08/2026): os templates globais "Scanner" e "Caixa"
-- saem da lista "Adicionar do sistema" (tela de Equipe do evento) — são
-- redundantes: Scanner é a mesma permissão (validar_ingresso) que já cabe
-- criar direto na função, e Caixa (vender_ingresso sozinho) é subconjunto
-- do que "Bilheteria" já cobre (vender_ingresso + ver_lista_convidados) —
-- não existe "ter Bilheteria sem ter Caixa". A atribuição granular
-- (só scanner, só saída de estacionamento, etc) continua disponível no
-- editor de permissões da própria função — só não precisa mais existir
-- como atalho de template.
--
-- `active = false`, não DELETE — preserva o registro (e o vínculo de FK em
-- staff_function_template_permissions) caso precise reverter, só sai do
-- filtro `WHERE active = true` usado pelo GET /staff-function-templates
-- (server/src/staff-function-templates/staff-function-templates.controller.ts).
-- Aplicado direto em produção via docker exec nesta sessão; esta migration
-- só registra o estado, pra não divergir do banco real numa recriação do
-- zero (ver achado de drift em project_organization_admins na memória).

UPDATE public.staff_function_templates
SET active = false
WHERE name IN ('Scanner', 'Caixa');
