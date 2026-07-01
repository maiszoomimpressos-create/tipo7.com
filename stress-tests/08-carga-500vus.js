// Teste 8 — 500 VUs (empurra o limite da máquina local)
// Sobe progressivamente: 100 → 200 → 350 → 500 usuários simultâneos.
// ATENÇÃO: pode estressar a máquina local. Se travar, os dados até aquele ponto ainda são válidos.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const falhas    = new Rate('erros')
const tempoApi  = new Trend('tempo_api_ms', true)

export const options = {
  stages: [
    { duration: '20s', target: 100 },
    { duration: '30s', target: 200 },
    { duration: '30s', target: 350 },
    { duration: '30s', target: 500 },
    { duration: '20s', target: 0   },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    erros:             ['rate<0.05'],
  },
}

const BASE    = 'https://www.tipo7.com'
const EVENTO  = '1452d42a-4fc2-4ad4-83d7-23b708aad09a'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
  'Accept':     'text/html,application/json,*/*',
}

export default function () {
  let r
  const t0 = Date.now()

  r = http.get(`${BASE}/`, { headers: HEADERS })
  check(r, { 'landing 200': r => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(1 + Math.random() * 2)

  r = http.get(`${BASE}/api/eventos/destaque`, { headers: HEADERS })
  check(r, { 'destaque 200': r => r.status === 200 })
  falhas.add(r.status !== 200)
  tempoApi.add(Date.now() - t0)
  sleep(0.5 + Math.random())

  r = http.get(`${BASE}/evento/${EVENTO}`, { headers: HEADERS })
  check(r, { 'evento 200': r => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(2 + Math.random() * 2)

  r = http.get(`${BASE}/api/eventos/buscar?q=festa&cidade=`, { headers: HEADERS })
  check(r, { 'busca 200': r => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(0.5 + Math.random())
}
