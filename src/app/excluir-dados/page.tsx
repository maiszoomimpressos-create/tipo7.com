// Página de instruções para exclusão de dados — exigida pelo Facebook para publicar o app
// Explica como o usuário pode solicitar a remoção dos seus dados da plataforma
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { LegalNav } from '@/components/legal/LegalNav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Excluir meus dados — Tipo7',
  description: 'Saiba como solicitar a exclusão dos seus dados pessoais da plataforma Tipo7.',
}

export default function ExcluirDadosPage() {
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
              Excluir meus dados
            </h1>
            <p className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Atualizado em 27 de junho de 2026
            </p>
          </div>

          <div
            className="space-y-8 text-[#aaa] leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <section>
              <h2 className="text-white text-xl font-semibold mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
                Como solicitar a exclusão dos seus dados
              </h2>
              <p>
                Você tem o direito de solicitar a exclusão de todos os seus dados pessoais armazenados
                na plataforma Tipo7, incluindo dados de cadastro, histórico de compras e informações
                obtidas via login com Facebook ou Google.
              </p>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
                Opção 1 — Pela sua conta
              </h2>
              <ol className="list-decimal list-inside space-y-2">
                <li>Acesse <span className="text-white font-medium">tipo7.com</span> e faça login</li>
                <li>Vá em <span className="text-white font-medium">Minha área → Perfil</span></li>
                <li>Role até o final da página e clique em <span className="text-white font-medium">"Excluir minha conta"</span></li>
                <li>Confirme a exclusão — todos os seus dados serão removidos em até 30 dias</li>
              </ol>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
                Opção 2 — Por e-mail
              </h2>
              <p>
                Envie um e-mail para{' '}
                <a
                  href="mailto:contato@tipo7.com"
                  className="text-[#FFD700] hover:underline"
                >
                  contato@tipo7.com
                </a>{' '}
                com o assunto <span className="text-white font-medium">"Exclusão de dados"</span> e
                informe o e-mail cadastrado na sua conta. Responderemos em até 5 dias úteis e
                concluiremos a exclusão em até 30 dias.
              </p>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
                O que é excluído
              </h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Nome, e-mail, telefone, CPF e data de nascimento</li>
                <li>Histórico de pedidos e ingressos</li>
                <li>Conexão com Facebook, Google ou outras redes sociais</li>
                <li>Preferências e configurações de conta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
                O que pode ser mantido
              </h2>
              <p>
                Registros financeiros relacionados a transações concluídas podem ser mantidos pelo
                prazo legal exigido pela legislação fiscal brasileira (5 anos), mesmo após a exclusão
                da conta.
              </p>
            </section>

            <section className="border-t border-[#1a1a1a] pt-8">
              <p className="text-[#555] text-sm">
                Dúvidas? Entre em contato:{' '}
                <a href="mailto:contato@tipo7.com" className="text-[#FFD700] hover:underline">
                  contato@tipo7.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
