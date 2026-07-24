'use client'

// Banner de "perfil incompleto" no topo da página de perfil.
// Recebe a lista calculada no servidor (evita flash vazio no primeiro
// carregamento) mas passa a usar o hook client assim que ele resolver,
// para refletir na hora qualquer campo salvo via ProfileForm.
import { AlertCircle } from 'lucide-react'
import { useProfileStatus } from '@/hooks/useProfileStatus'

export function PerfilBanner({ initialFaltando }: { initialFaltando: string[] }) {
  const { camposFaltando, carregando } = useProfileStatus()

  const labels = carregando ? initialFaltando : camposFaltando.map(c => c.label)

  if (labels.length === 0) return null

  return (
    <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-2xl px-5 py-4 mb-6">
      <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-red-400 text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Complete seu perfil para aproveitar todos os recursos
        </p>
        <p className="text-red-400/60 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Faltam: {labels.join(', ')}
        </p>
      </div>
    </div>
  )
}
