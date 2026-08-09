import { IngressosAdminClient } from './IngressosAdminClient'

export default function AdminIngressosPage() {
  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Ingressos
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Busque por CPF, e-mail, nome, evento, ou os IDs exatos (ingresso, pedido, pagamento).
        </p>
      </div>
      <IngressosAdminClient />
    </div>
  )
}
