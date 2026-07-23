export interface TarifaEstacionamento {
  cobra_modo:            'gratis' | 'fixo' | 'por_tempo'
  preco_fixo:            number | null
  preco_primeira_hora:   number | null
  preco_hora_adicional:  number | null
  teto_diario:           number | null
  tolerancia_minutos:    number
}

// Calcula o valor a cobrar por uma sessão de estacionamento.
// Usado tanto no preview do cliente quanto (de forma autoritativa) no servidor.
export function calcularValorEstacionamento(
  config:    TarifaEstacionamento,
  entradaEm: string | Date,
  saidaEm:   string | Date,
): number {
  if (config.cobra_modo === 'gratis') return 0
  if (config.cobra_modo === 'fixo')   return Number(config.preco_fixo ?? 0)

  // por_tempo
  const entrada  = new Date(entradaEm).getTime()
  const saida    = new Date(saidaEm).getTime()
  const minutos  = Math.max(0, Math.round((saida - entrada) / 60_000))

  if (minutos <= config.tolerancia_minutos) return 0

  const primeiraHora  = Number(config.preco_primeira_hora  ?? 0)
  const horaAdicional = Number(config.preco_hora_adicional ?? 0)

  let valor: number
  if (minutos <= 60) {
    valor = primeiraHora
  } else {
    const horasExtras = Math.ceil((minutos - 60) / 60)
    valor = primeiraHora + horasExtras * horaAdicional
  }

  const teto = config.teto_diario != null ? Number(config.teto_diario) : null
  if (teto != null && valor > teto) valor = teto

  return valor
}
