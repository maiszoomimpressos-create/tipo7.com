'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ShoppingBag, ChevronDown, RefreshCw } from 'lucide-react'
import { atualizarUsuarios } from './actions'

const ACCENT = '#E8B84B'

type Row = {
  id:         string
  email:      string
  nome:       string
  cpf:        string | null
  phone:      string | null
  userCode:   string | null
  cadastroEm: string
  qtdCompras: number
  totalGasto: number
  cep:        string | null
  endereco:   string | null
  cidade:     string | null
  estado:     string | null
}

type FiltroCampo = 'todos' | 'nome' | 'email' | 'codigo' | 'cpf' | 'endereco' | 'cep' | 'cidade' | 'estado'

const FILTROS: { value: FiltroCampo; label: string; placeholder: string }[] = [
  { value: 'todos',    label: 'Todos os campos', placeholder: 'Buscar por nome, email, código, CPF, endereço...' },
  { value: 'nome',     label: 'Nome',             placeholder: 'Buscar por nome...' },
  { value: 'email',    label: 'Email',            placeholder: 'Buscar por email...' },
  { value: 'codigo',   label: 'Código T7',        placeholder: 'Buscar por código T7...' },
  { value: 'cpf',      label: 'CPF',              placeholder: 'Buscar por CPF...' },
  { value: 'endereco', label: 'Endereço',         placeholder: 'Buscar por rua, número, bairro...' },
  { value: 'cep',      label: 'CEP',              placeholder: 'Buscar por CEP...' },
  { value: 'cidade',   label: 'Cidade',           placeholder: 'Buscar por cidade...' },
  { value: 'estado',   label: 'Estado',           placeholder: 'Buscar por estado (UF)...' },
]

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function maskCPF(cpf: string) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.***-**`
}

export function UsuariosClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroCampo>('todos')
  const [atualizando, startAtualizando] = useTransition()
  const router = useRouter()

  const filtroAtivo = FILTROS.find(f => f.value === filtro) ?? FILTROS[0]

  // A lista fica em cache por 1 min no servidor (evita bater no Auth Admin
  // e no banco a cada acesso). Esse botão força buscar dados novos agora.
  function handleAtualizar() {
    startAtualizando(async () => {
      await atualizarUsuarios()
      router.refresh()
    })
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    const qDigits = q.replace(/\D/g, '')

    return rows.filter(r => {
      switch (filtro) {
        case 'nome':     return r.nome.toLowerCase().includes(q)
        case 'email':    return r.email.toLowerCase().includes(q)
        case 'codigo':   return (r.userCode ?? '').toLowerCase().includes(q)
        case 'cpf':      return !!qDigits && (r.cpf ?? '').includes(qDigits)
        case 'endereco': return (r.endereco ?? '').toLowerCase().includes(q)
        case 'cep':      return !!qDigits && (r.cep ?? '').replace(/\D/g, '').includes(qDigits)
        case 'cidade':   return (r.cidade ?? '').toLowerCase().includes(q)
        case 'estado':   return (r.estado ?? '').toLowerCase().includes(q)
        default:
          return (
            r.nome.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            (r.phone ?? '').includes(q) ||
            (r.userCode ?? '').toLowerCase().includes(q) ||
            (!!qDigits && (r.cpf ?? '').includes(qDigits)) ||
            (r.endereco ?? '').toLowerCase().includes(q) ||
            (!!qDigits && (r.cep ?? '').replace(/\D/g, '').includes(qDigits)) ||
            (r.cidade ?? '').toLowerCase().includes(q) ||
            (r.estado ?? '').toLowerCase().includes(q)
          )
      }
    })
  }, [rows, search, filtro])

  return (
    <div className="flex flex-col gap-4">

      {/* Filtro de campo + busca */}
      <div className="flex items-center gap-3">
        {/* Seletor de campo a filtrar */}
        <div className="relative">
          <select
            value={filtro}
            onChange={e => setFiltro(e.target.value as FiltroCampo)}
            className="appearance-none bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl pl-3.5 pr-9 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 cursor-pointer"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {FILTROS.map(f => (
              <option key={f.value} value={f.value} style={{ background: '#0d0d0d' }}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#444]" />
        </div>

        {/* Busca */}
        <div className="relative w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444]" />
          <input
            type="text"
            placeholder={filtroAtivo.placeholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
        </div>

        {/* Força buscar dados novos — a lista normalmente vem de um cache de 1 min */}
        <button
          type="button"
          onClick={handleAtualizar}
          disabled={atualizando}
          title="A lista atualiza sozinha a cada 1 min. Clique para forçar agora."
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#1a1a1a] text-[#666] text-sm hover:text-[#E8B84B] hover:border-[#E8B84B]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          <RefreshCw size={13} className={atualizando ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
              {['Usuário', 'Código T7', 'CPF', 'Telefone', 'Localização', 'Cadastro', 'Compras'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[#444] text-xs font-medium uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#333] text-sm"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : filtered.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid #111' : 'none',
                  background: '#070707',
                }}
              >
                {/* Nome + email */}
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium leading-tight" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {row.nome}
                  </p>
                  <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {row.email}
                  </p>
                </td>

                {/* Código T7 */}
                <td className="px-4 py-3">
                  {row.userCode ? (
                    <span
                      className="px-2 py-1 rounded-lg text-xs font-mono font-semibold"
                      style={{ background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
                    >
                      {row.userCode}
                    </span>
                  ) : (
                    <span className="text-[#333] text-sm">—</span>
                  )}
                </td>

                {/* CPF */}
                <td className="px-4 py-3">
                  <span className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {row.cpf ? maskCPF(row.cpf) : '—'}
                  </span>
                </td>

                {/* Telefone */}
                <td className="px-4 py-3">
                  <span className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {row.phone ?? '—'}
                  </span>
                </td>

                {/* Localização — cidade/UF, com endereço e CEP completos no tooltip */}
                <td className="px-4 py-3">
                  {row.cidade || row.estado ? (
                    <span
                      className="text-[#666] text-sm"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                      title={[row.endereco, row.cep].filter(Boolean).join(' — ') || undefined}
                    >
                      {[row.cidade, row.estado].filter(Boolean).join('/')}
                    </span>
                  ) : (
                    <span className="text-[#333] text-sm">—</span>
                  )}
                </td>

                {/* Data de cadastro */}
                <td className="px-4 py-3">
                  <span className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {fmtDate(row.cadastroEm)}
                  </span>
                </td>

                {/* Compras */}
                <td className="px-4 py-3">
                  {row.qtdCompras > 0 ? (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag size={11} style={{ color: ACCENT }} />
                        <span className="text-sm font-medium" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                          {fmt(row.totalGasto)}
                        </span>
                      </div>
                      <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {row.qtdCompras} pedido{row.qtdCompras !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ) : (
                    <span className="text-[#333] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length < rows.length && (
        <p className="text-[#333] text-xs text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Mostrando {filtered.length} de {rows.length} usuários
        </p>
      )}
    </div>
  )
}
