'use client'

// Formulário completo do perfil — dados pessoais, endereço e foto de perfil
// Atualiza a tabela profiles e faz upload de avatar no Supabase Storage
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, AlertCircle, Camera, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlaceSuggestion {
  placeId: string
  nomePrincipal: string
  nomeSecundario: string
}

// ─── Formatadores ──────────────────────────────────────────────────────────────

// Formata telefone: (11) 99999-9999
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d.length ? `(${d}` : ''
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// Formata CPF: 123.456.789-00
const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3)  return d
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

// Formata CEP: 00000-000
const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0,5)}-${d.slice(5)}`
}

// Máscara DD/MM/AAAA para campo de data
const formatBirthDate = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

const isoToDisplay = (iso: string) => {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const displayToISO = (display: string) => {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length < 4) return ''
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}

// ─── Validadores ───────────────────────────────────────────────────────────────

// Valida CPF com algoritmo oficial
const isValidCPF = (v: string) => {
  const d = v.replace(/\D/g, '')
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

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Props {
  userId:  string
  initial: {
    // Dados pessoais
    full_name:    string
    phone:        string
    cpf:          string
    rg:           string
    birth_date:   string
    avatar_url:   string
    // Endereço
    zip_code:     string
    street:       string
    street_number: string
    neighborhood: string
    city:         string
    state:        string
    address_type: string   // 'casa' | 'apartamento' | ''
    complement:   string
  }
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function ProfileForm({ userId, initial }: Props) {
  const supabase = createClient()

  // ── Estado: dados pessoais ──
  const [name,      setName]      = useState(initial.full_name)
  const [phone,     setPhone]     = useState(formatPhone(initial.phone))
  const [cpf,       setCpf]       = useState(formatCPF(initial.cpf))
  const [rg,        setRg]        = useState(initial.rg)
  const [birthDate, setBirthDate] = useState(isoToDisplay(initial.birth_date ?? ''))

  // ── Estado: avatar ──
  const [avatarUrl,     setAvatarUrl]     = useState(initial.avatar_url ?? '')
  const [avatarPreview, setAvatarPreview] = useState(initial.avatar_url ?? '')  // preview local antes do upload
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Estado: endereço ──
  const [zipCode,      setZipCode]      = useState(formatCEP(initial.zip_code ?? ''))
  const [street,       setStreet]       = useState(initial.street       ?? '')
  const [streetNumber, setStreetNumber] = useState(initial.street_number ?? '')
  const [neighborhood, setNeighborhood] = useState(initial.neighborhood  ?? '')
  const [city,         setCity]         = useState(initial.city          ?? '')
  const [uf,           setUf]           = useState(initial.state         ?? '')
  const [addressType,  setAddressType]  = useState(initial.address_type  ?? '')  // 'casa' | 'apartamento' | ''
  const [complement,   setComplement]   = useState(initial.complement    ?? '')
  const [cepLoading,   setCepLoading]   = useState(false)
  const [cepError,     setCepError]     = useState<string | null>(null)

  // ── Estado: busca de endereço (Google Places) ──
  const [addrQuery,      setAddrQuery]      = useState('')
  const [addrSuggestions, setAddrSuggestions] = useState<PlaceSuggestion[]>([])
  const [addrSearching,  setAddrSearching]  = useState(false)
  const [showAddrDropdown, setShowAddrDropdown] = useState(false)
  const addrDropdownRef = useRef<HTMLDivElement>(null)
  const addrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Estado: feedback geral ──
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Busca endereço pelo CEP via ViaCEP ──────────────────────────────────────
  const buscarCEP = useCallback(async (cepFormatado: string) => {
    const cepDigitos = cepFormatado.replace(/\D/g, '')
    if (cepDigitos.length !== 8) return   // aguarda os 8 dígitos completos

    setCepLoading(true)
    setCepError(null)

    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cepDigitos}/json/`)
      const data = await res.json()

      if (data.erro) {
        // CEP não encontrado — exibe mensagem mas mantém campos editáveis
        setCepError('CEP não encontrado. Preencha o endereço manualmente.')
        return
      }

      // Preenche campos automaticamente com dados do ViaCEP
      setStreet(data.logradouro ?? '')
      setNeighborhood(data.bairro     ?? '')
      setCity(data.localidade ?? '')
      setUf(data.uf          ?? '')
    } catch {
      setCepError('Erro ao buscar o CEP. Verifique sua conexão.')
    } finally {
      setCepLoading(false)
    }
  }, [])

  // ── Fecha dropdown de endereço ao clicar fora ──────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addrDropdownRef.current && !addrDropdownRef.current.contains(e.target as Node))
        setShowAddrDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Busca sugestões de endereço no Google Places ────────────────────────────
  const buscarEnderecoSugestoes = useCallback((valor: string) => {
    if (addrDebounceRef.current) clearTimeout(addrDebounceRef.current)
    if (!valor || valor.length < 3) { setAddrSuggestions([]); setShowAddrDropdown(false); return }
    addrDebounceRef.current = setTimeout(async () => {
      setAddrSearching(true)
      try {
        const res  = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(valor)}`)
        const data = await res.json()
        setAddrSuggestions(data.suggestions ?? [])
        setShowAddrDropdown((data.suggestions ?? []).length > 0)
      } catch { setAddrSuggestions([]) }
      finally { setAddrSearching(false) }
    }, 350)
  }, [])

  // ── Ao selecionar um endereço, busca os detalhes e preenche os campos ───────
  const selecionarEndereco = async (s: PlaceSuggestion) => {
    setAddrQuery(s.nomePrincipal)
    setShowAddrDropdown(false)
    setAddrSuggestions([])
    try {
      const res  = await fetch(`/api/places/details?place_id=${s.placeId}`)
      const data = await res.json()
      if (data.cep)    { setZipCode(formatCEP(data.cep)); setCepError(null) }
      if (data.rua)    setStreet(data.rua)
      if (data.numero) setStreetNumber(data.numero)
      if (data.bairro) setNeighborhood(data.bairro)
      if (data.cidade) setCity(data.cidade)
      if (data.estado) setUf(data.estado.slice(0, 2).toUpperCase())
    } catch { /* usuário pode preencher manualmente */ }
  }

  // ── Manipula mudança no campo CEP ───────────────────────────────────────────
  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatCEP(e.target.value)
    setZipCode(formatado)
    setCepError(null)

    // Busca automática ao completar os 8 dígitos
    if (formatado.replace(/\D/g, '').length === 8) {
      buscarCEP(formatado)
    }
  }

  // ── Seleciona arquivo de avatar ─────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Valida tipo e tamanho (máx 2MB)
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']
    if (!tiposPermitidos.includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG ou WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Imagem muito grande. O limite é 2MB.')
      return
    }

    setError(null)
    setAvatarFile(file)

    // Gera preview imediato sem precisar fazer upload ainda
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Faz upload do avatar e retorna a URL pública ────────────────────────────
  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) return avatarUrl  // sem novo arquivo → mantém URL existente

    setUploadingAvatar(true)
    try {
      // Path: {userId}/avatar (sobrescreve o anterior automaticamente)
      const path = `${userId}/avatar`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })

      if (uploadError) throw uploadError

      // Pega a URL pública do arquivo enviado
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Adiciona timestamp para evitar cache antigo do browser
      return `${data.publicUrl}?t=${Date.now()}`
    } catch {
      throw new Error('Erro ao enviar a foto. Tente novamente.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // ── Validação do formulário ─────────────────────────────────────────────────
  const validate = () => {
    if (!name.trim() || name.trim().length < 3) return 'Nome deve ter no mínimo 3 caracteres.'
    if (phone && phone.replace(/\D/g,'').length < 10) return 'Telefone incompleto.'
    if (cpf && !isValidCPF(cpf)) return 'CPF inválido.'
    return null
  }

  // ── Salva tudo (perfil + endereço + avatar) ─────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    try {
      // 1. Faz upload do avatar (se selecionou um novo)
      const novaAvatarUrl = await uploadAvatar()

      // 2. Salva todos os dados no banco de uma vez
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          // Dados pessoais
          full_name:    name.trim(),
          phone:        phone.replace(/\D/g,'')   || null,
          cpf:          cpf.replace(/\D/g,'')     || null,
          rg:           rg.trim()                 || null,
          birth_date:   displayToISO(birthDate)    || null,
          avatar_url:   novaAvatarUrl             || null,
          // Endereço
          zip_code:     zipCode.replace(/\D/g,'') || null,
          street:       street.trim()             || null,
          street_number: streetNumber.trim()      || null,
          neighborhood: neighborhood.trim()       || null,
          city:         city.trim()               || null,
          state:        uf.toUpperCase()          || null,
          address_type: addressType               || null,
          complement:   complement.trim()         || null,
        })
        .eq('id', userId)

      if (dbError) { setError('Erro ao salvar. Tente novamente.'); return }

      // Atualiza a URL do avatar no estado para refletir a foto salva
      if (novaAvatarUrl) setAvatarUrl(novaAvatarUrl)
      setAvatarFile(null)   // limpa o arquivo selecionado

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Inicial do nome para o avatar placeholder ──────────────────────────────
  const inicial = name.trim().charAt(0).toUpperCase() || '?'

  // ── Renderização ────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">

      {/* ── Seção: foto de perfil ─────────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <h2 className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Foto de perfil
          </h2>
        </div>

        <div className="p-6 flex items-center gap-5">
          {/* Círculo do avatar — exibe foto ou inicial */}
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-2xl font-bold text-[#070707]"
              style={{ background: avatarPreview ? 'transparent' : '#E8B84B', fontFamily: 'var(--font-syne)' }}
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                inicial
              )}
            </div>

            {/* Indicador de loading durante upload */}
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-[#E8B84B]" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {/* Botão que abre o seletor de arquivo */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar || saving}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-200',
                'border-[#E8B84B]/40 text-[#E8B84B] hover:bg-[#E8B84B]/10',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              <Camera size={14} />
              Alterar foto
            </button>
            <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              JPG, PNG ou WebP • máx 2MB
            </p>

            {/* Indica que há uma foto nova aguardando salvar */}
            {avatarFile && (
              <p className="text-[#E8B84B]/70 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Nova foto selecionada — clique em Salvar para confirmar
              </p>
            )}
          </div>

          {/* Input de arquivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* ── Seção: dados pessoais ─────────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <h2 className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Dados pessoais
          </h2>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {/* Nome completo */}
          <Field label="Nome completo">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome completo"
              autoComplete="name"
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </Field>

          {/* Telefone */}
          <Field label="Telefone" optional>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              autoComplete="tel"
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </Field>

          {/* CPF */}
          <Field label="CPF" optional>
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={e => setCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              autoComplete="off"
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </Field>

          {/* RG */}
          <Field label="RG" optional>
            <input
              type="text"
              value={rg}
              onChange={e => setRg(e.target.value.slice(0, 20))}
              placeholder="Ex: 12.345.678-9"
              autoComplete="off"
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </Field>

          {/* Data de nascimento */}
          <Field label="Data de nascimento" optional>
            <input
              type="text"
              inputMode="numeric"
              value={birthDate}
              onChange={e => setBirthDate(formatBirthDate(e.target.value))}
              placeholder="DD/MM/AAAA"
              maxLength={10}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </Field>

        </div>
      </div>

      {/* ── Seção: endereço ───────────────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414] flex items-center gap-2">
          <MapPin size={14} className="text-[#E8B84B]" />
          <h2 className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Endereço
          </h2>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {/* Busca de endereço via Google Places */}
          <div className="flex flex-col gap-1.5" ref={addrDropdownRef}>
            <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase flex justify-between" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <span>Buscar endereço</span>
              <span className="text-[#383838] normal-case tracking-normal font-normal">preenche os campos automaticamente</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={addrQuery}
                onChange={e => { setAddrQuery(e.target.value); buscarEnderecoSugestoes(e.target.value) }}
                onFocus={() => addrSuggestions.length > 0 && setShowAddrDropdown(true)}
                placeholder="Digite sua rua, bairro ou cidade..."
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 pr-10 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444]">
                {addrSearching
                  ? <Loader2 size={14} className="animate-spin text-[#E8B84B]" />
                  : <Search size={14} />
                }
              </div>
              {showAddrDropdown && addrSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                  {addrSuggestions.map((s, i) => (
                    <button key={s.placeId} type="button"
                      onMouseDown={() => selecionarEndereco(s)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex flex-col gap-0.5',
                        i > 0 && 'border-t border-[#1a1a1a]'
                      )}
                    >
                      <span className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomePrincipal}</span>
                      {s.nomeSecundario && (
                        <span className="text-[#555] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomeSecundario}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CEP — com busca automática ao completar 8 dígitos */}
          <Field label="CEP" optional>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={zipCode}
                onChange={handleCepChange}
                placeholder="00000-000"
                autoComplete="postal-code"
                className={cn(
                  'w-full bg-[#111] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200',
                  'focus:bg-[#131313] placeholder:text-[#383838]',
                  cepError
                    ? 'border-red-500/50 focus:border-red-500/70'
                    : 'border-[#222] focus:border-[#E8B84B]/40'
                )}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              {/* Spinner enquanto busca o CEP */}
              {cepLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 size={14} className="animate-spin text-[#E8B84B]" />
                </div>
              )}
            </div>
            {/* Mensagem de erro de CEP */}
            {cepError && (
              <p className="text-red-400 text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {cepError}
              </p>
            )}
          </Field>

          {/* Rua (preenchida pelo CEP, mas editável) */}
          <Field label="Rua / Logradouro" optional>
            <input
              type="text"
              value={street}
              onChange={e => setStreet(e.target.value)}
              placeholder="Rua, Avenida, Travessa..."
              autoComplete="street-address"
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </Field>

          {/* Número + Bairro lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Número" optional>
              <input
                type="text"
                value={streetNumber}
                onChange={e => setStreetNumber(e.target.value)}
                placeholder="123"
                autoComplete="off"
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </Field>

            <Field label="Bairro" optional>
              <input
                type="text"
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                placeholder="Bairro"
                autoComplete="off"
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </Field>
          </div>

          {/* Cidade + Estado lado a lado */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="Cidade" optional>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Sua cidade"
                  autoComplete="address-level2"
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </Field>
            </div>

            <Field label="Estado" optional>
              <input
                type="text"
                value={uf}
                onChange={e => setUf(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                maxLength={2}
                autoComplete="address-level1"
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838] uppercase"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </Field>
          </div>

          {/* Tipo de residência — pill toggle dourado */}
          <Field label="Tipo de residência" optional>
            <div className="flex gap-3">
              {(['casa', 'apartamento'] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setAddressType(prev => prev === tipo ? '' : tipo)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 capitalize',
                    addressType === tipo
                      ? 'bg-[#E8B84B]/15 border-[#E8B84B]/60 text-[#E8B84B]'  // selecionado: dourado
                      : 'bg-[#111] border-[#222] text-[#555] hover:border-[#333] hover:text-[#888]'  // não selecionado
                  )}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  {tipo === 'casa' ? 'Casa' : 'Apartamento'}
                </button>
              ))}
            </div>
          </Field>

          {/* Complemento — aparece SOMENTE quando "Apartamento" estiver selecionado */}
          {addressType === 'apartamento' && (
            <Field label="Complemento" optional>
              <input
                type="text"
                value={complement}
                onChange={e => setComplement(e.target.value)}
                placeholder="Ex: Apto 42, Bloco B"
                autoComplete="off"
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </Field>
          )}

        </div>
      </div>

      {/* ── Feedback de erro ──────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Feedback de sucesso ───────────────────────────────────────────── */}
      {success && (
        <div
          className="flex items-center gap-2 text-green-400 text-sm bg-green-400/8 border border-green-400/15 rounded-xl px-4 py-3"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          <CheckCircle size={14} className="shrink-0" />
          Perfil atualizado com sucesso!
        </div>
      )}

      {/* ── Botão salvar ──────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={saving || uploadingAvatar}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
      >
        {saving || uploadingAvatar
          ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
          : 'Salvar alterações'
        }
      </button>

    </form>
  )
}

// ─── Componente auxiliar: rótulo + campo ───────────────────────────────────────
function Field({
  label,
  optional,
  children,
}: {
  label: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[#666] text-[11px] font-medium tracking-widest uppercase flex justify-between"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        <span>{label}</span>
        {optional && (
          <span className="text-[#383838] normal-case tracking-normal">opcional</span>
        )}
      </label>
      {children}
    </div>
  )
}
