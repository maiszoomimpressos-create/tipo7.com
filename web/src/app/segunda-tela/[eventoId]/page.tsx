import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ eventoId: string }>
}

// Resolvedor — acha sozinho qual caixa esse usuário tem aberto NESSE
// evento e já redireciona pra rota de verdade (/[eventoId]/[caixaId]),
// que é quem escuta o SSE escopado por caixa. Mantido por compatibilidade
// com quem ainda tem essa URL sem caixaId salva/em favoritos (mudança
// 09/08/2026 — antes a Segunda Tela era só por evento).
export default async function SegundaTelaResolverPage({ params }: Props) {
  const { eventoId } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/segunda-tela/${eventoId}`)

  const res = await apiFetchServer(`/api/eventos/${eventoId}/meu-caixa`)
  const caixa = res.ok ? await res.json() as { id: string; nome: string } | null : null

  if (caixa) redirect(`/segunda-tela/${eventoId}/${caixa.id}`)

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-4">
      <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
        Nenhum caixa seu aberto nesse evento
      </h1>
      <p className="text-[#555] text-sm max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Abra um caixa na Bilheteria primeiro, ou use o botão &quot;Segunda tela&quot; de dentro do caixa já aberto.
      </p>
      <a
        href={`/bilheteria/${eventoId}`}
        className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl"
        style={{ background: '#E8B84B', color: '#070707', fontFamily: 'var(--font-dm-sans)' }}
      >
        Ir pra Bilheteria
      </a>
    </div>
  )
}
