import { apiFetchServer } from '@/lib/apiFetchServer'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { LegalNav } from '@/components/legal/LegalNav'
import { marked } from 'marked'

export default async function ProtecaoDadosPage() {
  const res  = await apiFetchServer('/api/admin/conteudo?key=lgpd')
  const data = res.ok ? await res.json() as { content: string; updated_at: string | null } : null

  const raw       = data?.content    ?? ''
  const updatedAt = data?.updated_at ?? null
  const html      = raw ? String(await marked(raw)) : ''

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <LegalNav />
          <div className="mb-10">
            <h1
              className="text-3xl text-white font-bold mb-2"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Proteção de Dados Pessoais
            </h1>
            {updatedAt && (
              <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Atualizado em {new Date(updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {html ? (
            <div
              className="prose-legal"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              O documento de proteção de dados ainda não foi publicado. Volte em breve.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
