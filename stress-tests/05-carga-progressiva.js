// TESTE 5 — Carga progressiva (k6)
// Simula usuários reais navegando no site: landing, busca, evento, checkout.
// Sobe de 100 → 1000 → 5000 VUs para achar o ponto de quebra.
//
// Interpretar os resultados:
//   http_req_duration p(95) < 2000ms = aceitável
//   http_req_failed   < 1%           = saudável
//   Acima disso = limite encontrado

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const falhas   = new Rate('requisicoes_com_erro')
const tempoApi = new Trend('tempo_api_ms', true)

export const options = {
  // Rampa progressiva: descobre o ponto de quebra sem explodir o servidor de vez
  stages: [
    { duration: '30s', target: 100  },   // aquece com 100 usuários
    { duration: '60s', target: 500  },   // 500 usuários por 1 min
    { duration: '60s', target: 1000 },   // 1.000 usuários por 1 min
    { duration: '60s', target: 2000 },   // 2.000 usuários por 1 min
    { duration: '60s', target: 5000 },   // pico: 5.000 usuários
    { duration: '30s', target: 0    },   // desacelera
  ],
  thresholds: {
    // Critérios de aprovação:
    http_req_duration:     ['p(95)<3000'],   // 95% das req < 3s
    requisicoes_com_erro:  ['rate<0.05'],    // menos de 5% de erro
  },
}

const BASE = 'https://www.tipo7.com'
const EVENTO_ID = '1452d42a-4fc2-4ad4-83d7-23b708aad09a'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
}

// Simula um usuário navegando no site (jornada realista)
export default function () {
  const inicio = Date.now()

  // 1. Acessa a landing page
  let r = http.get(`${BASE}/`, { headers: HEADERS })
  check(r, { 'landing 200': (r) => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(Math.random() * 2 + 1)  // pausa de 1-3s (como humano faria)

  // 2. Busca eventos (a API mais pesada)
  r = http.get(`${BASE}/api/eventos/destaque`, { headers: HEADERS })
  check(r, { 'destaque 200': (r) => r.status === 200 })
  falhas.add(r.status !== 200)
  tempoApi.add(Date.now() - inicio)
  sleep(Math.random() * 2 + 1)

  // 3. Abre a página do evento
  r = http.get(`${BASE}/evento/${EVENTO_ID}`, { headers: HEADERS })
  check(r, { 'evento 200': (r) => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(Math.random() * 3 + 2)  // lê a página por 2-5s

  // 4. Busca por texto (simula pesquisa)
  r = http.get(`${BASE}/api/eventos/buscar?q=festa&cidade=`, { headers: HEADERS })
  check(r, { 'busca 200': (r) => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(Math.random() * 1 + 0.5)
}
