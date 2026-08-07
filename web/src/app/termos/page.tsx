import { apiFetchServer } from '@/lib/apiFetchServer'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { LegalNav } from '@/components/legal/LegalNav'
import { marked } from 'marked'

export default async function TermosPage() {
  // GET /admin/conteudo é público, sem guard — 404 quando a chave ainda
  // não foi publicada (mesmo fallback vazio que o .single() da Supabase já dava).
  const res  = await apiFetchServer('/api/admin/conteudo?key=termos')
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
              Termos de Uso
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
              Os termos de uso ainda não foram publicados. Volte em breve.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
