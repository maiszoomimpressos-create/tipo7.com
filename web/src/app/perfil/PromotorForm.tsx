'use client'

// Dados de promotor. Toda pessoa já é, por padrão, uma organização própria
// (pessoa física, sem CNPJ) — não existe pergunta de "PF ou PJ" aqui.
// Atrelar um CNPJ é uma ação separada e opcional: só muda o que já existe
// (nome/CNPJ da organização), nunca uma escolha obrigatória de identidade.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Validação/formatação de CNPJ (mesma lógica de TipoPessoaModal.tsx) ──────
function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return false
  if (/^(\d)\1+$/.test(d)) return false
  const calc = (s: string, len: number) => {
    let sum = 0, pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(s[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    return r
  }
  return calc(d, 12) === parseInt(d[12]) && calc(d, 13) === parseInt(d[13])
}

const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

interface Initial {
  orgId:        string | null
  razaoSocial:  string
  cnpj:         string
  nomeFantasia: string
  codigo:       string | null
}

interface Props {
  userId:      string
  nomeUsuario: string
  initial:     Initial
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]'
const inpError = 'w-full bg-[#111] border border-red-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500/60 placeholder:text-[#383838]'

export function PromotorForm({ userId, nomeUsuario, initial }: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const [temCnpj,      setTemCnpj]      = useState(!!initial.cnpj)
  const [razaoSocial,  setRazaoSocial]  = useState(initial.razaoSocial || nomeUsuario)
  const [cnpj,         setCnpj]         = useState(initial.cnpj ? formatCNPJ(initial.cnpj) : '')
  const [cnpjErro,     setCnpjErro]     = useState<string | null>(null)
  const [nomeFantasia, setNomeFantasia] = useState(initial.nomeFantasia)

  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleCNPJBlur = () => {
    const digitos = cnpj.replace(/\D/g, '')
    if (!digitos) { setCnpjErro('CNPJ é obrigatório'); return }
    if (!validarCNPJ(cnpj)) { setCnpjErro('CNPJ inválido'); return }
    setCnpjErro(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false)

    let cnpjDigitos = ''
    if (temCnpj) {
      if (!razaoSocial.trim()) { setError('Informe a razão social.'); return }
      cnpjDigitos = cnpj.replace(/\D/g, '')
      if (!cnpjDigitos)          { setCnpjErro('CNPJ é obrigatório'); return }
      if (!validarCNPJ(cnpj))    { setCnpjErro('CNPJ inválido'); return }
    }
    setCnpjErro(null)

    setSaving(true)
    try {
      if (temCnpj) {
        const url = initial.orgId
          ? `/api/check-cnpj?cnpj=${cnpjDigitos}&exclude_org=${initial.orgId}`
          : `/api/check-cnpj?cnpj=${cnpjDigitos}`
        const check = await fetch(url).then(r => r.json()) as { exists: boolean }
        if (check.exists) {
          setError('Este CNPJ já está cadastrado por outra empresa na plataforma.')
          setSaving(false); return
        }
      }

      const dadosOrg = temCnpj
        ? { name: razaoSocial.trim(), cnpj: cnpjDigitos, nome_fantasia: nomeFantasia.trim() || null }
        : { name: nomeUsuario, cnpj: null, nome_fantasia: null }

      if (initial.orgId) {
        const { error: errUpdate } = await supabase
          .from('organizations').update(dadosOrg).eq('id', initial.orgId)
        if (errUpdate) throw errUpdate
      } else {
        const res = await fetch('/api/codigo?tipo=promotora')
        const { codigo } = await res.json() as { codigo: string }
        const { error: errInsert } = await supabase
          .from('organizations')
          .insert({ owner_id: userId, type: 'promotora', codigo, ...dadosOrg })
        if (errInsert) throw errInsert
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      router.refresh()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <h2 className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Dados de promotor
          </h2>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {initial.codigo
              ? <>Seu código: <span className="text-[#E8B84B] font-mono">{initial.codigo}</span></>
              : 'Define como seus eventos e ingressos são emitidos'}
          </p>
        </div>

        <div className="p-6 flex flex-col gap-5">

          <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Por padrão, seus eventos e ingressos são emitidos no seu nome, com seu CPF.
            Se você tem uma empresa, pode atrelar o CNPJ dela aqui.
          </p>

          {/* Atrelar CNPJ — ação opcional, não uma escolha de identidade */}
          <button type="button" onClick={() => setTemCnpj(v => !v)}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border text-left transition-all',
              temCnpj ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35' : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
            )}>
            <div className={cn(
              'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
              temCnpj ? 'bg-[#E8B84B] border-[#E8B84B]' : 'border-[#333]'
            )}>
              {temCnpj && <CheckCircle size={13} className="text-[#070707]" />}
            </div>
            <Building2 size={16} className={temCnpj ? 'text-[#E8B84B]' : 'text-[#444]'} />
            <div>
              <p className={cn('text-sm font-medium', temCnpj ? 'text-white' : 'text-[#777]')}
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>Atrelar um CNPJ</p>
              <p className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Tenho empresa e quero emitir em nome dela
              </p>
            </div>
          </button>

          {temCnpj && (
            <>
              <Field label="Razão social">
                <input type="text" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)}
                  placeholder="Razão social da empresa" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </Field>

              <Field label="CNPJ">
                <input type="text" value={cnpj}
                  onChange={e => { setCnpj(formatCNPJ(e.target.value)); setCnpjErro(null) }}
                  onBlur={handleCNPJBlur} maxLength={18} placeholder="00.000.000/0000-00"
                  className={cnpjErro ? inpError : inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                {cnpjErro && (
                  <p className="text-red-400 text-xs mt-1 pl-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{cnpjErro}</p>
                )}
              </Field>

              <Field label="Nome fantasia" optional>
                <input type="text" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)}
                  placeholder="Nome fantasia (opcional)" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </Field>
            </>
          )}

        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/8 border border-green-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <CheckCircle size={14} className="shrink-0" />
          Dados de promotor atualizados!
        </div>
      )}

      <button type="submit" disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
        {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar alterações'}
      </button>
    </form>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase flex justify-between" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <span>{label}</span>
        {optional && <span className="text-[#383838] normal-case tracking-normal">opcional</span>}
      </label>
      {children}
    </div>
  )
}
