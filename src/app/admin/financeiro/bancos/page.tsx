import { createServiceClient } from '@/lib/supabase/server'
import { redirect }            from 'next/navigation'
import { createClient }        from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'
import { BancosClient }        from './BancosClient'

const FEE_KEYS = [
  'fee_desc_plataforma',
  'fee_pct_pix',
  'fee_pct_debito',
  'fee_pct_credito_1x',
  'fee_pct_credito_6x',
  'fee_pct_credito_12x',
  'fee_nota_extra',
]

export default async function BancosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/admin/financeiro/bancos')

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) redirect('/admin')

  const admin = createServiceClient()

  const [{ data: settings }, { data: platformFee }] = await Promise.all([
    admin.from('platform_settings').select('key, value').in('key', FEE_KEYS),
    admin.from('platform_settings').select('value').eq('key', 'default_fee_pct').single(),
  ])

  const s: Record<string, string> = {}
  for (const row of settings ?? []) s[row.key] = row.value

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Tarifas expostas ao promotor
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Configure aqui as informações de cobrança que serão exibidas para os promotores
        </p>
      </div>

      <BancosClient
        platformFeePct={platformFee?.value ?? '10'}
        descPlataforma={s['fee_desc_plataforma'] ?? ''}
        pctPix={s['fee_pct_pix']               ?? '0,99'}
        pctDebito={s['fee_pct_debito']          ?? '1,49'}
        pctCredito1x={s['fee_pct_credito_1x']   ?? '4,98'}
        pctCredito6x={s['fee_pct_credito_6x']   ?? '5,98'}
        pctCredito12x={s['fee_pct_credito_12x'] ?? '6,98'}
        notaExtra={s['fee_nota_extra']           ?? ''}
      />
    </div>
  )
}
