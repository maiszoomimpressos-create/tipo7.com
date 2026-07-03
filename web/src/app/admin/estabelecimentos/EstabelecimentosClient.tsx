'use client'

import { useState, useMemo } from 'react'
import { Search, MapPin, Users } from 'lucide-react'

const ACCENT = '#E8B84B'

type Row = {
  id:          string
  nome:        string
  razaoSocial: string
  cnpj:        string | null
  codigo:      string | null
  phone:       string | null
  cidade:      string | null
  estado:      string | null
  capacidade:  number | null
  dono:        string
  cadastroEm:  string
}

function maskCNPJ(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function EstabelecimentosClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(r =>
      r.nome.toLowerCase().includes(q) ||
      r.razaoSocial.toLowerCase().includes(q) ||
      (r.cidade ?? '').toLowerCase().includes(q) ||
      (r.cnpj ?? '').includes(q)
    )
  }, [rows, search])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: '#111', border: '1px solid #1a1a1a' }}
        >
          <MapPin size={22} className="text-[#333]" />
        </div>
        <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Nenhum estabelecimento cadastrado ainda.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Busca */}
      <div className="relative w-80">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444]" />
        <input
          type="text"
          placeholder="Buscar por nome, cidade ou CNPJ..."
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
              {['Estabelecimento', 'CNPJ', 'Localização', 'Capacidade', 'Responsável', 'Cadastro'].map(h => (
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
                <td colSpan={6} className="px-4 py-10 text-center text-[#333] text-sm"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Nenhum estabelecimento encontrado.
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
                {/* Nome + código + razão social */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 leading-tight">
                    <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {row.nome}
                    </p>
                    {row.codigo && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(232,184,75,0.10)', color: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                        {row.codigo}
                      </span>
                    )}
                  </div>
                  {row.razaoSocial !== row.nome && (
                    <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {row.razaoSocial}
                    </p>
                  )}
                  {row.phone && (
                    <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {row.phone}
                    </p>
                  )}
                </td>

                {/* CNPJ */}
                <td className="px-4 py-3">
                  <span className="text-[#666] text-sm font-mono" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {row.cnpj ? maskCNPJ(row.cnpj) : '—'}
                  </span>
                </td>

                {/* Localização */}
                <td className="px-4 py-3">
                  {row.cidade ? (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-[#444] shrink-0" />
                      <span className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {row.cidade}{row.estado ? `, ${row.estado}` : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[#333] text-sm">—</span>
                  )}
                </td>

                {/* Capacidade */}
                <td className="px-4 py-3">
                  {row.capacidade ? (
                    <div className="flex items-center gap-1.5">
                      <Users size={11} style={{ color: ACCENT }} />
                      <span className="text-sm" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                        {row.capacidade.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[#333] text-sm">—</span>
                  )}
                </td>

                {/* Responsável */}
                <td className="px-4 py-3">
                  <span className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {row.dono}
                  </span>
                </td>

                {/* Data de cadastro */}
                <td className="px-4 py-3">
                  <span className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {fmtDate(row.cadastroEm)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length < rows.length && (
        <p className="text-[#333] text-xs text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Mostrando {filtered.length} de {rows.length} estabelecimentos
        </p>
      )}
    </div>
  )
}
