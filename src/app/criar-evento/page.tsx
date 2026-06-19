// Página de criação de evento
// Fluxo: perfil 100% completo → modal PF/PJ (1x, editável) → formulário de evento
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { Header }       from '@/components/layout/Header'
import { CriarEventoClient } from './CriarEventoClient'
import { AlertCircle, CheckCircle, ArrowRight, CalendarPlus } from 'lucide-react'

const CAMPOS_OBRIGATORIOS = [
  { campo: 'full_name',     label: 'Nome completo'      },
  { campo: 'phone',         label: 'Telefone'           },
  { campo: 'cpf',           label: 'CPF'                },
  { campo: 'birth_date',    label: 'Data de nascimento' },
  { campo: 'zip_code',      label: 'CEP'                },
  { campo: 'street',        label: 'Rua'                },
  { campo: 'street_number', label: 'Número'             },
  { campo: 'neighborhood',  label: 'Bairro'             },
  { campo: 'city',          label: 'Cidade'             },
  { campo: 'state',         label: 'Estado'             },
  { campo: 'address_type',  label: 'Tipo de residência' },
]

export default async function CriarEventoPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, cpf, birth_date, zip_code, street, street_number, neighborhood, city, state, address_type')
    .eq('id', user.id)
    .single()

  const faltando       = CAMPOS_OBRIGATORIOS.filter(({ campo }) => !profile?.[campo as keyof typeof profile])
  const perfilCompleto = faltando.length === 0

  const { data: promotorProfile } = await supabase
    .from('promotor_profiles')
    .select('id, tipo_pessoa')
    .eq('user_id', user.id)
    .single()

  // Busca a organização do usuário para listar rascunhos
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .eq('type', 'promotora')
    .maybeSingle()

  const { data: eventos } = org
    ? await supabase
        .from('events')
        .select('id, title, status, date_start, created_at')
        .eq('organization_id', org.id)
        .in('status', ['rascunho', 'publicado'])
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-16">

        {/* ── Perfil incompleto — bloqueia ── */}
        {!perfilCompleto && (
          <div>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                   style={{ background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)' }}>
                <CalendarPlus size={28} className="text-[#E8B84B]/50" />
              </div>
              <h1 className="text-2xl text-white mb-2"
                  style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
                Complete seu cadastro primeiro
              </h1>
              <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Para criar eventos, seu perfil precisa estar 100% preenchido.
              </p>
            </div>

            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden mb-6">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[#141414]">
                <AlertCircle size={14} className="text-[#E8B84B]" />
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {faltando.length} {faltando.length === 1 ? 'campo faltando' : 'campos faltando'}
                </p>
              </div>
              <div className="divide-y divide-[#111]">
                {CAMPOS_OBRIGATORIOS.map(({ campo, label }) => {
                  const ok = !!profile?.[campo as keyof typeof profile]
                  return (
                    <div key={campo} className="flex items-center gap-3 px-5 py-3">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={`text-sm ${ok ? 'text-[#555]' : 'text-[#bbb]'}`}
                            style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
                      {ok && <CheckCircle size={12} className="text-green-500 ml-auto" />}
                    </div>
                  )
                })}
              </div>
            </div>

            <a href="/perfil"
               className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
               style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
              Completar meu cadastro
              <ArrowRight size={15} />
            </a>
          </div>
        )}

        {/* ── Perfil completo — botão + modal + eventos ── */}
        {perfilCompleto && (
          <CriarEventoClient
            promotorId={promotorProfile?.id ?? null}
            tipoPessoaAtual={(promotorProfile?.tipo_pessoa ?? null) as 'pf' | 'pj' | null}
            nomeUsuario={profile?.full_name ?? 'Promotor'}
            eventos={(eventos ?? []).map(e => ({
              id:         e.id,
              title:      e.title ?? 'Novo evento',
              status:     e.status as 'rascunho' | 'publicado',
              date_start: e.date_start ?? null,
              created_at: e.created_at,
            }))}
          />
        )}

      </main>
    </div>
  )
}
