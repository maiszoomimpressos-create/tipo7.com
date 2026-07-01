import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { Header }       from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { ContasClient } from './ContasClient'

export default async function ContasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/configuracoes/contas')

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  if (!orgs || orgs.length === 0) redirect('/criar-evento')

  const { data: contaMP } = await supabase
    .from('promotor_mp_accounts')
    .select('mp_user_id, mp_access_token, mp_public_key, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="max-w-2xl mx-auto px-4 py-12 w-full">

          <div className="mb-8">
            <h1
              className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
            >
              Contas de pagamento
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Conecte sua conta para receber os pagamentos dos seus eventos.
            </p>
          </div>

          <ContasClient contaAtual={contaMP ?? null} />

        </main>
      </PromoterLayout>
    </div>
  )
}
