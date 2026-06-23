import { createServiceClient } from '@/lib/supabase/server'

const STATUS_LABEL: Record<string, string> = {
  draft:     'Rascunho',
  published: 'Publicado',
  cancelled: 'Cancelado',
  finished:  'Encerrado',
}
const STATUS_COLOR: Record<string, string> = {
  draft:     '#555',
  published: '#4ade80',
  cancelled: '#f87171',
  finished:  '#60a5fa',
}

export default async function EventosPage() {
  const admin = createServiceClient()

  const { data: eventos } = await admin
    .from('events')
    .select(`
      id, title, status, date_start, city, state,
      organizations ( profiles ( full_name ) )
    `)
    .order('created_at', { ascending: false })

  const { data: vendas } = await admin
    .from('orders')
    .select('event_id, total')
    .eq('status', 'approved')

  const vendasPorEvento: Record<string, number> = {}
  for (const v of vendas ?? []) {
    vendasPorEvento[v.event_id] = (vendasPorEvento[v.event_id] ?? 0) + Number(v.total)
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Eventos
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Todos os eventos cadastrados na plataforma
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
              {['Evento', 'Promotor', 'Data', 'Status', 'Volume'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[#444] text-xs font-medium uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(eventos ?? []).map((ev, i) => {
              const orgRaw  = ev.organizations as unknown
              const org     = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { profiles: unknown } | null
              const profRaw = org?.profiles as unknown
              const profile = (Array.isArray(profRaw) ? profRaw[0] : profRaw) as { full_name: string | null } | null
              const status  = ev.status ?? 'draft'
              const total   = vendasPorEvento[ev.id] ?? 0

              return (
                <tr key={ev.id} style={{ borderBottom: i < (eventos?.length ?? 0) - 1 ? '1px solid #111' : 'none', background: '#070707' }}>
                  <td className="px-4 py-3 max-w-xs">
                    <a href={`/evento/${ev.id}`} target="_blank" rel="noreferrer"
                       className="text-white text-sm font-medium hover:text-[#E8B84B] transition-colors truncate block"
                       style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {ev.title ?? 'Sem título'}
                    </a>
                    {(ev.city || ev.state) && (
                      <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {[ev.city, ev.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {profile?.full_name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {ev.date_start ? new Date(ev.date_start).toLocaleDateString('pt-BR') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ color: STATUS_COLOR[status], background: `${STATUS_COLOR[status]}18`, fontFamily: 'var(--font-dm-sans)' }}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {total > 0 ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
