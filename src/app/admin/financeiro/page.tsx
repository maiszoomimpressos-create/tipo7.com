import { createServiceClient } from '@/lib/supabase/server'
import { FinanceiroClient } from './FinanceiroClient'

export default async function FinanceiroPage() {
  const admin = createServiceClient()

  const { data: settings } = await admin
    .from('platform_settings')
    .select('key, value')

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value

  const { data: mpAccounts } = await admin
    .from('promotor_mp_accounts')
    .select('user_id, fee_pct')

  const feePcts = (mpAccounts ?? []).map(a => Number(a.fee_pct))
  const mediaFee = feePcts.length > 0
    ? feePcts.reduce((s, f) => s + f, 0) / feePcts.length
    : Number(settingsMap['default_fee_pct'] ?? 10)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Financeiro
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Tarifas e políticas da plataforma
        </p>
      </div>

      <FinanceiroClient
        defaultFeePct={Number(settingsMap['default_fee_pct'] ?? 10)}
        totalConectados={mpAccounts?.length ?? 0}
        mediaFee={mediaFee}
      />
    </div>
  )
}
