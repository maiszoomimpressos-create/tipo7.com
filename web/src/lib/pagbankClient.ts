// Cliente HTTP base para a API do PagBank — tipo7.com
// Produção: https://api.pagseguro.com
//
// Referência: https://dev.pagbank.uol.com.br/reference

export const PAGBANK_BASE_URL = 'https://api.pagseguro.com'

// Headers obrigatórios em todas as requisições ao PagBank
export function pagbankHeaders(idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${process.env.PAGBANK_TOKEN}`,
    'Accept':        'application/json',
  }
  // Idempotência: previne cobranças duplicadas em caso de retry
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }
  return headers
}

// Erro estruturado do PagBank com código HTTP e corpo da resposta
export class PagBankError extends Error {
  constructor(
    public readonly status:  number,
    public readonly body:    unknown,
    message?: string,
  ) {
    super(message ?? `PagBank HTTP ${status}`)
    this.name = 'PagBankError'
  }
}

// Helper genérico de POST para a API do PagBank.
// Lança PagBankError se a resposta não for 2xx.
export async function pagbankPost<T = unknown>(
  path:            string,
  body:            unknown,
  idempotencyKey?: string,
): Promise<T> {
  const url = `${PAGBANK_BASE_URL}${path}`

  const res = await fetch(url, {
    method:  'POST',
    headers: pagbankHeaders(idempotencyKey),
    body:    JSON.stringify(body),
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new PagBankError(res.status, data)
  }

  return data as T
}
