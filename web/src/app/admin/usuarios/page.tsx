import { cookies } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { UsuariosClient } from './UsuariosClient'

// GET /usuarios/admin-lista já devolve o shape pronto (lê email direto de
// profiles, coluna adicionada na Fase 6; a API de Auth da Supabase que essa
// página usava antes ficou stale desde então e nunca via quem se cadastrava
// depois do corte de auth própria — bug real corrigido na Fase 7.1, só nunca
// tinha sido consumido aqui, achado na Fase 7.2 G15).
//
// Continua em cache por 1 minuto (tag "admin-usuarios") — mas `cookies()`/
// `headers()` não podem ser lidos DENTRO de unstable_cache (Next.js proíbe
// APIs dinâmicas ali dentro), então o token é lido fora e passado como
// argumento; o fetch aqui é direto (mesmo padrão do apiFetchServer, mas sem
// depender de cookies() no escopo cacheado).
const API_URL = process.env.API_URL ?? 'http://localhost:3001'

const getUsuarios = unstable_cache(
  async (token: string | undefined) => {
    const headers = new Headers()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${API_URL}/usuarios/admin-lista`, { headers, cache: 'no-store' })
    if (!res.ok) return []
    return res.json() as Promise<Array<{
      id: string; email: string; nome: string; cpf: string | null; phone: string | null
      userCode: string | null; cadastroEm: string; qtdCompras: number; totalGasto: number
      cep: string | null; endereco: string | null; cidade: string | null; estado: string | null
    }>>
  },
  ['admin-usuarios'],
  { revalidate: 60, tags: ['admin-usuarios'] },
)

export default async function UsuariosPage() {
  const token = (await cookies()).get('access_token')?.value
  const rows = await getUsuarios(token)

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Usuários
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {rows.length} usuário{rows.length !== 1 ? 's' : ''} cadastrado{rows.length !== 1 ? 's' : ''}
        </p>
      </div>
      <UsuariosClient rows={rows} />
    </div>
  )
}
