import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { Monitor, RefreshCw } from 'lucide-react'

interface CaixaAberto {
  id:           string
  nome:         string
  evento_id:    string
  evento_title: string
}

// Entrada "sem digitar nada" da Segunda Tela (pedido do usuário, 09/08/2026):
// loga com a MESMA conta que está com o caixa aberto em outro aparelho, o
// sistema acha sozinho qual caixa é e já manda pro lugar certo. Sem caixa
// aberto ainda (ex: segundo aparelho ligado antes do vendedor abrir o
// caixa dele), mostra aviso com botão de atualizar — não fica preso, só
// pede pra tentar de novo depois de abrir o caixa.
export default async function SegundaTelaEntradaPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/segunda-tela')

  const res = await apiFetchServer('/api/caixas/meus-abertos')
  const caixas: CaixaAberto[] = res.ok ? await res.json() : []

  if (caixas.length === 1) {
    redirect(`/segunda-tela/${caixas[0].evento_id}/${caixas[0].id}`)
  }

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-5">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)' }}
      >
        <Monitor size={28} className="text-[#E8B84B]/60" />
      </div>

      {caixas.length === 0 ? (
        <>
          <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Nenhum caixa seu aberto agora
          </h1>
          <p className="text-[#555] text-sm max-w-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Abra o caixa na Bilheteria primeiro (nesse aparelho ou em outro, com essa mesma conta) e volte aqui.
          </p>
          <a
            href="/segunda-tela"
            className="flex items-center gap-2 mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl"
            style={{ background: '#E8B84B', color: '#070707', fontFamily: 'var(--font-dm-sans)' }}
          >
            <RefreshCw size={14} />
            Atualizar
          </a>
        </>
      ) : (
        <>
          <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Qual caixa você quer exibir?
          </h1>
          <div className="flex flex-col gap-2.5 w-full max-w-sm mt-1">
            {caixas.map(c => (
              <a
                key={c.id}
                href={`/segunda-tela/${c.evento_id}/${c.id}`}
                className="flex flex-col items-start gap-0.5 px-4 py-3.5 rounded-xl text-left transition-colors hover:border-[#333]"
                style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
              >
                <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {c.nome}
                </span>
                <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {c.evento_title}
                </span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
