// Cliente do RawBts PrintServer — app Windows que o operador instala no PC
// do caixa/portaria e que expõe uma API HTTP em http://localhost:8080.
// Só o navegador rodando NESSE MESMO PC alcança essa porta (é localhost),
// então este arquivo só faz sentido chamado do lado do cliente, num PC que
// já tenha o PrintServer.exe instalado e rodando.
//
// Por que isso existe em vez de Web Serial (lib/webSerialPrint.ts) ou
// impressão via driver do Windows (window.print()): o PrintServer resolve
// os dois problemas de uma vez só — ele já descobre sozinho impressora
// Bluetooth pareada (porta COM), impressora USB (porta serial) e impressora
// com driver do Windows instalado (envia RAW via winspool), tudo na mesma
// lista. E como é um processo Windows normal, ele mesmo cuida da
// auto-reconexão (watchdog interno) — o navegador não precisa pedir
// permissão de novo a cada sessão como o Web Serial exige.
//
// IMPORTANTE: a ESCOLHA de qual impressora usar acontece dentro do próprio
// painel do PrintServer (http://localhost:8080 tem sua própria UI de listar/
// clicar/conectar, servida pelo PrintServer.cs) — é um passo único de
// instalação (ver Instalar.bat), não algo repetido a cada venda. Este
// cliente só PERGUNTA se o app está rodando e MANDA imprimir; ele nunca
// precisa saber qual impressora está ativa, isso é responsabilidade do
// PrintServer.
//
// Fonte do PrintServer.exe: D:\PROJETOS ON LINE\rawbts (repositório
// separado). Instalador distribuído em
// /downloads/impressao/RawBtsPrintServer.zip (ver PrintServerPanel.tsx).

const BASE_URL = 'http://localhost:8080'

export interface StatusPrintServer {
  ok:        boolean
  connected: boolean
  printer:   string | null
  port:      string | null
  type:      string | null
  width:     string
  tries:     number
  charset:   'ascii' | 'cp850' | string
}

export interface TicketPrintServerPayload {
  charset?: 'ascii' | 'cp850'
  title:    string
  event?:   string
  date?:    string
  local?:   string
  sector?:  string
  buyer?:   string
  code?:    string
  price?:   string
  qr?:      string // conteúdo do QR — se omitido, o PrintServer usa `code`
}

// Timeout curto de propósito: é a forma de descobrir se o app está rodando
// no PC sem travar a UI esperando um `fetch` que nunca vai responder (porta
// fechada = a maioria dos navegadores demora vários segundos pra desistir
// de uma conexão TCP recusada/sem resposta em localhost).
async function fetchComTimeout(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function statusPrintServer(timeoutMs = 1200): Promise<StatusPrintServer | null> {
  try {
    const res = await fetchComTimeout('/status', { method: 'GET' }, timeoutMs)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Detecta se o RawBts PrintServer está rodando neste PC — usado pra decidir
// entre mostrar o status/atalho ou o CTA de instalação.
export async function printServerDisponivel(timeoutMs = 1200): Promise<boolean> {
  return (await statusPrintServer(timeoutMs)) !== null
}

// Imprime UM ingresso/ticket — o próprio PrintServer monta o cupom (título,
// dados do evento, QR) e envia ESC/POS pra impressora que o operador já
// deixou conectada no painel dele (localhost:8080). Pra imprimir vários de
// uma vez, chame esta função em sequência com um intervalo pequeno entre
// chamadas (impressoras clone baratas travam gerando QR em sequência rápida
// demais — mesma cautela documentada em rawbtPrint.ts).
export async function imprimirTicketPrintServer(payload: TicketPrintServerPayload): Promise<void> {
  const res = await fetchComTimeout('/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ charset: 'ascii', ...payload }),
  }, 8000)
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'Erro ao imprimir. Confira se a impressora está ligada e conectada no painel do PrintServer (localhost:8080).')
}

// Cupom de teste genérico (mode: 'escpos', o próprio PrintServer monta um
// cupom de amostra — ver BuildSample em PrintServer.cs) — usado pro operador
// confirmar a conexão física antes de começar a vender, sem precisar de
// dados de ingresso nenhum. Mesmo botão que o painel HTML nativo do
// PrintServer oferece em "Imprimir cupom de teste".
export async function imprimirTesteServidor(titulo?: string): Promise<void> {
  const res = await fetchComTimeout('/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'escpos', data: titulo }),
  }, 8000)
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'Erro ao imprimir teste. Confira se a impressora está ligada e conectada no painel do PrintServer (localhost:8080).')
}
