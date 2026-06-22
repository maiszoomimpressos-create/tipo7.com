import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TicketEmailInfo = {
  ticket_name: string
  slot_number: number
  qr_token:    string
}

export type EventEmailInfo = {
  title:      string
  date_start: string | null
  venue_name: string | null
  city:       string | null
  state:      string | null
  banner_url: string | null
}

// ---------------------------------------------------------------------------
// Formata data em português
// ---------------------------------------------------------------------------

function formatDatePT(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })
}

// ---------------------------------------------------------------------------
// Template HTML do email
// ---------------------------------------------------------------------------

function buildHTML({
  buyerName,
  event,
  tickets,
}: {
  buyerName: string
  event:     EventEmailInfo
  tickets:   TicketEmailInfo[]
}) {
  const dateStr   = event.date_start ? formatDatePT(event.date_start) : null
  const location  = [event.venue_name, event.city, event.state].filter(Boolean).join(' · ')

  const ticketBlocks = tickets.map(t => {
    const qrUrl = `${APP_URL}/api/qr/${t.qr_token}`
    return `
      <tr>
        <td style="padding: 20px 0; border-bottom: 1px solid #f0f0f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle;">
                <p style="margin: 0 0 2px; font-size: 11px; color: #999; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${t.ticket_name}
                </p>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111; font-family: Arial, sans-serif;">
                  Portador ${t.slot_number}
                </p>
              </td>
              <td style="vertical-align: middle; text-align: right; width: 120px;">
                <img
                  src="${qrUrl}"
                  alt="QR Code ingresso"
                  width="110"
                  height="110"
                  style="display: block; margin-left: auto; border-radius: 8px;"
                />
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
  }).join('')

  const bannerBlock = event.banner_url
    ? `<img src="${event.banner_url}" alt="${event.title}" width="560" style="display:block; width:100%; border-radius: 12px 12px 0 0; max-height: 220px; object-fit: cover;" />`
    : ''

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family: Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">

        <!-- Card principal -->
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- Banner do evento -->
          ${bannerBlock ? `<tr><td>${bannerBlock}</td></tr>` : ''}

          <!-- Header dourado -->
          <tr>
            <td style="background: #E8B84B; padding: 20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0; font-size: 22px; font-weight: 800; color: #070707; letter-spacing: -0.5px;">
                      tipo<span style="color:#070707;">7</span>
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <p style="margin:0; font-size: 12px; font-weight: 600; color: rgba(7,7,7,0.6); text-transform: uppercase; letter-spacing: 1px;">
                      Ingresso confirmado ✓
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding: 28px 28px 0;">
              <p style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #111;">
                Olá, ${buyerName.split(' ')[0]}!
              </p>
              <p style="margin: 0; font-size: 14px; color: #666;">
                Seu pagamento foi confirmado. Veja seus ingressos abaixo.
              </p>
            </td>
          </tr>

          <!-- Dados do evento -->
          <tr>
            <td style="padding: 20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; border-radius: 12px; padding: 16px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px; font-size: 17px; font-weight: 700; color: #111;">${event.title}</p>
                    ${dateStr ? `<p style="margin: 0 0 3px; font-size: 13px; color: #555;">📅 ${dateStr}</p>` : ''}
                    ${location ? `<p style="margin: 0; font-size: 13px; color: #555;">📍 ${location}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ingressos + QR codes -->
          <tr>
            <td style="padding: 0 28px 28px;">
              <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: 0.5px;">
                Seus ingressos
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${ticketBlocks}
              </table>
            </td>
          </tr>

          <!-- Botão ver ingressos -->
          <tr>
            <td style="padding: 0 28px 28px; text-align: center;">
              <a
                href="${APP_URL}/meus-ingressos"
                style="display: inline-block; background: #E8B84B; color: #070707; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px;"
              >
                Ver meus ingressos
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; border-top: 1px solid #f0f0f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #aaa;">
                Apresente o QR code na entrada do evento.<br/>
                Em caso de dúvidas, acesse <a href="${APP_URL}" style="color: #E8B84B;">tipo7.com</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `
}

// ---------------------------------------------------------------------------
// Função principal de envio
// ---------------------------------------------------------------------------

export async function sendTicketEmail({
  to,
  buyerName,
  event,
  tickets,
}: {
  to:        string
  buyerName: string
  event:     EventEmailInfo
  tickets:   TicketEmailInfo[]
}) {
  await resend.emails.send({
    from:    'Tipo7 <ingressos@tipo7.com>',
    to:      [to],
    subject: `✅ Seus ingressos para ${event.title}`,
    html:    buildHTML({ buyerName, event, tickets }),
  })
}
