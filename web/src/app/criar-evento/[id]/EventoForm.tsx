'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Check, Lock, User, MapPin, Search, ArrowRight, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SecaoBloqueavel } from '@/components/SecaoBloqueavel'

interface PlaceSuggestion {
  origem:         'venue' | 'google'
  placeId:        string
  nomePrincipal:  string
  nomeSecundario: string
  // Campos embutidos só quando origem === 'venue' — evita uma segunda
  // chamada de rede pra buscar detalhes de um local já cadastrado
  venueId?:       string
  zipCode?:       string
  street?:        string
  streetNumber?:  string
  neighborhood?:  string
  city?:          string
  state?:         string
  complement?:    string
  lat?:           number | null
  lng?:           number | null
  capacity?:      number | null
  hasParking?:    boolean | null
  parkingSpots?:  number | null
}

interface Responsavel {
  nome: string; cpf: string; telefone: string; email: string
}

interface Inicial {
  titulo: string; descricao: string; categoria: string
  dataInicio: string; dataFim: string
  nomeLocal: string; venueId: string | null
  cep: string; rua: string; numero: string
  bairro: string; cidade: string; estado: string; complemento: string
  capacidade: string
  feeMode: 'promotor' | 'comprador' | 'mista'
}

interface LocalRecente {
  id: string; name: string; city: string | null; state: string | null
  zipCode: string | null; street: string | null; streetNumber: string | null
  neighborhood: string | null; complement: string | null
  lat: number | null; lng: number | null; capacity: number | null
  hasParking: boolean | null; parkingSpots: number | null
}

interface Props {
  eventoId:        string
  herdaDadosDoPai?: boolean
  isChild?:        boolean
  parentEventId?:  string | null
  permitirVendaNoCaixaPaiInicial?: boolean
  tipoPessoa:      'pf' | 'pj' | null
  responsavel:     Responsavel | null
  inicial:         Inicial
  perfilCidade:    string | null
  perfilEstado:    string | null
  locaisRecentes:  LocalRecente[]
}

const CATEGORIAS = [
  'Show','Festa','Festival','Teatro','Esporte',
  'Gastronomia','Arte','Tecnologia','Religioso','Outro',
]

