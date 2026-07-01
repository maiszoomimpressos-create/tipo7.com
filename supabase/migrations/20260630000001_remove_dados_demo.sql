-- Remove dados de demonstração inseridos pela migration 20260615000002_eventos_exemplo.sql
-- A exclusão cascateia para: events → event_days, event_tickets, event_day_attractions,
-- event_positions, event_staff, orders, fee_rules, ticket_validations
DELETE FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000001';
