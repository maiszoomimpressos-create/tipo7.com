import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { SegundaTelaClient } from './SegundaTelaClient'

interface Props {
  params: Promise<{ eventoId: string; caixaId: string }>
}

interface SegundaTelaApi {
  eventoTitle: string
  slides: { id: string; image_url: string }[]
  eventosProximos: { id: string; title: string; date_start: string | null; local: string | null; cover_url: string | null }[]
}

// Escopado por CAIXA desde 09/08/2026 (pedido do usuário) — antes era só
// por evento, e 2 caixas vendendo o mesmo evento ao mesmo tempo misturavam
// as vendas na mesma Segunda Tela. Ver bilheteria-stream.service.ts.
export default async function SegundaTelaPage({ params }: Props) {
  const { eventoId, caixaId } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/segunda-tela/${eventoId}/${caixaId}`)

  // GET /carrossel/segunda-tela/:eventoId (Fase 7.2, G11) — slides da
  // organização DO EVENTO + fallback de próximos eventos publicados,
  // bug de is_published/cover_url corrigido na origem. Isso continua por
  // evento (carrossel de divulgação, nada a ver com o stream de vendas).
  const res = await apiFetchServer(`/api/carrossel/segunda-tela/${eventoId}`)
  const data: SegundaTelaApi = res.ok
    ? await res.json()
    : { eventoTitle: 'Evento', slides: [], eventosProximos: [] }

  return (
    <SegundaTelaClient
      eventoId={eventoId}
      caixaId={caixaId}
      eventoTitle={data.eventoTitle}
      slides={data.slides}
      eventosProximos={data.eventosProximos}
    />
  )
}
