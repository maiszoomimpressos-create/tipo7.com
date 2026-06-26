import { createServiceClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { LegalNav } from '@/components/legal/LegalNav'
import { marked } from 'marked'

export const revalidate = 3600

export default async function PrivacidadePage() {
  const admin = createServiceClient()
  const { data } = await admin
    .from('platform_content')
    .select('content, updated_at')
    .eq('key', 'privacidade')
    .single()

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
              Política de Privacidade
            </h1>
            {updatedAt && (
              <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Atualizada em {new Date(updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
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
              A política de privacidade ainda não foi publicada. Volte em breve.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
