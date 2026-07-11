import { createSign } from 'crypto'

export async function POST(req: Request) {
  try {
    const { request } = await req.json()
    if (!request || typeof request !== 'string') {
      return Response.json({ error: 'invalid request' }, { status: 400 })
    }

    const pkB64 = process.env.QZTRAY_PRIVATE_KEY_B64
    if (!pkB64) {
      return Response.json({ error: 'signing key not configured' }, { status: 500 })
    }

    const privateKey = Buffer.from(pkB64, 'base64').toString('utf-8')
    const sign = createSign('SHA512')
    sign.update(request)
    const signature = sign.sign(privateKey, 'base64')

    return Response.json({ signature })
  } catch {
    return Response.json({ error: 'signing failed' }, { status: 500 })
  }
}
