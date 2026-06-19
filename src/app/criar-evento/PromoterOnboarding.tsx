'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, Home, User, Users, Loader2, Check, Plus, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

export interface SocioData {
  nome: string; cpf: string; telefone: string; email: string
}

export interface PromoterProfileData {
  id:          string
  tipo_pessoa: 'pf' | 'pj'
  tipo_espaco: 'proprio' | 'alugado'
  num_socios:  '1' | '2-5' | '6+'
  socios:      SocioData[]
}

interface Props {
  initialData?: PromoterProfileData
}

const socioVazio = (): SocioData => ({ nome: '', cpf: '', telefone: '', email: '' })
const baseInput  = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'

export function PromoterOnboarding({ initialData }: Props) {
  const { user } = useAuth()
  const supabase  = createClient()
  const isEdit    = !!initialData

  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj' | ''>(initialData?.tipo_pessoa ?? '')
  const [tipoEspaco, setTipoEspaco] = useState<'proprio' | 'alugado' | ''>(initialData?.tipo_espaco ?? '')
  const [numSocios,  setNumSocios]  = useState<'1' | '2-5' | '6+' | ''>(initialData?.num_socios ?? '')
  const [socios,     setSocios]     = useState<SocioData[]>(
    initialData?.socios?.length ? initialData.socios.map(s => ({
      ...s,
      cpf:      formatCPF(s.cpf),
      telefone: formatPhone(s.telefone),
    })) : [socioVazio()]
  )
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [erro,    setErro]    = useState<string | null>(null)

  const temSocios = numSocios === '2-5' || numSocios === '6+'
  const maxSocios = numSocios === '6+' ? 2 : 4

  const podeSalvar = !!tipoPessoa && !!tipoEspaco && !!numSocios && (
    !temSocios || socios.every(s => s.nome.trim() && s.cpf.replace(/\D/g,'').length === 11)
  )

  const addSocio    = () => { if (socios.length < maxSocios) setSocios(p => [...p, socioVazio()]) }
  const removeSocio = (i: number) => setSocios(p => p.filter((_, idx) => idx !== i))
  const editSocio   = (i: number, k: keyof SocioData, v: string) =>
    setSocios(p => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s))

  const handleSalvar = async () => {
    if (!user || !podeSalvar) return
    setSaving(true)
    setErro(null)
    setSaved(false)

    try {
      let promotorId: string

      if (isEdit && initialData) {
        // Atualiza o perfil existente
        const { error: e1 } = await supabase
          .from('promotor_profiles')
          .update({ tipo_pessoa: tipoPessoa, tipo_espaco: tipoEspaco, num_socios: numSocios })
          .eq('id', initialData.id)
        if (e1) throw e1
        promotorId = initialData.id

        // Remove sócios antigos e reinsere os novos
        await supabase.from('promotor_socios').delete().eq('promotor_id', promotorId)
      } else {
        // Insere novo perfil
        const { data: perfil, error: e1 } = await supabase
          .from('promotor_profiles')
          .insert({ user_id: user.id, tipo_pessoa: tipoPessoa, tipo_espaco: tipoEspaco, num_socios: numSocios })
          .select('id')
          .single()
        if (e1) throw e1
        promotorId = perfil.id
      }

      // Insere sócios se necessário
      if (temSocios) {
        const rows = socios
          .filter(s => s.nome.trim() && s.cpf.replace(/\D/g,'').length === 11)
          .map(s => ({
            promotor_id: promotorId,
            nome:     s.nome.trim(),
            cpf:      s.cpf.replace(/\D/g,''),
            telefone: s.telefone || null,
            email:    s.email    || null,
          }))
        if (rows.length) {
          const { error: e2 } = await supabase.from('promotor_socios').insert(rows)
          if (e2) throw e2
        }
      }

      setSaved(true)
      setTimeout(() => { setSaved(false); window.location.reload() }, 1200)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Cabeçalho de edição */}
      {isEdit && (
        <div className="flex items-center gap-2 text-[#555] text-xs mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <Pencil size={12} />
          Edite as informações abaixo e salve as alterações
        </div>
      )}

      {/* Pergunta 1 — PF ou PJ */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5">
        <p className="text-white text-sm font-medium mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Como você atua?
        </p>
        <p className="text-[#444] text-xs mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Define como os ingressos e documentos serão emitidos
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 'pf' as const, icon: User,      label: 'Pessoa física',   desc: 'Organizo em meu nome pessoal' },
            { value: 'pj' as const, icon: Building2, label: 'Pessoa jurídica', desc: 'Tenho empresa ou CNPJ'         },
          ]).map(({ value, icon: Icon, label, desc }) => (
            <button key={value} type="button" onClick={() => setTipoPessoa(value)}
              className={cn(
                'flex flex-col gap-2.5 p-4 rounded-xl border text-left transition-all duration-200',
                tipoPessoa === value
                  ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                  : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
              )}
            >
              <Icon size={17} className={tipoPessoa === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
              <div>
                <p className={cn('text-sm font-medium', tipoPessoa === value ? 'text-white' : 'text-[#777]')}
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pergunta 2 — Espaço próprio ou alugado */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5">
        <p className="text-white text-sm font-medium mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          O espaço do evento é...
        </p>
        <p className="text-[#444] text-xs mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Espaço próprio pode ser reutilizado em eventos futuros
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 'proprio' as const, icon: Home,      label: 'Espaço próprio', desc: 'Sou dono do local'              },
            { value: 'alugado' as const, icon: Building2, label: 'Espaço alugado', desc: 'Alugo ou parceiro com o espaço' },
          ]).map(({ value, icon: Icon, label, desc }) => (
            <button key={value} type="button" onClick={() => setTipoEspaco(value)}
              className={cn(
                'flex flex-col gap-2.5 p-4 rounded-xl border text-left transition-all duration-200',
                tipoEspaco === value
                  ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                  : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
              )}
            >
              <Icon size={17} className={tipoEspaco === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
              <div>
                <p className={cn('text-sm font-medium', tipoEspaco === value ? 'text-white' : 'text-[#777]')}
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pergunta 3 — Quantos sócios */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5">
        <p className="text-white text-sm font-medium mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Quantas pessoas são sócias?
        </p>
        <p className="text-[#444] text-xs mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Inclua todos que participam do negócio
        </p>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: '1'   as const, label: 'Só eu',     desc: 'Atuo sozinho'      },
            { value: '2-5' as const, label: '2 a 5',     desc: 'Pequena sociedade' },
            { value: '6+'  as const, label: '6 ou mais', desc: 'Grande equipe'     },
          ]).map(({ value, label, desc }) => (
            <button key={value} type="button"
              onClick={() => { setNumSocios(value); if (value === '1') setSocios([socioVazio()]) }}
              className={cn(
                'flex flex-col gap-2 p-4 rounded-xl border text-left transition-all duration-200',
                numSocios === value
                  ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                  : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
              )}
            >
              <Users size={16} className={numSocios === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
              <p className={cn('text-sm font-medium mt-0.5', numSocios === value ? 'text-white' : 'text-[#777]')}
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Sócios dinâmicos */}
      {temSocios && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Dados dos sócios
              </p>
              {numSocios === '6+' && (
                <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Cadastre os 2 principais agora — adicione os demais no painel depois
                </p>
              )}
            </div>
            {socios.length < maxSocios && (
              <button type="button" onClick={addSocio}
                className="flex items-center gap-1.5 text-xs text-[#E8B84B] hover:text-[#F0C96A] transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                <Plus size={13} />
                Adicionar sócio
              </button>
            )}
          </div>

          {socios.map((socio, i) => (
            <div key={i} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[#555] text-[11px] font-medium tracking-widest uppercase"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>Sócio {i + 1}</p>
                {socios.length > 1 && (
                  <button type="button" onClick={() => removeSocio(i)}
                    className="text-[#333] hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <input type="text" placeholder="Nome completo *" value={socio.nome}
                onChange={e => editSocio(i, 'nome', e.target.value)}
                className={baseInput} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              <input type="text" placeholder="CPF *" value={socio.cpf}
                onChange={e => editSocio(i, 'cpf', formatCPF(e.target.value))}
                className={baseInput} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              <input type="text" placeholder="Telefone" value={socio.telefone}
                onChange={e => editSocio(i, 'telefone', formatPhone(e.target.value))}
                className={baseInput} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              <input type="email" placeholder="E-mail" value={socio.email}
                onChange={e => editSocio(i, 'email', e.target.value)}
                className={baseInput} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          ))}
        </div>
      )}

      {erro && (
        <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>
      )}

      <button type="button" onClick={handleSalvar}
        disabled={!podeSalvar || saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 transition-all hover:brightness-110"
        style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" />
          : saved ? <><Check size={16} /><span>Salvo!</span></>
          : <span>{isEdit ? 'Salvar alterações' : 'Continuar para criar evento'}</span>
        }
      </button>
    </div>
  )
}
