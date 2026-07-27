// Integração com a Autosave — sistema externo (de outro projeto do mesmo
// dono) que centraliza dados de veículos por placa. O Tipo7 é só um cliente:
// consulta a placa pra pré-preencher modelo/cor na entrada do estacionamento,
// e manda de volta o que o atendente digitou, pra enriquecer a base deles.
//
// Nunca deve travar o fluxo de entrada do estacionamento — qualquer falha,
// timeout ou instabilidade da Autosave é engolida e tratada como "não achou".

const AUTOSAVE_TIMEOUT_MS = 3000

interface AutosaveVehicle {
  plate?:      string
  brand?:      string
  model?:      string
  color?:      string
  year?:       number | string
  type?:       string
  status?:     string
  owner_name?: string
}

export interface VeiculoConsultado {
  modelo: string | null
  cor:    string | null
}

function montarModelo(v: AutosaveVehicle): string | null {
  const partes = [v.brand, v.model].filter(Boolean)
  return partes.length > 0 ? partes.join(' ') : null
}

export interface AutosaveCustomer {
  external_id?:   string
  full_name?:     string
  email?:         string
  cpf?:           string
  phone?:         string
  rg?:            string
  birth_date?:    string
  zip_code?:      string
  street?:        string
  street_number?: string
  neighborhood?:  string
  city?:          string
  state?:         string
  complement?:    string
}

async function fetchComTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTOSAVE_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Consulta a placa na Autosave. Retorna null se não achou, se a Autosave
// estiver fora do ar, ou se as credenciais não estiverem configuradas —
// nunca lança erro, pra não travar o atendente digitando a entrada.
export async function buscarVeiculoPorPlaca(placa: string): Promise<VeiculoConsultado | null> {
  const baseUrl = process.env.AUTOSAVE_API_URL
  const apiKey  = process.env.AUTOSAVE_API_KEY
  if (!baseUrl || !apiKey) return null

  try {
    const res = await fetchComTimeout(
      `${baseUrl}/vehicles?plate=${encodeURIComponent(placa)}`,
      { headers: { 'x-api-key': apiKey } },
    )
    if (!res.ok) return null

    const data = await res.json() as { found?: boolean; vehicles?: AutosaveVehicle[] }
    if (!data.found || !data.vehicles?.length) return null

    // Placa é única — se vier mais de um resultado (busca por prefixo),
    // usa só o que bate exatamente.
    const exato = data.vehicles.find(v => v.plate?.toUpperCase() === placa.toUpperCase()) ?? data.vehicles[0]

    return { modelo: montarModelo(exato), cor: exato.color?.trim() || null }
  } catch {
    return null
  }
}

// Consulta um cliente por CPF na Autosave — usado no cadastro do Tipo7 pra
// pré-preencher dados de quem já tem cadastro em outro sistema do grupo.
// Retorna null em qualquer falha (Autosave fora do ar, não configurada, CPF
// não encontrado) — nunca lança erro.
export async function buscarClientePorCpf(cpf: string): Promise<AutosaveCustomer | null> {
  const baseUrl = process.env.AUTOSAVE_API_URL
  const apiKey  = process.env.AUTOSAVE_API_KEY
  if (!baseUrl || !apiKey) return null

  try {
    const res = await fetchComTimeout(
      `${baseUrl}/customers?cpf=${encodeURIComponent(cpf)}`,
      { headers: { 'x-api-key': apiKey } },
    )
    if (!res.ok) return null

    const data = await res.json() as { found?: boolean; customer?: AutosaveCustomer }
    if (!data.found || !data.customer) return null

    return data.customer
  } catch {
    return null
  }
}

// Manda o que o atendente registrou de volta pra Autosave (best-effort).
// Chamado depois que a entrada já foi registrada com sucesso — nunca deve
// impedir nem atrasar a resposta da API de entrada.
export function salvarVeiculoNaAutosave(dados: { placa: string; modelo: string; cor: string }): void {
  const baseUrl = process.env.AUTOSAVE_API_URL
  const apiKey  = process.env.AUTOSAVE_API_KEY
  if (!baseUrl || !apiKey) return

  fetchComTimeout(`${baseUrl}/vehicles`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body:    JSON.stringify({ plate: dados.placa, model: dados.modelo, color: dados.cor }),
  }).catch(() => {
    // Best-effort — se a Autosave estiver fora do ar, ignora.
  })
}
