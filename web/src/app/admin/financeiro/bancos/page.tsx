import { getAuthUser }         from '@/lib/auth/server'
import { redirect }            from 'next/navigation'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { apiFetchServer }      from '@/lib/apiFetchServer'
import { BancosClient }        from './BancosClient'
import { AreaRestritaWatcher } from '@/app/admin/area-restrita/AreaRestritaWatcher'

export default async function BancosPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/admin/financeiro/bancos')

  const member = await getAdminMember(user.id)
  if (!member || !temAcessoRestrito(member)) redirect('/admin')

  const statusRes = await apiFetchServer('/api/admin/area-restrita/status')
  const { desbloqueada } = statusRes.ok ? await statusRes.json() as { desbloqueada: boolean } : { desbloqueada: false }
  if (!desbloqueada) redirect(`/admin/area-restrita?next=${encodeURIComponent('/admin/financeiro/bancos')}`)

  const settingsRes = await apiFetchServer('/api/admin/settings')
  const { settings: s } = settingsRes.ok
    ? await settingsRes.json() as { settings: Record<string, string> }
    : { settings: {} as Record<string, string> }

  return (
    <div className="p-8 max-w-2xl">
      <AreaRestritaWatcher currentPath="/admin/financeiro/bancos" />
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Tarifas expostas ao promotor
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Configure aqui as informações de cobrança que serão exibidas para os promotores
        </p>
      </div>

      <BancosClient
        platformFeePct={s['default_fee_pct'] ?? '10'}
        descPlataforma={s['fee_desc_plataforma'] ?? ''}
        pctPix={s['fee_pct_pix']               ?? '0,99'}
        pctDebito={s['fee_pct_debito']          ?? '1,49'}
        pctCredito1x={s['fee_pct_credito_1x']   ?? '4,98'}
        pctCredito6x={s['fee_pct_credito_6x']   ?? '5,98'}
        pctCredito12x={s['fee_pct_credito_12x'] ?? '6,98'}
        notaExtra={s['fee_nota_extra']           ?? ''}
        mpCredenciais={{
          accessToken:   s['mp_access_token']   ?? '',
          publicKey:     s['mp_public_key']      ?? '',
          clientId:      s['mp_client_id']       ?? '',
          clientSecret:  s['mp_client_secret']   ?? '',
          webhookSecret: s['mp_webhook_secret']  ?? '',
        }}
        pagbankCredenciais={{
          token:        s['pagbank_token']         ?? '',
          accountId:    s['pagbank_account_id']    ?? '',
          clientId:     s['pagbank_client_id']     ?? '',
          clientSecret: s['pagbank_client_secret'] ?? '',
        }}
        logoMercadoPago={s['gateway_logo_mercadopago'] ?? null}
        logoPagbank={s['gateway_logo_pagbank']          ?? null}
      />
    </div>
  )
}
