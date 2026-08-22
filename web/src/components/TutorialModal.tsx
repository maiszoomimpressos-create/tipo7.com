'use client'

// Modal de tutorial (22/08/2026, pedido do usuário) — passo a passo de como
// montar um evento. Componente compartilhado — usado tanto em
// GerenciarSidebar.tsx (evento/[id]/gerenciar) quanto em AdminSidebar.tsx
// (painel da equipe Tipo7, mesmo conteúdo, botão sem destaque visual lá).
//
// Conteúdo editável (22/08/2026, pedido do usuário) SÓ pela tela de admin —
// Admin > Conteúdo > Tutorial de evento (ConteudoClient.tsx) — reaproveita
// a mesma tabela/rota `platform_content` já usada pra Termos/Privacidade/
// LGPD (key='tutorial_evento', content = JSON.stringify de TutorialPasso[]).
// Busca aqui é best-effort: se a chave ainda não existir ou o fetch falhar,
// cai no array padrão (TUTORIAL_PASSOS_PADRAO) — nunca quebra o modal.
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { TUTORIAL_ICONES, TUTORIAL_PASSOS_PADRAO, type TutorialPasso } from '@/lib/tutorialIcons'

const ACCENT = '#E8B84B'

export function TutorialModal({ onFechar }: { onFechar: () => void }) {
  const [passos, setPassos] = useState<TutorialPasso[]>(TUTORIAL_PASSOS_PADRAO)

  useEffect(() => {
    let cancelado = false
    apiFetchAuth('/api/admin/conteudo?key=tutorial_evento')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { content?: string } | null) => {
        if (cancelado || !data?.content) return
        const parsed = JSON.parse(data.content) as TutorialPasso[]
        if (Array.isArray(parsed) && parsed.length > 0) setPassos(parsed)
      })
      .catch(() => { /* mantém o padrão — best-effort */ })
    return () => { cancelado = true }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Como montar seu evento
          </p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          {passos.map((p, i) => {
            const Icon = TUTORIAL_ICONES[p.icone] ?? TUTORIAL_ICONES.Layers
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
                  style={{ background: `${ACCENT}15` }}
                >
                  <Icon size={13} style={{ color: ACCENT }} />
                  <span
                    className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-[#070707]"
                    style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {i + 1}
                  </span>
                </div>
                <div>
                  <p className="text-white text-xs font-semibold mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {p.titulo}
                  </p>
                  <p className="text-[#888] text-[11px] leading-snug" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {p.texto}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-4" style={{ borderTop: '1px solid #1a1a1a' }}>
          <button
            type="button"
            onClick={onFechar}
            className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
