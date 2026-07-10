// Retorna a chave pública RSA para o QZ Tray confiar no tipo7.com
const PUBLIC_KEY = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAmNiOVvSIM7d/SWYdnRM6+FK5xtA1vh/Z/Q++txGtleaAq1LxWh5A
AuZ+Ec9fdrXzT0fR0o4jwV5G4pIjHPQVuapUX5mqZPUt+YWRsqlfgz7R1gREuW4U
vRPcz0KadDkvRMwCWBcTx8OhlAkGo4x74Nx8EbL/oZyBcj94VNCzEc9TNPsfXKr2
HpxthbIksdd5JxW+v+s4SnorVEnr1nULWP58VvAL3Swc08qQUFa/QO242MnmZ90U
xJ/GxoxgmsOmuXcF5VaXcAC94Yjaq0e01xmK5/dPBzy94TBtXYHxnzVLPHX1zsMr
GkuBi2fFwZNDscoF794CQ0C/bDlGPfcoBwIDAQAB
-----END RSA PUBLIC KEY-----`

export async function GET() {
  return new Response(PUBLIC_KEY, {
    headers: {
      'Content-Type': 'application/x-pem-file',
      'Content-Disposition': 'attachment; filename="tipo7-qztray.pem"',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
