// TESTE 2 — Race condition no scanner
// Verifica que dois scanners não conseguem usar o mesmo ingresso duas vezes.
// Estratégia: cria um ingresso de teste, dispara N validações simultâneas
// via Supabase REST, conta quantas tiveram sucesso — deve ser exatamente 1.
import { SUPABASE_URL, SERVICE_ROLE_KEY, sql, supabaseHeaders, log } from './config.mjs'

const CONCORRENCIA = 20  // scanners simultâneos no mesmo ingresso

// IDs de teste (UUIDs fixos para facilitar limpeza)
const TEST_ORG_ID     = '11111111-0000-0000-0000-000000000001'
const TEST_EVENT_ID   = '11111111-0000-0000-0000-000000000002'
const TEST_USER_ID    = '11111111-0000-0000-0000-000000000003'
const TEST_ORDER_ID   = '11111111-0000-0000-0000-000000000004'
const TEST_ITEM_ID    = '11111111-0000-0000-0000-000000000005'
const TEST_TICKET_ID  = '11111111-0000-0000-0000-000000000006'
const TEST_QR_TOKEN   = 'stress-test-qr-token-race-condition-2026'

async function setup() {
  // Cria dados mínimos para o teste (ignora erros de conflito — pode já existir de execução anterior)
  await sql(`
    INSERT INTO organizations (id, name, type, owner_id)
    VALUES ('${TEST_ORG_ID}', 'Teste Race', 'promotora', NULL)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO events (id, organization_id, title, date_start, city, state, status)
    VALUES ('${TEST_EVENT_ID}', '${TEST_ORG_ID}', 'Evento Race Test', NOW(), 'SP', 'SP', 'publicado')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO event_tickets (id, event_id, name, price, quantity, order_index)
    VALUES ('${TEST_TICKET_ID}', '${TEST_EVENT_ID}', 'Pista', 50, 1, 1)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO orders (id, user_id, event_id, total, status)
    VALUES ('${TEST_ORDER_ID}', NULL, '${TEST_EVENT_ID}', 50, 'approved')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO order_items (id, order_id, ticket_id, quantity, unit_price)
    VALUES ('${TEST_ITEM_ID}', '${TEST_ORDER_ID}', '${TEST_TICKET_ID}', 1, 50)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tickets (id, order_id, order_item_id, slot_number, qr_token, status)
    VALUES ('${TEST_TICKET_ID}', '${TEST_ORDER_ID}', '${TEST_ITEM_ID}', 1, '${TEST_QR_TOKEN}', 'valid')
    ON CONFLICT (id) DO UPDATE SET status = 'valid';
  `)
}

async function cleanup() {
  await sql(`
    DELETE FROM organizations WHERE id = '${TEST_ORG_ID}';
  `)
}

// Tenta marcar o ingresso como 'used' somente se ainda estiver 'valid' (UPDATE atômico)
// Retorna true se conseguiu, false se já estava usado
async function tentarValidar() {
  const url = `${SUPABASE_URL}/rest/v1/tickets?id=eq.${TEST_TICKET_ID}&status=eq.valid`
  const r = await fetch(url, {
    method:  'PATCH',
    headers: supabaseHeaders(),
    body:    JSON.stringify({ status: 'used', validated_at: new Date().toISOString() }),
  })
  const data = await r.json()
  return Array.isArray(data) && data.length > 0
}

console.log('═'.repeat(60))
console.log('  TESTE 2 — RACE CONDITION DO SCANNER')
console.log(`  ${CONCORRENCIA} scanners simultâneos no mesmo ingresso`)
console.log('═'.repeat(60))

console.log('\n  Criando dados de teste...')
await setup()

// Executa N validações simultaneamente
console.log(`\n  Disparando ${CONCORRENCIA} validações ao mesmo tempo...`)
const inicio = Date.now()
const resultados = await Promise.all(
  Array.from({ length: CONCORRENCIA }, () => tentarValidar())
)
const duracao = Date.now() - inicio

const sucessos = resultados.filter(Boolean).length
const negados  = resultados.filter(r => !r).length

console.log(`\n  Resultado em ${duracao}ms:`)
log(sucessos === 1 ? '✅' : '❌', 'Entradas autorizadas', `${sucessos} (esperado: 1)`)
log(negados === CONCORRENCIA - 1 ? '✅' : '❌', 'Entradas negadas',    `${negados} (esperado: ${CONCORRENCIA - 1})`)

if (sucessos === 1) {
  console.log('\n  ✅ FIX FUNCIONOU: exatamente 1 entrada autorizada, todas as outras bloqueadas.')
} else if (sucessos === 0) {
  console.log('\n  ❌ ERRO: nenhuma entrada autorizada — algo deu errado no setup.')
} else {
  console.log(`\n  ❌ VULNERABILIDADE: ${sucessos} entradas autorizadas para o mesmo ingresso!`)
}

console.log('\n  Limpando dados de teste...')
await cleanup()
console.log('  Concluído.')
