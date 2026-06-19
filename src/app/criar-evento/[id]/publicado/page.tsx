import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { CheckCircle2, ExternalLink, CalendarPlus } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PublicadoPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: evento } = await supabase
    .from('events')
    .select('id, title, status, organizations(owner_id)')
    .eq('id', id)
    .single()

  if (!evento) notFound()

  const org = Array.isArray(evento.organizations)
    ? evento.organizations[0]
    : evento.organizations as { owner_id: string } | null
  if (!org || (org as { owner_id: string }).owner_id !== user.id) notFound()

  // Só exibe esta tela se o evento realmente foi publicado
  if (evento.status !== 'publicado') redirect(`/criar-evento/${id}/publicar`)

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center flex flex-col items-center gap-6">

          {/* Ícone de sucesso */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
               style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <CheckCircle2 size={40} className="text-green-400" />
          </div>

          <div>
            <h1 className="text-3xl text-white mb-2"
                style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
              Evento publicado!
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <span className="text-[#888]">{evento.title}</span> já está visível para compradores.
            </p>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-3 w-full">
            <a href={`/evento/${id}`}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
              <ExternalLink size={15} />
              Ver página do evento
            </a>
            <a href="/criar-evento"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#555] border border-[#1a1a1a] hover:text-white hover:border-[#333] transition-all"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <CalendarPlus size={15} />
              Criar outro evento
            </a>
          </div>

          {/* Link de compartilhamento */}
          <p className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Link do evento:{' '}
            <span className="text-[#555] select-all">
              {process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').split('.')[0]
                ? `tipo7.com/evento/${id}`
                : `localhost:3000/evento/${id}`}
            </span>
          </p>

        </div>
      </main>
    </div>
  )
}
