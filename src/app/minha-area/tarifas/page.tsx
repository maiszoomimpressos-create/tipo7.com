import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { Info, CheckCircle2 } from 'lucide-react'

const ACCENT = '#E8B84B'

const FEE_KEYS = [
  'default_fee_pct',
  'fee_desc_plataforma',
  'fee_pct_pix',
  'fee_pct_debito',
  'fee_pct_credito_1x',
  'fee_pct_credito_6x',
  'fee_pct_credito_12x',
  'fee_nota_extra',
]

function pct(v: string) {
  return parseFloat(v.replace(',', '.'))
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Calcula o que o promotor recebe líquido para um ingresso de R$valor
// Simplificação: aplica taxa da plataforma + taxa MP sobre o valor de face
function liquido(valor: number, platformPct: number, mpPct: number) {
  return valor * (1 - platformPct / 100) * (1 - mpPct / 100)
}

export default async function TarifasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/minha-area/tarifas')

  const admin = createServiceClient()

  const { data: settingsRows } = await admin
    .from('platform_settings')
    .select('key, value')
    .in('key', FEE_KEYS)

  const s: Record<string, string> = {}
  for (const row of settingsRows ?? []) s[row.key] = row.value

  const platformPct   = pct(s['default_fee_pct']      ?? '10')
  const descPlat      = s['fee_desc_plataforma']       ?? ''
  const pctPix        = pct(s['fee_pct_pix']           ?? '0,99')
  const pctDebito     = pct(s['fee_pct_debito']        ?? '1,49')
  const pctCredito1x  = pct(s['fee_pct_credito_1x']   ?? '4,98')
  const pctCredito6x  = pct(s['fee_pct_credito_6x']   ?? '5,98')
  const pctCredito12x = pct(s['fee_pct_credito_12x']  ?? '6,98')
  const notaExtra     = s['fee_nota_extra']             ?? ''

  // Modelo B: 12% tudo incluso — promotor sempre recebe (100 - platformPct)% do valor de face
  const exemplo      = 100
  const recebeLiquido = exemplo * (1 - platformPct / 100)
  const exemploMetodos = [
    { label: 'PIX',             mp: pctPix,        recebe: recebeLiquido, juros: false },
    { label: 'Débito',          mp: pctDebito,     recebe: recebeLiquido, juros: false },
    { label: 'Crédito à vista', mp: pctCredito1x,  recebe: recebeLiquido, juros: false },
    { label: 'Crédito 2–6×',    mp: pctCredito6x,  recebe: recebeLiquido, juros: true  },
    { label: 'Crédito 7–12×',   mp: pctCredito12x, recebe: recebeLiquido, juros: true  },
  ]

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="max-w-2xl mx-auto px-4 py-12 w-full flex flex-col gap-8">

          {/* Cabeçalho */}
          <div>
            <h1 className="text-2xl text-white mb-1"
                style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
              Como funciona a cobrança
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Entenda as taxas aplicadas em cada venda realizada na plataforma.
            </p>
          </div>

          {/* Card: Taxa da plataforma */}
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#141414] flex items-center justify-between">
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Taxa da plataforma (Tipo7)
              </p>
              <span className="text-base font-bold" style={{ color: ACCENT, fontFamily: 'var(--font-syne)' }}>
                {platformPct}%
              </span>
            </div>
            <div className="px-6 py-4">
              <p className="text-[#555] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {descPlat || `A Tipo7 cobra ${platformPct}% sobre o valor de cada ingresso vendido. Essa taxa é descontada automaticamente no momento do repasse.`}
              </p>
            </div>
          </div>

          {/* Card: Taxas do Mercado Pago */}
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#141414]">
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Taxas do Mercado Pago
              </p>
              <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Cobradas pelo processador de pagamento por método utilizado
              </p>
            </div>
            <div className="px-6 py-2 pb-4">
              {[
                { label: 'PIX',            valor: pctPix        },
                { label: 'Débito',         valor: pctDebito     },
                { label: 'Crédito 1×',     valor: pctCredito1x  },
                { label: 'Crédito 2–6×',   valor: pctCredito6x  },
                { label: 'Crédito 7–12×',  valor: pctCredito12x },
              ].map(({ label, valor }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#111] last:border-0">
                  <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                  <p className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{valor.toLocaleString('pt-BR')}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Juros do parcelamento */}
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] px-6 py-5 flex items-start gap-3">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-green-400" />
            <div>
              <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Juros do parcelamento são pagos pelo comprador
              </p>
              <p className="text-[#555] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Quando o comprador parcela o pagamento, os juros são cobrados direto dele — você sempre recebe o valor de face do ingresso como base de cálculo. Por exemplo: ingresso de R$100 parcelado em 6× com juros de 5,98% → o comprador paga R$105,98, mas sua base de recebimento continua sendo R$100.
              </p>
            </div>
          </div>

          {/* Card: Exemplos práticos */}
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#141414]">
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Exemplos práticos
              </p>
              <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Para um ingresso de {brl(exemplo)} — valor aproximado descontadas todas as taxas
              </p>
            </div>

            <div className="px-6 py-2 pb-4">
              {exemploMetodos.map(({ label, mp, recebe, juros }) => (
                <div key={label} className="py-3.5 border-b border-[#111] last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {label}
                      </p>
                      <p className="text-[#383838] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {brl(exemplo)} − {platformPct}% (inclui taxa MP de {mp.toLocaleString('pt-BR')}%)
                        {juros && ' · juros pagos pelo comprador'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                        {brl(recebe)}
                      </p>
                      <p className="text-[#383838] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        você recebe
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-6 mb-5 flex items-start gap-2 px-3 py-2.5 rounded-xl"
                 style={{ background: '#0a0a0a', border: '1px solid #161616' }}>
              <Info size={11} className="shrink-0 mt-0.5 text-[#333]" />
              <p className="text-[#383838] text-[11px] leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Os valores acima são aproximados. O repasse final pode variar conforme regras específicas do seu contrato ou disputas de pagamento.
              </p>
            </div>
          </div>

          {/* Nota extra */}
          {notaExtra && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
                 style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              <Info size={13} className="shrink-0 mt-0.5" style={{ color: ACCENT }} />
              <p className="text-[#555] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {notaExtra}
              </p>
            </div>
          )}

          {/* Link para contas */}
          <div className="flex flex-col gap-2">
            <p className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Para receber os pagamentos, conecte sua conta do Mercado Pago.
            </p>
            <a
              href="/configuracoes/contas"
              className="self-start text-xs px-4 py-2 rounded-xl transition-all hover:brightness-110"
              style={{
                background:  `${ACCENT}15`,
                color:       ACCENT,
                border:      `1px solid ${ACCENT}30`,
                fontFamily:  'var(--font-dm-sans)',
              }}
            >
              Configurar conta de pagamento →
            </a>
          </div>

        </main>
      </PromoterLayout>
    </div>
  )
}