const DIAS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g,'').slice(0,8)
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`
}

function toLocalISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Lê a hora UTC do banco e exibe como-está (sem converter para fuso local)
// O sistema sempre salva sem timezone info, então o banco armazena como UTC
// e precisamos ler como UTC para manter consistência com o que o usuário digitou
function toUTCISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

const toDateInput = (iso: string) => iso ? toUTCISO(new Date(iso)) : ''

const diaSemana = (dt: string) => {
  if (!dt) return null
  const d = new Date(dt)
  if (isNaN(d.getTime())) return null
  return `${DIAS[d.getDay()]}, ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}`
}

const inputCls = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'
const labelCls = 'text-[#666] text-[11px] font-medium tracking-widest uppercase'

const selectCls = 'bg-[#111] border border-[#222] rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 appearance-none cursor-pointer'

function DateTimeInput24h({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [datePart, timePart] = value ? value.split('T') : ['', '']
  const [hh, mm] = timePart ? timePart.split(':') : ['00', '00']

  function emit(date: string, hour: string, min: string) {
    if (!date) { onChange(''); return }
    onChange(`${date}T${hour.padStart(2,'0')}:${min.padStart(2,'0')}`)
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <input
        type="date"
        value={datePart}
        onChange={e => emit(e.target.value, hh || '00', mm || '00')}
        className={cn(inputCls, 'flex-1 [color-scheme:dark]')}
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      />
      <select
        value={hh || '00'}
        onChange={e => emit(datePart, e.target.value, mm || '00')}
        className={cn(selectCls, 'w-20')}
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
          <option key={h} value={h}>{h}h</option>
        ))}
      </select>
      <select
        value={mm || '00'}
        onChange={e => emit(datePart, hh || '00', e.target.value)}
        className={cn(selectCls, 'w-20')}
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
          <option key={m} value={m}>{m}min</option>
        ))}
      </select>
    </div>
  )
}

export function EventoForm({ eventoId, herdaDadosDoPai, isChild, parentEventId, permitirVendaNoCaixaPaiInicial, tipoPessoa, responsavel, inicial, perfilCidade, perfilEstado, locaisRecentes }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  // Locais já usados pelo promotor em outros eventos — sugestão imediata,
  // sem precisar digitar nada, reaproveitando o mesmo formato de sugestão
  // da busca (mesma lógica de seleção em selecionarLocal)
  const sugestoesRecentes: PlaceSuggestion[] = useMemo(() => locaisRecentes.map(v => ({
    origem:         'venue',
    placeId:        '',
    venueId:        v.id,
    nomePrincipal:  v.name,
    nomeSecundario: [v.city, v.state].filter(Boolean).join(' - '),
    zipCode:        v.zipCode ?? '',
    street:         v.street ?? '',
    streetNumber:   v.streetNumber ?? '',
    neighborhood:   v.neighborhood ?? '',
    city:           v.city ?? '',
    state:          v.state ?? '',
    complement:     v.complement ?? '',
    lat:            v.lat,
    lng:            v.lng,
    capacity:       v.capacity,
    hasParking:     v.hasParking,
    parkingSpots:   v.parkingSpots,
  })), [locaisRecentes])

  // Seção 1
  const [titulo,    setTitulo]    = useState(inicial.titulo === 'Novo evento' ? '' : inicial.titulo)
  const [descricao, setDescricao] = useState(inicial.descricao)
  const [categoria, setCategoria] = useState(inicial.categoria)

  // Seção 2
  const [dataInicio, setDataInicio] = useState(toDateInput(inicial.dataInicio))
  const [dataFim,    setDataFim]    = useState(toDateInput(inicial.dataFim))
  const [duracao,    setDuracao]    = useState('')
  const [numDias,    setNumDias]    = useState(1)

  // Seção 3 — local (com suporte a venue salvo)
  const [nomeLocal,      setNomeLocal]      = useState(inicial.nomeLocal)
  const [venueId,        setVenueId]        = useState<string | null>(inicial.venueId)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedLat,    setSelectedLat]    = useState<number | null>(null)
  const [selectedLng,    setSelectedLng]    = useState<number | null>(null)
  // true quando venueId veio da busca interna (venue já existe) — nesse
  // caso o save nunca sobrescreve o venue de quem já é responsável por ele
  const [venueJaExistente, setVenueJaExistente] = useState(!!inicial.venueId)

  // "Sou responsável por esse lugar" — só cuida dos dados do venue
  // (endereço/capacidade/estacionamento), nunca de dinheiro/caixa
  const [souResponsavel,      setSouResponsavel]      = useState(false)
  const [venuePhone,          setVenuePhone]          = useState('')
  const [venueNicho,          setVenueNicho]          = useState<'eventos' | 'estacionamento' | 'ambos' | ''>('')
  const [venueTemEstacionamento, setVenueTemEstacionamento] = useState<'sim' | 'nao' | ''>('')
  const [venueVagas,          setVenueVagas]          = useState('')

  const [suggestions,   setSuggestions]   = useState<PlaceSuggestion[]>(sugestoesRecentes)
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown,  setShowDropdown]  = useState(false)
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filtro de cidade na busca de local — evita ambiguidade em nomes genéricos.
  // Parte do endereço já salvo no evento; se não houver, cai pro perfil do promotor.
  const [biasCidade, setBiasCidade]   = useState(inicial.cidade || perfilCidade || '')
  const [biasEstado, setBiasEstado]   = useState(inicial.estado || perfilEstado || '')
  const [trocandoBias, setTrocandoBias] = useState(false)
  const [biasCepInput, setBiasCepInput] = useState('')
  const [biasCepLoading, setBiasCepLoading] = useState(false)

  const buscarCidadePorCEP = async (valorCep: string) => {
    const digitos = valorCep.replace(/\D/g, '')
    if (digitos.length !== 8) return
    setBiasCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const d   = await res.json()
      if (!d.erro) {
        setBiasCidade(d.localidade ?? '')
        setBiasEstado(d.uf ?? '')
        setTrocandoBias(false)
      }
    } catch { /* usuário pode tentar de novo */ }
    finally { setBiasCepLoading(false) }
  }

  const [cep,         setCep]         = useState(formatCEP(inicial.cep))
  const [rua,         setRua]         = useState(inicial.rua)
  const [numero,      setNumero]      = useState(inicial.numero)
  const [bairro,      setBairro]      = useState(inicial.bairro)
  const [cidade,      setCidade]      = useState(inicial.cidade)
  const [estado,      setEstado]      = useState(inicial.estado)
  const [complemento, setComplemento] = useState(inicial.complemento)
  const [capacidade,  setCapacidade]  = useState(inicial.capacidade)
  const [feeMode,     setFeeMode]     = useState<'promotor' | 'comprador' | 'mista'>(inicial.feeMode)
  const [permitirVendaNoCaixaPai, setPermitirVendaNoCaixaPai] = useState(permitirVendaNoCaixaPaiInicial ?? true)
  const [cepLoading,  setCepLoading]  = useState(false)
  const [cepError,    setCepError]    = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [erro,   setErro]   = useState<string | null>(null)

  const calcularFim = (inicio: string, dias: number, dur: string) => {
    if (!inicio) return
    const d = new Date(inicio)
    if (dias > 1) d.setDate(d.getDate() + (dias - 1))
    if (dur && !isNaN(parseFloat(dur))) {
      d.setMinutes(d.getMinutes() + Math.round(parseFloat(dur) * 60))
    }
    setDataFim(toLocalISO(d))
  }

  const handleDataInicio = (v: string) => {
    setDataInicio(v)
    if (v) calcularFim(v, numDias, duracao)
    else setDataFim(v)
  }

  const handleNumDias = (dias: number) => {
    setNumDias(dias)
    if (dataInicio) calcularFim(dataInicio, dias, duracao)
  }

  const handleDuracao = (v: string) => {
    setDuracao(v)
    const horas = parseFloat(v)
    if (dataInicio && v && !isNaN(horas)) {
      const d = new Date(dataInicio)
      if (numDias > 1) d.setDate(d.getDate() + (numDias - 1))
      d.setMinutes(d.getMinutes() + Math.round(horas * 60))
      setDataFim(toLocalISO(d))
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buscarSugestoes = useCallback((valor: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Campo vazio: volta a mostrar os locais já usados antes, em vez de nada
    if (!valor || valor.length < 2) {
      setSuggestions(sugestoesRecentes); setShowDropdown(false); setPlaceSearchError(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const params = new URLSearchParams({ q: valor })
        if (biasCidade) params.set('cidade', biasCidade)
        if (biasEstado) params.set('estado', biasEstado)
        const res  = await fetch(`/api/places/autocomplete?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) {
          setPlaceSearchError('Busca de local indisponível no momento. Preencha o endereço manualmente abaixo.')
          setSuggestions([]); setShowDropdown(false)
          return
        }
        setPlaceSearchError(null)
        setSuggestions(data.suggestions ?? [])
        setShowDropdown((data.suggestions ?? []).length > 0)
      } catch {
        setPlaceSearchError('Busca de local indisponível no momento. Preencha o endereço manualmente abaixo.')
        setSuggestions([])
      }
      finally { setSearchLoading(false) }
    }, 350)
  }, [biasCidade, biasEstado, sugestoesRecentes])

  const selecionarLocal = async (s: PlaceSuggestion) => {
    setNomeLocal(s.nomePrincipal)
    setShowDropdown(false)
    setSuggestions([])
    setSouResponsavel(false)

    // Venue já cadastrado na plataforma — preenche tudo direto, sem
    // segunda chamada de rede, e nunca sobrescreve esse venue no save
    if (s.origem === 'venue') {
      setSelectedPlaceId(null)
      setVenueId(s.venueId ?? null)
      setVenueJaExistente(true)
      if (s.zipCode)      { setCep(formatCEP(s.zipCode)); setCepError(null) }
      setRua(s.street ?? '')
      setNumero(s.streetNumber ?? '')
      setBairro(s.neighborhood ?? '')
      if (s.city)  setCidade(s.city)
      if (s.state) setEstado(s.state.slice(0, 2).toUpperCase())
      setComplemento(s.complement ?? '')
      if (s.capacity != null) setCapacidade(String(s.capacity))
      if (s.lat != null) setSelectedLat(s.lat)
      if (s.lng != null) setSelectedLng(s.lng)
      return
    }

    setSelectedPlaceId(s.placeId)
    setVenueId(null) // será definido no save
    setVenueJaExistente(false)
    try {
      const res  = await fetch(`/api/places/details?place_id=${s.placeId}`)
      const data = await res.json()
      if (data.cep)    { setCep(formatCEP(data.cep)); setCepError(null) }
      if (data.rua)    setRua(data.rua)
      if (data.numero) setNumero(data.numero)
      if (data.bairro) setBairro(data.bairro)
      if (data.cidade) setCidade(data.cidade)
      if (data.estado) setEstado(data.estado.slice(0, 2).toUpperCase())
      if (data.lat != null) setSelectedLat(data.lat)
      if (data.lng != null) setSelectedLng(data.lng)
    } catch { /* usuário pode preencher manualmente */ }
  }

  // Quando o usuário digita manualmente, limpa o placeId/venue selecionado
  const handleNomeLocalChange = (v: string) => {
    setNomeLocal(v)
    if (selectedPlaceId) { setSelectedPlaceId(null); setSelectedLat(null); setSelectedLng(null) }
    if (venueJaExistente) { setVenueId(null); setVenueJaExistente(false); setSouResponsavel(false) }
    buscarSugestoes(v)
  }

  const buscarCEP = async (valor: string) => {
    const digitos = valor.replace(/\D/g,'')
    if (digitos.length !== 8) return
    setCepLoading(true); setCepError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const d   = await res.json()
      if (d.erro) { setCepError('CEP não encontrado.'); return }
      setRua(d.logradouro ?? ''); setBairro(d.bairro ?? '')
      setCidade(d.localidade ?? ''); setEstado(d.uf ?? '')
    } catch { setCepError('Erro ao buscar o CEP.') }
    finally { setCepLoading(false) }
  }

  const handleCEP = (v: string) => {
    const f = formatCEP(v); setCep(f); setCepError(null)
    if (f.replace(/\D/g,'').length === 8) buscarCEP(f)
  }

  const podeContinuar = !!(
    titulo.trim() && titulo.trim() !== 'Novo evento' &&
    dataInicio &&
    (cidade.trim() || nomeLocal.trim())
  )

  const handleSalvar = async (destino?: string) => {
    setSaving(true); setErro(null); setSaved(false)
    try {
      let venueIdToSave = venueId

      // Se um local do Google Places foi selecionado, upsert na tabela venues
      if (selectedPlaceId) {
        const { data: venue } = await supabase
          .from('venues')
          .upsert({
            name:            nomeLocal.trim(),
            google_place_id: selectedPlaceId,
            zip_code:        cep.replace(/\D/g,'')  || null,
            street:          rua                     || null,
            street_number:   numero                  || null,
            neighborhood:    bairro                  || null,
            city:            cidade                  || null,
            state:           estado                  || null,
            lat:             selectedLat,
            lng:             selectedLng,
          }, { onConflict: 'google_place_id' })
          .select('id')
          .single()
        if (venue) {
          venueIdToSave = venue.id
          setVenueId(venue.id)
        }
      }

      await supabase.from('events').update({
        title:         titulo.trim()         || 'Novo evento',
        description:   descricao             || null,
        category:      categoria             || null,
        date_start:    dataInicio            || null,
        date_end:      dataFim               || null,
        venue_name:    nomeLocal.trim()      || null,
        venue_id:      venueIdToSave,
        zip_code:      cep.replace(/\D/g,'') || null,
        street:        rua                   || null,
        street_number: numero                || null,
        neighborhood:  bairro               || null,
        city:          cidade                || null,
        state:         estado                || null,
        complement:    complemento           || null,
        capacity:      capacidade ? parseInt(capacidade, 10) : null,
        fee_mode:      feeMode,
        ...(isChild ? { permitir_venda_no_caixa_pai: permitirVendaNoCaixaPai } : {}),
      }).eq('id', eventoId)

      // Assume o lugar como responsável — só cuida dos dados do venue
      // (endereço/capacidade/estacionamento), nunca de dinheiro/caixa
      if (souResponsavel && venueIdToSave) {
        await fetch(`/api/venues/${venueIdToSave}/tornar-responsavel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone:         venuePhone || undefined,
            nicho:         venueNicho || undefined,
            capacity:      capacidade ? parseInt(capacidade, 10) : undefined,
            has_parking:   venueTemEstacionamento === 'sim' ? true : venueTemEstacionamento === 'nao' ? false : undefined,
            parking_spots: venueTemEstacionamento === 'sim' && venueVagas ? parseInt(venueVagas, 10) : undefined,
          }),
        }).catch(() => { /* não bloqueia o salvamento do evento */ })
      }

      if (destino) {
        router.push(destino)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setErro('Erro ao salvar. Tente novamente.') }
    finally { setSaving(false) }
  }

  // Navega entre etapas salvando antes — clicar direto no indicador não pode
  // descartar silenciosamente o que já foi digitado nesta tela.
  const irParaEtapa = (path: string) => handleSalvar(path)

  return (
    <div className="flex flex-col gap-6">

      {/* Indicador de etapas — todas navegáveis; ir e voltar sempre salva
          primeiro, pra nunca perder o que já foi preenchido */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-white text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <span className="w-5 h-5 rounded-full bg-[#E8B84B] flex items-center justify-center text-[#070707] text-[10px] font-bold">1</span>
          Informações
        </div>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <button type="button" onClick={() => irParaEtapa(`/criar-evento/${eventoId}/ingressos`)} disabled={saving}
          className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors disabled:opacity-40"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">2</span>
          Ingressos
        </button>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <button type="button" onClick={() => irParaEtapa(`/criar-evento/${eventoId}/imagens`)} disabled={saving}
          className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors disabled:opacity-40"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">3</span>
          Imagens
        </button>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <button type="button" onClick={() => irParaEtapa(`/criar-evento/${eventoId}/publicar`)} disabled={saving}
          className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors disabled:opacity-40"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">4</span>
          Publicar
        </button>
      </div>

      {/* Voltar — evento filho (Tenda) volta pro evento principal, já que
          "Meus eventos" exclui filhos e viraria um beco sem saída */}
      <button type="button"
        onClick={() => router.push(isChild && parentEventId ? `/evento/${parentEventId}` : '/criar-evento')}
        className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-sm w-fit"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <ArrowLeft size={15} />
        {isChild && parentEventId ? 'Voltar para o evento principal' : 'Voltar para meus eventos'}
      </button>

      {/* ── Venda no caixa compartilhado do evento principal (só eventos filhos) ── */}
      {isChild && (
        <button type="button" onClick={() => setPermitirVendaNoCaixaPai(v => !v)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
          style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#E8B84B12' }}>
            <ShoppingBag size={16} className="text-[#E8B84B]" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Vender no mesmo caixa do evento principal
            </p>
            <p className="text-[#555] text-xs mt-0.5 leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Quando ligado, os caixas abertos no evento principal também vendem ingresso deste evento. Desligue se preferir um caixa dedicado só pra este espaço.
            </p>
          </div>
          <div className="w-12 h-6 rounded-full transition-colors relative shrink-0"
               style={{ background: permitirVendaNoCaixaPai ? '#E8B84B' : '#222' }}>
            <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                 style={{ left: permitirVendaNoCaixaPai ? '26px' : '4px' }} />
          </div>
        </button>
      )}

      {/* ── SEÇÃO 1: Informações gerais ── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Informações gerais</p>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Nome, descrição e categoria</p>
        </div>
        <div className="p-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Nome do evento</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Festival de Verão 2027" maxLength={120}
              className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            <span className="text-[#333] text-xs self-end" style={{ fontFamily: 'var(--font-dm-sans)' }}>{titulo.length}/120</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Conte mais sobre o evento, atrações, programação..."
              rows={4} maxLength={1000}
              className={cn(inputCls,'resize-none')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            <span className="text-[#333] text-xs self-end" style={{ fontFamily: 'var(--font-dm-sans)' }}>{descricao.length}/1000</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Categoria</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map(c => (
                <button key={c} type="button" onClick={() => setCategoria(p => p === c ? '' : c)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                    categoria === c
                      ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                      : 'bg-transparent text-[#555] border-[#222] hover:border-[#444] hover:text-[#888]'
                  )}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 2: Data e horário (Tenda/Estacionamento herdam do pai — os dias
           específicos são escolhidos depois, na etapa de ingressos) ── */}
      {herdaDadosDoPai ? (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl px-6 py-4">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Data e horário</p>
          <p className="text-[#444] text-xs mt-1 leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Este evento roda em dias específicos do evento principal — escolha quais dias e horários na próxima etapa (Ingressos).
          </p>
        </div>
      ) : (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Data e horário</p>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Quando o evento começa e termina</p>
        </div>
        <div className="p-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Início</label>
              <div className="flex items-center gap-1.5">
                <span className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Duração em dias</span>
                {[1,2,3,4,5].map(d => (
                  <button key={d} type="button" onClick={() => handleNumDias(d)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-semibold border transition-all duration-200',
                      numDias === d
                        ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                        : 'bg-transparent text-[#555] border-[#222] hover:border-[#444] hover:text-[#888]'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {d}
                  </button>
                ))}
                <input
                  type="number" min="1" max="365" placeholder="+"
                  value={[1,2,3,4,5].includes(numDias) ? '' : numDias}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 1) handleNumDias(v)
                  }}
                  className="w-9 h-7 rounded-lg text-xs text-center text-white border border-[#222] bg-transparent outline-none focus:border-[#E8B84B]/40 placeholder:text-[#333]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
                <span className="text-[#333] text-[10px] ml-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {numDias === 1 ? 'dia' : 'dias'}
                </span>
              </div>
            </div>
            <DateTimeInput24h value={dataInicio} onChange={handleDataInicio} />
            {diaSemana(dataInicio) && (
              <span className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {diaSemana(dataInicio)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Duração do evento{' '}
              <span className="text-[#333] normal-case tracking-normal font-normal">(opcional — calcula o encerramento)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {['2','4','6','8','12','18','24','Outra'].map(h => (
                <button key={h} type="button"
                  onClick={() => h === 'Outra' ? setDuracao('') : handleDuracao(h)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                    duracao === h
                      ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                      : 'bg-transparent text-[#555] border-[#222] hover:border-[#444] hover:text-[#888]'
                  )}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {h === 'Outra' ? 'Outra' : `${h}h`}
                </button>
              ))}
              <input type="number" min="0.5" max="72" step="0.5"
                placeholder="Ex: 5.5"
                value={['2','4','6','8','12','18','24'].includes(duracao) ? '' : duracao}
                onChange={e => handleDuracao(e.target.value)}
                className="w-24 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Encerramento{' '}
              <span className="text-[#333] normal-case tracking-normal font-normal">(ajuste se necessário)</span>
            </label>
            <DateTimeInput24h value={dataFim} onChange={setDataFim} />
            {diaSemana(dataFim) && (
              <span className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {diaSemana(dataFim)}
              </span>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── SEÇÃO 3: Local do evento — libera assim que o nome do evento é preenchido ── */}
      <SecaoBloqueavel ativo={!!(titulo.trim() && titulo.trim() !== 'Novo evento')} mensagem="Preencha o nome do evento primeiro">
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-[#E8B84B]" />
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Local do evento</p>
          </div>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Busque pelo nome do local — o endereço é preenchido automaticamente e salvo na plataforma
          </p>
        </div>
        <div className="p-6 flex flex-col gap-4">

          {/* Busca Google Places */}
          <div className="flex flex-col gap-1.5" ref={dropdownRef}>
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Nome do local</label>
            <div className="relative">
              <input
                type="text"
                value={nomeLocal}
                onChange={e => handleNomeLocalChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder="Ex: Allianz Parque, Arena Fonte Nova..."
                className={cn(inputCls, 'pr-9')}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444]">
                {searchLoading ? <Loader2 size={14} className="animate-spin text-[#E8B84B]" /> : <Search size={14} />}
              </div>

              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                  {!nomeLocal.trim() && (
                    <p className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-[#444]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Locais que você já usou
                    </p>
                  )}
                  {suggestions.map((s, i) => (
                    <button
                      key={s.origem === 'venue' ? `v-${s.venueId}` : `g-${s.placeId}`}
                      type="button"
                      onMouseDown={() => selecionarLocal(s)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex flex-col gap-0.5',
                        i > 0 && 'border-t border-[#1a1a1a]'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-white text-sm font-medium truncate"
                              style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomePrincipal}</span>
                        {s.origem === 'venue' && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ background: 'rgba(232,184,75,0.12)', color: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                            Cadastrado
                          </span>
                        )}
                      </span>
                      {s.nomeSecundario && (
                        <span className="text-[#555] text-xs truncate"
                              style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomeSecundario}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filtro de cidade da busca — reduz ambiguidade em nomes genéricos */}
            {!trocandoBias ? (
              <div className="flex items-center gap-1.5 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <span className="text-[#444]">
                  {biasCidade
                    ? <>Buscando perto de <span className="text-[#888]">{biasCidade}{biasEstado ? ` - ${biasEstado}` : ''}</span></>
                    : 'Buscando em todo o Brasil'}
                </span>
                <button type="button" onClick={() => { setTrocandoBias(true); setBiasCepInput('') }}
                  className="text-[#E8B84B]/70 hover:text-[#E8B84B] transition-colors">
                  Trocar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text" inputMode="numeric" placeholder="CEP do local do evento"
                  value={biasCepInput}
                  onChange={e => setBiasCepInput(formatCEP(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter') buscarCidadePorCEP(biasCepInput) }}
                  maxLength={9}
                  className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                  autoFocus
                />
                {biasCepLoading
                  ? <Loader2 size={14} className="animate-spin text-[#E8B84B]" />
                  : (
                    <button type="button" onClick={() => buscarCidadePorCEP(biasCepInput)}
                      className="text-[#E8B84B] text-xs font-medium">OK</button>
                  )}
                <button type="button" onClick={() => setTrocandoBias(false)}
                  className="text-[#444] hover:text-[#777] text-xs transition-colors">Cancelar</button>
              </div>
            )}

            {placeSearchError && (
              <p className="text-amber-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {placeSearchError}
              </p>
            )}
            {/* Indica se local foi vinculado a um venue salvo */}
            {venueId && (
              <p className="text-green-400 text-xs flex items-center gap-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <Check size={11} /> Local salvo na plataforma
              </p>
            )}
            {selectedPlaceId && !venueId && (
              <p className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Local será salvo ao gravar
              </p>
            )}
          </div>

          {/* Assumir responsabilidade pelo lugar — só cuida dos dados dele
              (endereço/capacidade/estacionamento), nunca de dinheiro/caixa.
              Só aparece quando há um venue de fato (selecionado da busca
              interna ou do Google Places) — entrada 100% manual sem
              selecionar nada ainda não gera um venue pra vincular. */}
          {(venueId || selectedPlaceId) && (
            <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
              <button type="button" onClick={() => setSouResponsavel(v => !v)}
                className="w-full flex items-center gap-3 p-3.5 text-left transition-colors hover:bg-[#111]">
                <div className={cn(
                  'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                  souResponsavel ? 'bg-[#E8B84B] border-[#E8B84B]' : 'border-[#333]'
                )}>
                  {souResponsavel && <Check size={13} className="text-[#070707]" />}
                </div>
                <div>
                  <p className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Sou responsável por esse lugar
                  </p>
                  <p className="text-[#444] text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Cuido dos dados dele (endereço, capacidade, estacionamento) — não muda nada do caixa deste evento
                  </p>
                </div>
              </button>

              {souResponsavel && (
                <div className="p-3.5 pt-0 flex flex-col gap-2.5">
                  <input type="tel" placeholder="Telefone de contato do lugar" value={venuePhone}
                    onChange={e => setVenuePhone(e.target.value)}
                    className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />

                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'eventos'        as const, label: 'Eventos'        },
                      { value: 'estacionamento' as const, label: 'Estacionamento' },
                      { value: 'ambos'          as const, label: 'Ambos'          },
                    ]).map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => setVenueNicho(value)}
                        className={cn(
                          'py-2 rounded-lg border text-xs font-medium transition-all',
                          venueNicho === value
                            ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white'
                            : 'bg-[#111] border-[#1c1c1c] text-[#777] hover:border-[#2a2a2a]'
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'sim' as const, label: 'Tem estacionamento' },
                      { value: 'nao' as const, label: 'Sem estacionamento' },
                    ]).map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => {
                        setVenueTemEstacionamento(value)
                        if (value === 'nao') setVenueVagas('')
                      }}
                        className={cn(
                          'py-2 rounded-lg border text-xs font-medium transition-all',
                          venueTemEstacionamento === value
                            ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white'
                            : 'bg-[#111] border-[#1c1c1c] text-[#777] hover:border-[#2a2a2a]'
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {venueTemEstacionamento === 'sim' && (
                    <input type="number" placeholder="Quantas vagas?" value={venueVagas}
                      onChange={e => setVenueVagas(e.target.value)} min="1"
                      className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>CEP</label>
            <div className="relative">
              <input type="text" inputMode="numeric" value={cep}
                onChange={e => handleCEP(e.target.value)} placeholder="00000-000"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              {cepLoading && <Loader2 size={14} className="animate-spin text-[#E8B84B] absolute right-3.5 top-1/2 -translate-y-1/2" />}
            </div>
            {cepError && <p className="text-red-400 text-xs">{cepError}</p>}
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Rua / Logradouro</label>
              <input type="text" value={rua} onChange={e => setRua(e.target.value)} placeholder="Rua das Flores"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Número</label>
              <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="123"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Bairro</label>
              <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Centro"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Complemento <span className="text-[#333] normal-case tracking-normal font-normal">(opcional)</span>
              </label>
              <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Pavilhão A..."
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Cidade</label>
              <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Curitiba"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Estado</label>
              <input type="text" value={estado} onChange={e => setEstado(e.target.value.toUpperCase().slice(0,2))} placeholder="PR"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Capacidade do local{' '}
              <span className="text-[#333] normal-case tracking-normal font-normal">(número máximo de pessoas)</span>
            </label>
            <input
              type="number"
              min="1"
              value={capacidade}
              onChange={e => setCapacidade(e.target.value)}
              placeholder="Ex: 1000"
              className={inputCls}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
            <p className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              A soma de todos os ingressos não pode ultrapassar este limite.
            </p>
          </div>
        </div>
      </div>
      </SecaoBloqueavel>

      {/* ── SEÇÃO: Cobrança da taxa — libera assim que cidade OU nome do local for preenchido ── */}
      <SecaoBloqueavel ativo={!!(cidade.trim() || nomeLocal.trim())} mensagem="Preencha a cidade ou o nome do local primeiro">
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Cobrança da taxa de serviço</p>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Quem vai arcar com a taxa da plataforma?
          </p>
        </div>
        <div className="p-6 flex flex-col gap-3">
          {([
            {
              value: 'promotor',
              titulo: 'Eu absorvo a taxa',
              desc:   'O comprador paga o preço que você definiu. A taxa é descontada do seu repasse.',
            },
            {
              value: 'comprador',
              titulo: 'Comprador paga a taxa',
              desc:   'A taxa é adicionada ao preço do ingresso para o comprador. Você recebe o valor cheio.',
            },
            {
              value: 'mista',
              titulo: 'Dividir a taxa',
              desc:   'Cada lado paga metade. O comprador paga um pouco a mais e você desconta a outra metade do seu repasse.',
            },
          ] as const).map(op => (
            <button
              key={op.value}
              type="button"
              onClick={() => setFeeMode(op.value)}
              className="flex items-start gap-4 p-4 rounded-xl border text-left transition-all"
              style={{
                background: feeMode === op.value ? '#E8B84B10' : '#111',
                border:     `1px solid ${feeMode === op.value ? '#E8B84B40' : '#222'}`,
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
                style={{ borderColor: feeMode === op.value ? '#E8B84B' : '#333' }}
              >
                {feeMode === op.value && (
                  <div className="w-2 h-2 rounded-full" style={{ background: '#E8B84B' }} />
                )}
              </div>
              <div>
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {op.titulo}
                </p>
                <p className="text-[#555] text-xs mt-0.5 leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {op.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
      </SecaoBloqueavel>

      {/* Responsável — somente PF, somente leitura */}
      {tipoPessoa === 'pf' && responsavel && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Responsável pelo evento</p>
              <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Dados vinculados ao seu perfil — edite em{' '}
                <a href="/perfil" className="text-[#E8B84B] hover:underline">Meu perfil</a>
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Lock size={11} /><span>Somente leitura</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl border border-[#1a1a1a]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-[#070707] shrink-0"
                 style={{ background: '#E8B84B', fontFamily: 'var(--font-syne)' }}>
              {responsavel.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{responsavel.nome}</p>
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{responsavel.email}</p>
            </div>
            <User size={14} className="text-[#2a2a2a] ml-auto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'CPF',      value: responsavel.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') },
              { label: 'Telefone', value: responsavel.telefone },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-3 py-2.5">
                  <span className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{value || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {erro && <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

      {/* Botões de ação fixos */}
      <div className="flex gap-3 sticky bottom-4">
        <button type="button" onClick={() => handleSalvar()} disabled={saving}
          className={cn(
            'py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40',
            podeContinuar
              ? 'flex-none px-5 bg-[#111] border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333]'
              : 'flex-1 text-[#070707] hover:brightness-110'
          )}
          style={{
            background: podeContinuar ? undefined : '#E8B84B',
            fontFamily: 'var(--font-dm-sans)',
          }}>
          {saving && !podeContinuar
            ? <Loader2 size={15} className="animate-spin" />
            : saved ? <><Check size={15} /><span>Salvo!</span></>
            : <span>Salvar rascunho</span>
          }
        </button>

        {podeContinuar && (
          <button type="button" onClick={() => handleSalvar(`/criar-evento/${eventoId}/ingressos`)} disabled={saving}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
            {saving
              ? <Loader2 size={15} className="animate-spin" />
              : <><span>Salvar e continuar</span><ArrowRight size={15} /></>
            }
          </button>
        )}
      </div>

    </div>
  )
}
