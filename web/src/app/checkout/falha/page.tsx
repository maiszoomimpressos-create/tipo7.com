import { XCircle, RotateCcw, Home } from 'lucide-react'
import { Header } from '@/components/layout/Header'

export default function CheckoutFalhaPage() {
  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center flex flex-col items-center gap-6">

          <div className="w-20 h-20 rounded-full flex items-center justify-center"
               style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <XCircle size={40} className="text-red-400" />
          </div>

          <div>
            <h1 className="text-3xl text-white mb-2"
                style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
              Pagamento não aprovado
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Não conseguimos processar seu pagamento. Verifique os dados e tente novamente.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <a href="javascript:history.back()"
               className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
               style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
              <RotateCcw size={15} />
              Tentar novamente
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
