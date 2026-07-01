// Teste limitado a 1.000 VUs — dentro da capacidade da máquina local.
// Resultados aqui são confiáveis. Para 10k+ VUs precisaria de infra distribuída.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const falhas = new Rate('erros')

export const options = {
  stages: [
    { duration: '20s', target: 200  },
    { duration: '40s', target: 500  },
    { duration: '40s', target: 1000 },
    { duration: '30s', target: 1000 },
    { duration: '20s', target: 0    },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    erros:             ['rate<0.05'],
  },
}

const BASE     = 'https://www.tipo7.com'
const EVENTO   = '1452d42a-4fc2-4ad4-83d7-23b708aad09a'
const HEADERS  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0' }

export default function () {
  let r

  r = http.get(`${BASE}/`, { headers: HEADERS })
  check(r, { 'landing ok': r => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(1 + Math.random() * 2)

  r = http.get(`${BASE}/api/eventos/destaque`, { headers: HEADERS })
  check(r, { 'destaque ok': r => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(0.5 + Math.random())

  r = http.get(`${BASE}/evento/${EVENTO}`, { headers: HEADERS })
  check(r, { 'evento ok': r => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(2 + Math.random() * 3)

  r = http.get(`${BASE}/api/eventos/buscar?q=festa`, { headers: HEADERS })
  check(r, { 'busca ok': r => r.status === 200 })
  falhas.add(r.status !== 200)
  sleep(0.5 + Math.random())
}
