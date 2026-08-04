import { redirect }              from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { areaRestritaDesbloqueada } from '@/lib/areaRestrita'
import { TarifaModuloClient }    from '@/components/admin/TarifaModuloClient'
import { SaldoBilheteriaAdmin }  from '@/components/admin/SaldoBilheteriaAdmin'
import { AreaRestritaWatcher }   from '@/app/admin/area-restrita/AreaRestritaWatcher'

export default async function BilheteriaFinanceiroPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/admin/financeiro/bilheteria')

  const member = await getAdminMember(user.id)
  if (!member || !temAcessoRestrito(member)) redirect('/admin')
  if (!(await areaRestritaDesbloqueada(user.id))) redirect(`/admin/area-restrita?next=${encodeURIComponent('/admin/financeiro/bilheteria')}`)

  const admin = createServiceClient()
  const { data: settings } = await admin.from('platform_settings').select('key, value')

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value

  return (
    <div className="p-8 max-w-2xl">
      <AreaRestritaWatcher currentPath="/admin/financeiro/bilheteria" />
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Bilheteria
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Tarifas e políticas de vendas presenciais na bilheteria
        </p>
      </div>

      <TarifaModuloClient
        keyPrefix="bilheteria_"
        defaultFeePct={Number(settingsMap['bilheteria_default_fee_pct'] ?? 10)}
        defaultFeeType={(settingsMap['bilheteria_default_fee_type'] as 'fixed' | 'percent') ?? 'percent'}
        minFeePct={Number(settingsMap['bilheteria_min_fee_pct'] ?? 0)}
        extraFee1={{
          label: settingsMap['bilheteria_extra_fee_1_label'] ?? '',
          value: settingsMap['bilheteria_extra_fee_1_value'] ?? '0',
          type:  (settingsMap['bilheteria_extra_fee_1_type'] as 'fixed' | 'percent') ?? 'percent',
        }}
        extraFee2={{
          label: settingsMap['bilheteria_extra_fee_2_label'] ?? '',
          value: settingsMap['bilheteria_extra_fee_2_value'] ?? '0',
          type:  (settingsMap['bilheteria_extra_fee_2_type'] as 'fixed' | 'percent') ?? 'percent',
        }}
        descricao="Percentual padrão cobrado pela plataforma sobre as vendas feitas na bilheteria."
      />

      <div className="mt-8">
        <SaldoBilheteriaAdmin />
      </div>
    </div>
  )
}
