'use client'

// Aba "Veículo" — decisão do usuário (08/08/2026): não grava em tabela
// própria do Tipo7, só repassa pra Autosave (POST /profile/veiculo →
// AutosaveService.criarOuAtualizarVeiculo), que é a fonte única de
// verdade dos veículos por enquanto. Upsert por placa do lado deles.
//
// `type` e `status` ficam como texto livre por enquanto — são enum fixo
// do lado da Autosave, e os valores aceitos ainda não foram confirmados
// com o time deles (ver memória project_autosave_veiculo_modal.md).
// Trocar pra <select> assim que a lista chegar.
import { useState } from 'react'
import { Car, ChevronDown, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { cn } from '@/lib/utils'

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]'
const lbl = 'text-[#666] text-[11px] font-medium tracking-widest uppercase'

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn(lbl, 'flex justify-between')} style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <span>{label}</span>
        {optional && <span className="text-[#383838] normal-case tracking-normal">opcional</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={className ?? inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
}

// Estado do form inteiro — tudo string na tela (inputs numéricos convertem
// só na hora de montar o body).
interface EstadoVeiculo {
  plate: string; name: string; type: string; brand: string; model: string
  year: string; color: string; status: string; category: string; species: string; body_type: string
  chassis_number: string; renavam: string; engine_number: string; security_code: string
  license_expiry: string; licensing_year: string; restrictions: string
  odometer_km: string; fuel_type: string; capacity: string; power_cv: string
  displacement: string; cmt: string; axles: string
  owner_name: string; owner_document: string; driver_phone: string; city: string; state: string; notes: string
}

const VAZIO: EstadoVeiculo = {
  plate: '', name: '', type: '', brand: '', model: '', year: '', color: '', status: '', category: '', species: '', body_type: '',
  chassis_number: '', renavam: '', engine_number: '', security_code: '', license_expiry: '', licensing_year: '', restrictions: '',
  odometer_km: '', fuel_type: '', capacity: '', power_cv: '', displacement: '', cmt: '', axles: '',
  owner_name: '', owner_document: '', driver_phone: '', city: '', state: '', notes: '',
}

// Seção colapsável (mesmo padrão visual de RotaCard em admin/api).
function Secao({ titulo, aberta, onToggle, children }: { titulo: string; aberta: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
      <button type="button" onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center gap-2.5 text-left hover:bg-[#111] transition-colors">
        <ChevronDown size={14} className="text-[#444] shrink-0 transition-transform duration-200"
          style={{ transform: aberta ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{titulo}</span>
      </button>
      {aberta && (
        <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#141414]">
          {children}
        </div>
      )}
    </div>
  )
}

export function VeiculoForm() {
  const [v, setV] = useState<EstadoVeiculo>(VAZIO)
  const set = (campo: keyof EstadoVeiculo) => (e: React.ChangeEvent<HTMLInputElement>) => setV(prev => ({ ...prev, [campo]: e.target.value }))

  const [abertas, setAbertas] = useState({ documento: false, tecnico: false, dono: false })
  const toggle = (k: keyof typeof abertas) => setAbertas(prev => ({ ...prev, [k]: !prev[k] }))

  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // ── Busca automática ao sair do campo Placa (mesmo padrão de
  // handleBlurCpf em ProfileForm.tsx) — se o carro já está cadastrado na
  // Autosave, pré-preenche o resto. Diferente do CPF, não exige
  // confirmação: placa de carro não é um dado sensível a esse ponto.
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)
  const [placaEncontrada, setPlacaEncontrada] = useState(false)

  const preencherSeVazio = (campo: keyof EstadoVeiculo, atual: string, novo: unknown) => {
    if (atual.trim() || novo == null) return
    setV(prev => ({ ...prev, [campo]: String(novo) }))
  }

  const handleBlurPlaca = async (placaDigitada: string) => {
    setPlacaEncontrada(false)
    const placa = placaDigitada.trim()
    if (!placa) return

    setBuscandoPlaca(true)
    try {
      const res = await apiFetchAuth(`/api/profile/veiculo/${encodeURIComponent(placa)}`)
      const data = await res.json() as { found: boolean; vehicle?: Record<string, unknown> }
      if (!data.found || !data.vehicle) return

      setPlacaEncontrada(true)
      const veic = data.vehicle
      preencherSeVazio('name', v.name, veic.name)
      preencherSeVazio('type', v.type, veic.type)
      preencherSeVazio('brand', v.brand, veic.brand)
      preencherSeVazio('model', v.model, veic.model)
      preencherSeVazio('year', v.year, veic.year)
      preencherSeVazio('color', v.color, veic.color)
      preencherSeVazio('status', v.status, veic.status)
      preencherSeVazio('category', v.category, veic.category)
      preencherSeVazio('species', v.species, veic.species)
      preencherSeVazio('body_type', v.body_type, veic.body_type)
      preencherSeVazio('chassis_number', v.chassis_number, veic.chassis_number)
      preencherSeVazio('renavam', v.renavam, veic.renavam)
      preencherSeVazio('engine_number', v.engine_number, veic.engine_number)
      preencherSeVazio('security_code', v.security_code, veic.security_code)
      preencherSeVazio('license_expiry', v.license_expiry, veic.license_expiry)
      preencherSeVazio('licensing_year', v.licensing_year, veic.licensing_year)
      preencherSeVazio('restrictions', v.restrictions, veic.restrictions)
      preencherSeVazio('odometer_km', v.odometer_km, veic.odometer_km)
      preencherSeVazio('fuel_type', v.fuel_type, veic.fuel_type)
      preencherSeVazio('capacity', v.capacity, veic.capacity)
      preencherSeVazio('power_cv', v.power_cv, veic.power_cv)
      preencherSeVazio('displacement', v.displacement, veic.displacement)
      preencherSeVazio('cmt', v.cmt, veic.cmt)
      preencherSeVazio('axles', v.axles, veic.axles)
      preencherSeVazio('owner_name', v.owner_name, veic.owner_name)
      preencherSeVazio('owner_document', v.owner_document, veic.owner_document)
      preencherSeVazio('driver_phone', v.driver_phone, veic.driver_phone)
      preencherSeVazio('city', v.city, veic.city)
      preencherSeVazio('state', v.state, veic.state)
      preencherSeVazio('notes', v.notes, veic.notes)
    } catch {
      // best-effort — usuário pode preencher manualmente
    } finally {
      setBuscandoPlaca(false)
    }
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null); setSucesso(null)
    if (!v.plate.trim()) { setErro('Placa é obrigatória.'); return }

    setSaving(true)
    try {
      const num = (s: string) => (s.trim() ? Number(s) : undefined)
      const str = (s: string) => (s.trim() ? s.trim() : undefined)

      const res = await apiFetchAuth('/api/profile/veiculo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate: v.plate.trim(),
          name: str(v.name), type: str(v.type), brand: str(v.brand), model: str(v.model),
          year: num(v.year), color: str(v.color), status: str(v.status), category: str(v.category),
          species: str(v.species), body_type: str(v.body_type),
          chassis_number: str(v.chassis_number), renavam: str(v.renavam), engine_number: str(v.engine_number),
          security_code: str(v.security_code), license_expiry: str(v.license_expiry),
          licensing_year: num(v.licensing_year), restrictions: str(v.restrictions),
          odometer_km: num(v.odometer_km), fuel_type: str(v.fuel_type), capacity: num(v.capacity),
          power_cv: num(v.power_cv), displacement: str(v.displacement), cmt: str(v.cmt), axles: num(v.axles),
          owner_name: str(v.owner_name), owner_document: str(v.owner_document), driver_phone: str(v.driver_phone),
          city: str(v.city), state: str(v.state), notes: str(v.notes),
        }),
      })

      if (!res.ok) {
        const corpo = await res.json().catch(() => null) as { message?: string } | null
        setErro(corpo?.message || 'Erro ao salvar veículo. Tente novamente.')
        return
      }

      const data = await res.json() as { created: boolean }
      setSucesso(data.created ? 'Veículo cadastrado!' : 'Veículo atualizado!')
      setTimeout(() => setSucesso(null), 3000)
    } catch {
      setErro('Erro ao salvar veículo. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5">

      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414] flex items-center gap-2">
          <Car size={14} className="text-[#E8B84B]" />
          <h2 className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Veículo
          </h2>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <p className="text-[#555] text-xs -mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Cadastre seu veículo pra agilizar a entrada no estacionamento dos eventos.
            Só a placa é obrigatória — o resto ajuda a identificar o carro mais rápido.
          </p>

          <Field label="Placa">
            <div className="relative">
              <Input value={v.plate} onChange={set('plate')} onBlur={e => handleBlurPlaca(e.target.value)}
                placeholder="ABC1D23" maxLength={8}
                style={{ textTransform: 'uppercase' }} autoComplete="off" className={inp.replace('px-4', 'pr-10')} />
              {buscandoPlaca && (
                <Loader2 size={14} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
              )}
            </div>
          </Field>

          {placaEncontrada && (
            <div className="flex items-center gap-2 -mt-2 text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Sparkles size={13} />
              Esse veículo já estava cadastrado — preenchemos o que faltava.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Apelido do veículo" optional>
              <Input value={v.name} onChange={set('name')} placeholder="Ex: Carro do trabalho" />
            </Field>
            <Field label="Tipo" optional>
              <Input value={v.type} onChange={set('type')} placeholder="Ex: carro, moto..." />
            </Field>
            <Field label="Marca" optional>
              <Input value={v.brand} onChange={set('brand')} placeholder="Ex: Fiat" />
            </Field>
            <Field label="Modelo" optional>
              <Input value={v.model} onChange={set('model')} placeholder="Ex: Strada" />
            </Field>
            <Field label="Ano" optional>
              <Input value={v.year} onChange={set('year')} inputMode="numeric" placeholder="2022" />
            </Field>
            <Field label="Cor" optional>
              <Input value={v.color} onChange={set('color')} placeholder="Ex: Branco" />
            </Field>
            <Field label="Status" optional>
              <Input value={v.status} onChange={set('status')} placeholder="Ex: ativo" />
            </Field>
            <Field label="Categoria" optional>
              <Input value={v.category} onChange={set('category')} placeholder="Ex: passeio" />
            </Field>
          </div>
        </div>
      </div>

      <Secao titulo="Documento (CRLV)" aberta={abertas.documento} onToggle={() => toggle('documento')}>
        <Field label="Chassi" optional><Input value={v.chassis_number} onChange={set('chassis_number')} /></Field>
        <Field label="Renavam" optional><Input value={v.renavam} onChange={set('renavam')} inputMode="numeric" /></Field>
        <Field label="Número do motor" optional><Input value={v.engine_number} onChange={set('engine_number')} /></Field>
        <Field label="Código de segurança CRV" optional><Input value={v.security_code} onChange={set('security_code')} /></Field>
        <Field label="Validade do licenciamento" optional><Input type="date" value={v.license_expiry} onChange={set('license_expiry')} /></Field>
        <Field label="Exercício de licenciamento" optional><Input value={v.licensing_year} onChange={set('licensing_year')} inputMode="numeric" placeholder="2026" /></Field>
        <Field label="Espécie (CRLV)" optional><Input value={v.species} onChange={set('species')} /></Field>
        <Field label="Carroceria" optional><Input value={v.body_type} onChange={set('body_type')} /></Field>
        <div className="sm:col-span-2">
          <Field label="Restrições/observações do documento" optional>
            <Input value={v.restrictions} onChange={set('restrictions')} />
          </Field>
        </div>
      </Secao>

      <Secao titulo="Características técnicas" aberta={abertas.tecnico} onToggle={() => toggle('tecnico')}>
        <Field label="Odômetro (km)" optional><Input value={v.odometer_km} onChange={set('odometer_km')} inputMode="numeric" /></Field>
        <Field label="Combustível" optional><Input value={v.fuel_type} onChange={set('fuel_type')} /></Field>
        <Field label="Capacidade (passageiros/carga)" optional><Input value={v.capacity} onChange={set('capacity')} inputMode="numeric" /></Field>
        <Field label="Potência (CV)" optional><Input value={v.power_cv} onChange={set('power_cv')} inputMode="numeric" /></Field>
        <Field label="Cilindrada" optional><Input value={v.displacement} onChange={set('displacement')} /></Field>
        <Field label="Capacidade máxima de tração" optional><Input value={v.cmt} onChange={set('cmt')} /></Field>
        <Field label="Número de eixos" optional><Input value={v.axles} onChange={set('axles')} inputMode="numeric" /></Field>
      </Secao>

      <Secao titulo="Proprietário, motorista e local" aberta={abertas.dono} onToggle={() => toggle('dono')}>
        <Field label="Nome do proprietário" optional><Input value={v.owner_name} onChange={set('owner_name')} /></Field>
        <Field label="CPF/CNPJ do proprietário" optional><Input value={v.owner_document} onChange={set('owner_document')} inputMode="numeric" /></Field>
        <Field label="Telefone do motorista" optional><Input value={v.driver_phone} onChange={set('driver_phone')} inputMode="tel" /></Field>
        <Field label="Cidade (do documento)" optional><Input value={v.city} onChange={set('city')} /></Field>
        <Field label="Estado (UF)" optional><Input value={v.state} onChange={set('state')} maxLength={2} style={{ textTransform: 'uppercase' }} /></Field>
        <div className="sm:col-span-2">
          <Field label="Observações" optional><Input value={v.notes} onChange={set('notes')} /></Field>
        </div>
      </Secao>

      {erro && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <AlertCircle size={14} className="shrink-0" />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/8 border border-green-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <CheckCircle size={14} className="shrink-0" />
          {sucesso}
        </div>
      )}

      <button type="submit" disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
        {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar veículo'}
      </button>
    </form>
  )
}
