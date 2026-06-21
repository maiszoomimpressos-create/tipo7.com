// Endpoint temporário de diagnóstico — remover após resolver o problema PIX
import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.MP_ACCESS_TOKEN ?? 'NAO_DEFINIDO'

  try {
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `debug-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: 15.00,
        description: 'Teste PIX debug',
        payment_method_id: 'pix',
        payer: {
          email: 'mateieletronicos@gmail.com',
          first_name: 'Matei',
          last_name: 'Teste',
          identification: { type: 'CPF', number: '45612378955' },
        },
        external_reference: `debug-${Date.now()}`,
      }),
    })

    const data = await res.json()

    return NextResponse.json({
      token_prefix: token.slice(0, 20) + '...',
      mp_status: res.status,
      mp_response: data,
    })
  } catch (err) {
    return NextResponse.json({
      token_prefix: token.slice(0, 20) + '...',
      error: String(err),
    })
  }
}
