// Fase 6 (corte final) — filtra um dump `pg_dump --schema=public --schema-only`
// da Supabase pra poder restaurar num Postgres próprio, sem depender do
// schema `auth` (GoTrue) que não existe fora da Supabase.
//
// Uso: node filter-supabase-dump.mjs <dump.sql> <dump_clean.sql>
//
// O que faz:
//  - Remove blocos "Type: POLICY" / "ROW SECURITY" / "ACL" (RLS não é usado
//    pelo app — tudo passa por Prisma com conexão direta, equivalente ao
//    service_role de antes).
//  - Remove a função handle_new_user() (trigger só existia em auth.users,
//    que não existe mais — o registro agora é direto via AuthService.register()).
//  - Reescreve FK CONSTRAINTs que apontavam pra auth.users(id) pra
//    public.profiles(id) — mesmo uuid preservado na migração de dados,
//    então a integridade referencial continua válida.
//  - Reescreve as funções find_user_id_by_email/get_emails_by_ids/
//    get_user_emails/get_user_id_by_email pra consultarem public.profiles
//    em vez de auth.users — zero mudança de código nos ~8 call sites em
//    server/src que já usam essas funções via $queryRaw.
//
// Testado e validado contra um banco de teste em 04/08/2026 (ver memória
// project_migracao_nestjs_prisma.md) — reusar este mesmo script pra
// migração de dados de produção (não reinventar o filtro na hora do corte).

import { readFileSync, writeFileSync } from 'fs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('uso: node filter-supabase-dump.mjs <dump.sql> <dump_clean.sql>');
  process.exit(1);
}

const src = readFileSync(inPath, 'utf8');
const lines = src.split('\n');

const headerRe = /^-- Name: (.+); Type: ([A-Z ]+);/;

const DROP_TYPES = new Set(['POLICY', 'ROW SECURITY', 'ACL']);
const DROP_FUNCTION_NAMES = new Set(['handle_new_user()']);
const EMAIL_FUNCTIONS = new Set([
  'find_user_id_by_email(text)',
  'get_emails_by_ids(uuid[])',
  'get_user_emails(uuid[])',
  'get_user_id_by_email(text)',
]);

const blocks = [];
let current = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const isHeaderStart = line === '--' && lines[i + 1]?.match(headerRe);
  if (isHeaderStart && current.length > 0) {
    blocks.push(current);
    current = [];
  }
  current.push(line);
}
if (current.length) blocks.push(current);

const outBlocks = [];
let droppedCount = 0;
let rewrittenFk = 0;
let rewrittenEmailFn = 0;

for (const block of blocks) {
  const headerLine = block.find((l) => headerRe.test(l));
  const m = headerLine?.match(headerRe);
  if (!m) {
    outBlocks.push(block);
    continue;
  }
  const [, name, type] = m;
  const trimmedType = type.trim();

  if (DROP_TYPES.has(trimmedType)) {
    droppedCount++;
    continue;
  }
  if (trimmedType === 'FUNCTION' && DROP_FUNCTION_NAMES.has(name)) {
    droppedCount++;
    continue;
  }

  let text = block.join('\n');

  if (trimmedType === 'FK CONSTRAINT' && text.includes('auth.users(id)')) {
    text = text.replace(/auth\.users\(id\)/g, 'public.profiles(id)');
    rewrittenFk++;
  }

  if (trimmedType === 'FUNCTION' && EMAIL_FUNCTIONS.has(name)) {
    text = text.replace(/\s*SET search_path TO 'public', 'auth'\n/g, '\n').replace(/auth\.users/g, 'public.profiles');
    rewrittenEmailFn++;
  }

  outBlocks.push(text.split('\n'));
}

const out = outBlocks.map((b) => b.join('\n')).join('\n');
writeFileSync(outPath, out, 'utf8');
console.log(`blocos totais: ${blocks.length}, removidos: ${droppedCount}, FK reescritas: ${rewrittenFk}, funcoes de email reescritas: ${rewrittenEmailFn}`);
console.log(`arquivo limpo salvo: ${outPath} (${out.length} chars)`);
