// Monta o corpo da requisição de ordem PIX para o PagBank.
// Documentação: https://dev.pagbank.uol.com.br/reference/criar-pedido

export interface PagBankPixParams {
  amount:          number  // valor em R$ (decimal) — será convertido para centavos
  description:     string  // nome do item (ex.: "Ingressos - Show XYZ")
  referenceId:     string  // orderId do sistema — PagBank devolve no webhook
  buyerName:       string
  buyerCpf:        string  // apenas dígitos, sem formatação
  buyerEmail:      string
  notificationUrl: string  // URL onde o PagBank enviará os webhooks
  expiresAt:       string  // ISO 8601 — quando o QR PIX expira
}

// Estrutura do corpo aceita pelo endpoint POST /orders do PagBank
export interface PagBankPixOrder {
  reference_id:     string
  customer: {
    name:   string
    email:  string
    tax_id: string  // CPF sem formatação
  }
  items: Array<{
    name:        string
    quantity:    number
    unit_amount: number  // centavos
  }>
  qr_codes: Array<{
    amount: { value: number }     // centavos
    expiration_date: string       // ISO 8601
  }>
  notification_urls: string[]
}

// Constrói o body de uma ordem PIX para o PagBank.
// amount é recebido em R$ e convertido para centavos internamente.
export function buildPagBankPixOrder(params: PagBankPixParams): PagBankPixOrder {
  const {
    amount,
    description,
    referenceId,
    buyerName,
    buyerCpf,
    buyerEmail,
    notificationUrl,
    expiresAt,
  } = params

  // PagBank exige valores inteiros em centavos
  const centavos = Math.round(amount * 100)

  return {
    reference_id: referenceId,
    customer: {
      name:   buyerName,
      email:  buyerEmail,
      tax_id: buyerCpf,
    },
    items: [
      {
        name:        description.slice(0, 255),
        quantity:    1,
        unit_amount: centavos,
      },
    ],
    qr_codes: [
      {
        amount:          { value: centavos },
        expiration_date: expiresAt,
      },
    ],
    notification_urls: [notificationUrl],
  }
}
