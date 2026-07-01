// TESTE 3 — Race condition no checkout (overselling)
// Verifica que com 1 ingresso disponível e N compradores simultâneos,
// apenas 1 pedido é aprovado. Testa a RPC criar_pedido_atomico.
import { SUPABASE_URL, SERVICE_ROLE_KEY, sql, log } from './config.mjs'

const COMPRADORES  = 15  // usuários tentando comprar ao mesmo tempo
const QTD_INGRESSOS = 1  // apenas 1 ingresso disponível

const TEST_ORG_ID    = '22222222-0000-0000-0000-000000000001'
const TEST_EVENT_ID  = '22222222-0000-0000-0000-000000000002'
const TEST_TICKET_ID = '22222222-0000-0000-0000-000000000003'

// Usa um user_id real (orders tem FK para profiles)
// Todos os compradores usam o mesmo user — o que importa é a atomicidade do estoque
const REAL_USER_ID = 'de5e1061-780c-4401-8d48-a907621025e3'
const USERS = Array.from({ length: COMPRADORES }, () => REAL_USER_ID)

async function setup() {
  await sql(`
    INSERT INTO organizations (id, name, type, owner_id)
    VALUES ('${TEST_ORG_ID}', 'Teste Checkout Race', 'promotora', NULL)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO events (id, organization_id, title, date_start, city, state, status)
    VALUES ('${TEST_EVENT_ID}', '${TEST_ORG_ID}', 'Evento Checkout Race', NOW(), 'SP', 'SP', 'publicado')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO event_tickets (id, event_id, name, price, quantity, order_index)
    VALUES ('${TEST_TICKET_ID}', '${TEST_EVENT_ID}', 'VIP', 100, ${QTD_INGRESSOS}, 1)
    ON CONFLICT (id) DO UPDATE SET quantity = ${QTD_INGRESSOS};

    -- Remove pedidos anteriores do teste (limpeza de execução anterior)
    DELETE FROM orders WHERE event_id = '${TEST_EVENT_ID}';
  `)
}

async function cleanup() {
  await sql(`DELETE FROM organizations WHERE id = '${TEST_ORG_ID}';`)
}

// Chama a RPC criar_pedido_atomico como se fosse o checkout
async function tentarComprar(userId) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/criar_pedido_atomico`
  const r = await fetch(url, {
    method:  'POST',
    headers: {
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      p_user_id:  userId,
      p_event_id: TEST_EVENT_ID,
      p_items:    [{ ticket_id: TEST_TICKET_ID, quantity: 1, unit_price: 100 }],
    }),
  })
  return r.json()
}

console.log('═'.repeat(60))
console.log('  TESTE 3 — RACE CONDITION NO CHECKOUT (OVERSELLING)')
console.log(`  ${COMPRADORES} compradores simultâneos, ${QTD_INGRESSOS} ingresso disponível`)
console.log('═'.repeat(60))

console.log('\n  Criando dados de teste...')
await setup()

console.log(`\n  Disparando ${COMPRADORES} compras ao mesmo tempo...`)
const inicio = Date.now()
const resultados = await Promise.all(USERS.map(tentarComprar))
const duracao = Date.now() - inicio

const sucessos    = resultados.filter(r => r?.order_id).length
const semEstoque  = resultados.filter(r => r?.error === 'sem_estoque').length
// Supabase retorna { message, code } em erros de banco (FK, constraint, etc.)
const erros       = resultados.filter(r => (r?.error && r.error !== 'sem_estoque') || r?.message).length

console.log(`\n  Resultado em ${duracao}ms:`)
log(sucessos === QTD_INGRESSOS ? '✅' : '❌', 'Pedidos criados',    `${sucessos} (esperado: ${QTD_INGRESSOS})`)
log(semEstoque === COMPRADORES - QTD_INGRESSOS ? '✅' : '❌', 'Sem estoque',   `${semEstoque} (esperado: ${COMPRADORES - QTD_INGRESSOS})`)
log(erros === 0 ? '✅' : '⚠️', 'Erros inesperados', `${erros}`)

if (sucessos === QTD_INGRESSOS && semEstoque === COMPRADORES - QTD_INGRESSOS) {
  console.log('\n  ✅ PROTEÇÃO FUNCIONOU: exatamente 1 pedido criado, overselling prevenido.')
} else if (sucessos > QTD_INGRESSOS) {
  console.log(`\n  ❌ OVERSELLING DETECTADO: ${sucessos} pedidos para ${QTD_INGRESSOS} ingresso!`)
} else {
  console.log(`\n  ⚠️  Resultado inesperado: ${sucessos} sucessos, ${semEstoque} sem_estoque, ${erros} erros`)
}

// Mostra os order_ids criados
const pedidos = resultados.filter(r => r?.order_id).map(r => r.order_id)
if (pedidos.length) console.log(`\n  Order IDs criados: ${pedidos.join(', ')}`)

console.log('\n  Limpando dados de teste...')
await cleanup()
console.log('  Concluído.')
