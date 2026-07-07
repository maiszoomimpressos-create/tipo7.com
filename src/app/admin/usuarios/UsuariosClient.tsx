'use client'

import { useState, useMemo } from 'react'
import { Search, ShoppingBag } from 'lucide-react'

const ACCENT = '#E8B84B'

type Row = {
  id:         string
  email:      string
  nome:       string
  cpf:        string | null
  phone:      string | null
  cadastroEm: string
  qtdCompras: number
  totalGasto: number
}

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(r =>
      r.nome.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.phone ?? '').includes(q)
    )
  }, [rows, search])

  return (
    <div className="flex flex-col gap-4">

      {/* Busca */}
      <div className="relative w-80">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444]" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
              {['Usuário', 'CPF', 'Telefone', 'Cadastro', 'Compras'].map(h => (
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
                <td colSpan={5} className="px-4 py-10 text-center text-[#333] text-sm"
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
