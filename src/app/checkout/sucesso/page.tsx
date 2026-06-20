import { CheckCircle2, Ticket, Home } from 'lucide-react'
import { Header } from '@/components/layout/Header'

export default function CheckoutSucessoPage() {
  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center flex flex-col items-center gap-6">

          <div className="w-20 h-20 rounded-full flex items-center justify-center"
               style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <CheckCircle2 size={40} className="text-green-400" />
          </div>

          <div>
            <h1 className="text-3xl text-white mb-2"
                style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
              Pagamento aprovado!
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Seus ingressos foram confirmados. Você receberá um e-mail em breve.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <a href="/meus-ingressos"
               className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
               style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
              <Ticket size={15} />
              Ver meus ingressos
            </a>
            <a href="/"
               className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#555] border border-[#1a1a1a] hover:text-white hover:border-[#333] transition-all"
               style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Home size={15} />
              Voltar ao início
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
