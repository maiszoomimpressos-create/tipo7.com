import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { ShieldX  } from 'lucide-react'
import { ScannerClient } from './ScannerClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

interface MeuAcesso {
  evento: { id: string; title: string | null } | null
  isOwner: boolean
  staff: { permissions: string[] } | null
}

export default async function ScannerPage({ params }: Props) {
  const { eventoId } = await params

  // Exige login
  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/scanner/${eventoId}`)

  const [acessoRes, profileRes] = await Promise.all([
    apiFetchServer(`/api/eventos/${eventoId}/meu-acesso`),
    apiFetchServer('/api/profile'),
  ])

  const acesso: MeuAcesso = acessoRes.ok
    ? await acessoRes.json()
    : { evento: null, isOwner: false, staff: null }

  if (!acesso.evento) {
    return <SemPermissao mensagem="Evento não encontrado." />
  }

  const isStaff = (acesso.staff?.permissions ?? []).includes('validar_ingresso')

  if (!acesso.isOwner && !isStaff) {
    return <SemPermissao mensagem="Você não tem permissão para escanear ingressos neste evento." />
  }

  const profile = profileRes.ok ? await profileRes.json() as { full_name: string | null } : null
  const displayName = profile?.full_name ?? 'Operador'

  return (
    <ScannerClient
      eventoId={eventoId}
      eventoTitle={acesso.evento.title ?? 'Evento'}
      operadorName={displayName}
    />
  )
}

function SemPermissao({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
      >
        <ShieldX size={28} className="text-red-400" />
      </div>
      <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
        Acesso negado
      </h1>
      <p className="text-[#555] text-sm max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {mensagem}
      </p>
      <a
        href="/"
        className="mt-2 text-sm text-[#E8B84B] hover:underline"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        Voltar ao início
      </a>
    </div>
  )
}
