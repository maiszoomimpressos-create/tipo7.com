import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarClienteParaAutosave } from '@/lib/autosave'

// POST /api/auth/sync-autosave
// Manda o cadastro atual do usuário logado pra Autosave (best-effort, via
// de mão dupla com cpf-lookup/cpf-confirmar). Chamado depois que o cadastro
// termina (AuthContext.signUp) ou o perfil é salvo (ProfileForm). Não recebe
// body — sempre lê o profile mais atual direto do banco, pra nunca mandar
// dado desatualizado nem depender do que o client tem em memória.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, cpf, phone, rg, birth_date, zip_code, street, street_number, neighborhood, city, state, complement')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ ok: true })

  await enviarClienteParaAutosave({
    external_id:   user.id,
    full_name:     profile.full_name    ?? undefined,
    email:         user.email           ?? undefined,
    cpf:           profile.cpf          ?? undefined,
    phone:         profile.phone        ?? undefined,
    rg:            profile.rg           ?? undefined,
    birth_date:    profile.birth_date   ?? undefined,
    zip_code:      profile.zip_code     ?? undefined,
    street:        profile.street       ?? undefined,
    street_number: profile.street_number ?? undefined,
    neighborhood:  profile.neighborhood  ?? undefined,
    city:          profile.city          ?? undefined,
    state:         profile.state         ?? undefined,
    complement:    profile.complement    ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
