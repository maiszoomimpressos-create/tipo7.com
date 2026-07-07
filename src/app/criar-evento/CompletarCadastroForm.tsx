'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, AlertCircle, CalendarPlus, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Formatadores ────────────────────────────────────────────────────────────────

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d.length ? `(${d}` : ''
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3)  return d
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`
}

const formatBirthDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`
}

const displayToISO = (display: string) => {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length < 4) return ''
  return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
}

const isoToDisplay = (iso: string | null) => {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const isValidCPF = (v: string) => {
  const d = v.replace(/\D/g,'')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i)
  let r = (s * 10) % 11; if (r >= 10) r = 0
  if (r !== +d[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i)
  r = (s * 10) % 11; if (r >= 10) r = 0
  return r === +d[10]
}

// ── Tipos ───────────────────────────────────────────────────────────────────────

type ProfileData = {
  full_name:     string | null
  phone:         string | null
  cpf:           string | null
  birth_date:    string | null
  zip_code:      string | null
  street:        string | null
  street_number: string | null
  neighborhood:  string | null
  city:          string | null
  state:         string | null
  address_type:  string | null
}

type Campo = { campo: keyof ProfileData; label: string }

interface Props {
  profile:  ProfileData
  faltando: Campo[]
  todos:    Campo[]
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/50 placeholder:text-[#383838] transition-colors'
const inpErr = 'w-full bg-[#111] border border-red-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500/60 placeholder:text-[#383838] transition-colors'

export function CompletarCadastroForm({ profile, faltando, todos }: Props) {
  const router  = useRouter()
  const supabase = createClient()

  // Estado dos campos — inicializa com o que já existe no perfil
  const [fullName,     setFullName]     = useState(profile.full_name     ?? '')
  const [phone,        setPhone]        = useState(profile.phone         ?? '')
  const [cpf,          setCpf]          = useState(profile.cpf           ? formatCPF(profile.cpf) : '')
  const [birthDate,    setBirthDate]    = useState(isoToDisplay(profile.birth_date))
  const [zipCode,      setZipCode]      = useState(profile.zip_code      ? formatCEP(profile.zip_code) : '')
  const [street,       setStreet]       = useState(profile.street        ?? '')
  const [streetNumber, setStreetNumber] = useState(profile.street_number ?? '')
  const [neighborhood, setNeighborhood] = useState(profile.neighborhood  ?? '')
  const [city,         setCity]         = useState(profile.city          ?? '')
  const [state,        setState]        = useState(profile.state         ?? '')
  const [addressType,  setAddressType]  = useState(profile.address_type  ?? '')

  const [cpfErro,    setCpfErro]    = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)

  const faltandoSet = new Set(faltando.map(f => f.campo))
  const precisa = (campo: keyof ProfileData) => faltandoSet.has(campo)

  // ── Auto-preenchimento de endereço via ViaCEP ──────────────────────────────
  const buscarCEP = async (valor: string) => {
    const digitos = valor.replace(/\D/g, '')
    if (digitos.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const d   = await res.json()
      if (!d.erro) {
        if (d.logradouro) setStreet(d.logradouro)
        if (d.bairro)     setNeighborhood(d.bairro)
        if (d.localidade) setCity(d.localidade)
        if (d.uf)         setState(d.uf)
      }
    } catch { /* ignore */ }
    finally { setCepLoading(false) }
  }

  const handleCEP = (v: string) => {
    const f = formatCEP(v)
    setZipCode(f)
    if (f.replace(/\D/g,'').length === 8) buscarCEP(f)
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  const handleSalvar = async () => {
    // Valida CPF se estava faltando
    if (precisa('cpf') && !isValidCPF(cpf)) {
      setCpfErro('CPF inválido')
      return
    }

    setSaving(true)
    setErro(null)
    try {
      const update: Partial<Record<string, string>> = {}

      if (precisa('full_name')     && fullName.trim())                 update.full_name     = fullName.trim()
      if (precisa('phone')         && phone)                           update.phone         = phone.replace(/\D/g,'')
      if (precisa('cpf')           && cpf)                             update.cpf           = cpf.replace(/\D/g,'')
      if (precisa('birth_date')    && birthDate) {
        const iso = displayToISO(birthDate)
        if (iso) update.birth_date = iso
      }
      if (precisa('zip_code')      && zipCode)                         update.zip_code      = zipCode.replace(/\D/g,'')
      if (precisa('street')        && street.trim())                   update.street        = street.trim()
      if (precisa('street_number') && streetNumber.trim())             update.street_number = streetNumber.trim()
      if (precisa('neighborhood')  && neighborhood.trim())             update.neighborhood  = neighborhood.trim()
      if (precisa('city')          && city.trim())                     update.city          = city.trim()
      if (precisa('state')         && state.trim())                    update.state         = state.trim().toUpperCase().slice(0,2)
      if (precisa('address_type')  && addressType)                     update.address_type  = addressType

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
      if (error) throw error

      // Recarrega a Server Component — se tudo estiver ok, abre o fluxo de evento
      router.refresh()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
             style={{ background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)' }}>
          <CalendarPlus size={28} className="text-[#E8B84B]/50" />
        </div>
        <h1 className="text-2xl text-white mb-2"
            style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
          Complete seu cadastro
        </h1>
        <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Preencha os {faltando.length} {faltando.length === 1 ? 'campo abaixo' : 'campos abaixo'} para criar eventos.
        </p>
      </div>

      {/* Card com checklist + formulário */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden mb-5">

        {/* Header do card */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#141414]">
          <AlertCircle size={14} className="text-[#E8B84B]" />
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {faltando.length} {faltando.length === 1 ? 'campo faltando' : 'campos faltando'}
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* ── Dados pessoais ── */}
          {(precisa('full_name') || precisa('phone') || precisa('cpf') || precisa('birth_date')) && (
            <div className="flex flex-col gap-3">
              <p className="text-[#444] text-[11px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Dados pessoais
              </p>

              {precisa('full_name') && (
                <input
                  type="text"
                  placeholder="Nome completo *"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className={inp}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              )}

              {precisa('phone') && (
                <input
                  type="tel"
                  placeholder="Telefone * (00) 00000-0000"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  className={inp}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              )}

              {precisa('cpf') && (
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="CPF * 000.000.000-00"
                    value={cpf}
                    onChange={e => { setCpf(formatCPF(e.target.value)); setCpfErro(null) }}
                    onBlur={() => { if (cpf && !isValidCPF(cpf)) setCpfErro('CPF inválido') }}
                    className={cpfErro ? inpErr : inp}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {cpfErro && <p className="text-red-400 text-xs mt-1 pl-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{cpfErro}</p>}
                </div>
              )}

              {precisa('birth_date') && (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Data de nascimento * DD/MM/AAAA"
                  value={birthDate}
                  onChange={e => setBirthDate(formatBirthDate(e.target.value))}
                  maxLength={10}
                  className={inp}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              )}
            </div>
          )}

          {/* ── Endereço ── */}
          {(precisa('zip_code') || precisa('street') || precisa('street_number') || precisa('neighborhood') || precisa('city') || precisa('state') || precisa('address_type')) && (
            <div className="flex flex-col gap-3">
              <p className="text-[#444] text-[11px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Endereço
              </p>

              {precisa('zip_code') && (
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="CEP * 00000-000"
                    value={zipCode}
                    onChange={e => handleCEP(e.target.value)}
                    className={inp}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {cepLoading && <Loader2 size={14} className="animate-spin text-[#E8B84B] absolute right-3.5 top-1/2 -translate-y-1/2" />}
                </div>
              )}

              {precisa('street') && (
                <input
                  type="text"
                  placeholder="Rua *"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  className={inp}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              )}

              <div className={cn('grid gap-3', (precisa('street_number') && precisa('neighborhood')) ? 'grid-cols-2' : 'grid-cols-1')}>
                {precisa('street_number') && (
                  <input
                    type="text"
                    placeholder="Número *"
                    value={streetNumber}
                    onChange={e => setStreetNumber(e.target.value)}
                    className={inp}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                )}
                {precisa('neighborhood') && (
                  <input
                    type="text"
                    placeholder="Bairro *"
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                    className={inp}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                )}
              </div>

              <div className={cn('grid gap-3', (precisa('city') && precisa('state')) ? 'grid-cols-3' : 'grid-cols-1')}>
                {precisa('city') && (
                  <input
                    type="text"
                    placeholder="Cidade *"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className={cn(inp, precisa('city') && precisa('state') ? 'col-span-2' : '')}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                )}
                {precisa('state') && (
                  <input
                    type="text"
                    placeholder="UF *"
                    value={state}
                    maxLength={2}
                    onChange={e => setState(e.target.value.toUpperCase())}
                    className={inp}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                )}
              </div>

              {precisa('address_type') && (
                <select
                  value={addressType}
                  onChange={e => setAddressType(e.target.value)}
                  className={cn(inp, 'cursor-pointer')}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  <option value="" disabled>Tipo de residência *</option>
                  <option value="residencial">Residencial</option>
                  <option value="comercial">Comercial</option>
                  <option value="outro">Outro</option>
                </select>
              )}
            </div>
          )}

          {/* ── Campos já preenchidos ── */}
          {todos.filter(({ campo }) => !faltandoSet.has(campo)).length > 0 && (
            <div className="pt-3 border-t border-[#141414]">
              <p className="text-[#333] text-[11px] uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Já preenchidos
              </p>
              <div className="flex flex-wrap gap-2">
                {todos.filter(({ campo }) => !faltandoSet.has(campo)).map(({ campo, label }) => (
                  <div key={campo} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                       style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <CheckCircle size={10} className="text-green-500" />
                    <span className="text-green-500 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3 mb-4"
             style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <AlertCircle size={14} className="shrink-0" />
          {erro}
        </div>
      )}

      <button
        type="button"
        onClick={handleSalvar}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all disabled:opacity-50"
        style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
      >
        {saving
          ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
          : <><span>Salvar e continuar</span><ArrowRight size={15} /></>
        }
      </button>
    </div>
  )
}
