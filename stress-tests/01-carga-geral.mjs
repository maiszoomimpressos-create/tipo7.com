// TESTE 1 — Carga geral
// Simula muitos usuários acessando o site ao mesmo tempo.
// Testa endpoints públicos (sem autenticação): landing, busca, evento.
import { APP_URL, log } from './config.mjs'

const CONCORRENCIA = 50  // requisições simultâneas
const RODADAS      = 3   // quantas vezes repetir

const ENDPOINTS = [
  { label: 'Landing page',       url: APP_URL },
  { label: 'Listagem eventos',   url: `${APP_URL}/eventos` },
  { label: 'API destaque',       url: `${APP_URL}/api/eventos/destaque` },
  { label: 'API busca (vazio)',   url: `${APP_URL}/api/eventos/buscar?q=&cidade=S%C3%A3o+Paulo` },
  { label: 'API busca (música)', url: `${APP_URL}/api/eventos/buscar?q=musica` },
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
  'Accept':     'text/html,application/json,*/*',
}

async function medir(label, url) {
  const inicio = Date.now()
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) })
    return { label, ms: Date.now() - inicio, status: r.status, ok: r.ok }
  } catch (err) {
    return { label, ms: Date.now() - inicio, status: 0, ok: false, err: err.message }
  }
}

async function rodada(numero) {
  console.log(`\n  Rodada ${numero}/${RODADAS} — ${CONCORRENCIA} req simultâneas por endpoint`)
  const resultados = {}

  for (const { label, url } of ENDPOINTS) {
    // Dispara CONCORRENCIA requisições ao mesmo tempo para o mesmo endpoint
    const promises = Array.from({ length: CONCORRENCIA }, () => medir(label, url))
    const res = await Promise.all(promises)

    const ok     = res.filter(r => r.ok).length
    const erro   = res.filter(r => !r.ok).length
    const tempos = res.map(r => r.ms).sort((a, b) => a - b)
    const mediana = tempos[Math.floor(tempos.length / 2)]
    const p95    = tempos[Math.floor(tempos.length * 0.95)]
    const max    = tempos[tempos.length - 1]

    const emoji = erro === 0 ? '✅' : erro < 5 ? '⚠️' : '❌'
    log(emoji, label, `${ok}/${CONCORRENCIA} ok | mediana ${mediana}ms | p95 ${p95}ms | max ${max}ms`)
    resultados[label] = { ok, erro, mediana, p95, max }
  }
  return resultados
}

console.log('═'.repeat(60))
console.log('  TESTE 1 — CARGA GERAL')
console.log(`  ${CONCORRENCIA} usuários simultâneos × ${RODADAS} rodadas`)
console.log('═'.repeat(60))

const todas = []
for (let i = 1; i <= RODADAS; i++) {
  todas.push(await rodada(i))
}

// Resumo geral
console.log('\n' + '─'.repeat(60))
console.log('  RESUMO FINAL (médias das rodadas)')
console.log('─'.repeat(60))
for (const { label } of ENDPOINTS) {
  const medianas = todas.map(r => r[label]?.mediana ?? 0)
  const media = Math.round(medianas.reduce((a, b) => a + b, 0) / medianas.length)
  const totalOk = todas.reduce((s, r) => s + (r[label]?.ok ?? 0), 0)
  const totalErr = todas.reduce((s, r) => s + (r[label]?.erro ?? 0), 0)
  const emoji = totalErr === 0 ? '✅' : '⚠️'
  log(emoji, label, `média ${media}ms | ${totalOk} ok, ${totalErr} erros (total ${CONCORRENCIA * RODADAS} req)`)
}
