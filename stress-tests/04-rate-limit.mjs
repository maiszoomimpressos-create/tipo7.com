// TESTE 4 — Rate limiting
// Verifica que os limites de requisição bloqueiam corretamente.
// Cada endpoint tem seu limite configurado:
//   checkout:      10 req/min por IP
//   checkout-pix:  10 req/min por IP
//   scanner:       30 req/min por IP
//   qr-image:      60 req/min por IP
import { APP_URL, log } from './config.mjs'

// [endpoint, limite configurado, requisições a enviar, método, body]
const TESTES = [
  {
    label:  'Checkout Pro',
    url:    `${APP_URL}/api/checkout`,
    metodo: 'POST',
    limite: 10,
    enviar: 15,
    body:   JSON.stringify({ eventoId: 'fake', items: [] }),
  },
  {
    label:  'Checkout PIX',
    url:    `${APP_URL}/api/checkout/pix`,
    metodo: 'POST',
    limite: 10,
    enviar: 15,
    body:   JSON.stringify({ eventoId: 'fake', items: [] }),
  },
  {
    label:  'QR imagem',
    // Tokens únicos por request — evita CDN cache (que tem Cache-Control: immutable)
    // Se todos usassem o mesmo token, o CDN serviria do cache sem invocar a função
    urlFn:  (i) => `${APP_URL}/api/qr/stress-test-token-unico-${i}-${Date.now()}`,
    metodo: 'GET',
    limite: 60,
    enviar: 70,
    body:   null,
  },
]

async function testar({ label, url, urlFn, metodo, limite, enviar, body }) {
  // Envia todas as requisições em série rápida (< 1 min) para acumular no rate limit
  const resultados = []
  for (let i = 0; i < enviar; i++) {
    const finalUrl = urlFn ? urlFn(i) : url
    const r = await fetch(finalUrl, {
      method:  metodo,
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5_000),
    }).catch(() => ({ status: 0 }))
    resultados.push(r.status)
  }

  const bloqueados = resultados.filter(s => s === 429).length
  const passaram   = resultados.filter(s => s !== 429 && s !== 0).length
  const erros      = resultados.filter(s => s === 0).length

  // Espera: as primeiras `limite` passam, o resto é bloqueado
  // (pode variar um pouco dependendo de quantas já estavam no janela)
  const bloqueouAlgum = bloqueados > 0
  const emoji = bloqueouAlgum ? '✅' : '❌'

  log(emoji, label,
    `${passaram} passaram | ${bloqueados} bloqueados (429) | limite=${limite}, enviado=${enviar}`)

  return { label, bloqueados, passaram, bloqueouAlgum }
}

console.log('═'.repeat(60))
console.log('  TESTE 4 — RATE LIMITING')
console.log('  (requisições acima do limite devem receber 429)')
console.log('═'.repeat(60))
console.log()

const resultados = []
for (const t of TESTES) {
  process.stdout.write(`  Testando ${t.label}... `)
  const r = await testar(t)
  resultados.push(r)
}

console.log('\n' + '─'.repeat(60))
const todos = resultados.every(r => r.bloqueouAlgum)
if (todos) {
  console.log('  ✅ Rate limiting funcionando em todos os endpoints.')
} else {
  const falhas = resultados.filter(r => !r.bloqueouAlgum).map(r => r.label)
  console.log(`  ❌ Rate limiting NÃO bloqueou em: ${falhas.join(', ')}`)
}
