-- Habilita Realtime para as tabelas usadas pelo dashboard ao vivo
alter publication supabase_realtime add table caixas;
alter publication supabase_realtime add table orders;
