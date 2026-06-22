import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

// Retorna uma imagem PNG do QR code para o token informado.
// Usada nos emails — clientes de email não suportam data: URIs,
// mas suportam img src com URL absoluta.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) {
    return new NextResponse('Token inválido', { status: 400 })
  }

  const png = await QRCode.toBuffer(token, {
    width:  300,
    margin: 2,
    color: { dark: '#070707', light: '#ffffff' },
  })

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
