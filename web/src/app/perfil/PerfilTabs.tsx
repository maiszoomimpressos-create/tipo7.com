'use client'

// Abas da página de perfil: Dados pessoais / Dados de promotor / Endereço.
// ProfileForm fica sempre montado (Dados pessoais + Endereço são o mesmo
// form/estado) — trocar de aba só esconde a seção via CSS, não desmonta,
// então nada que a pessoa digitou se perde ao ir e voltar entre abas.
import { useState } from 'react'
import { User, Building2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProfileForm }   from './ProfileForm'
import { PromotorForm }  from './PromotorForm'

type Aba = 'pessoais' | 'promotor' | 'endereco'

interface Props {
  userId:      string
  nomeUsuario: string
  initialPessoal: {
    full_name: string; phone: string; cpf: string; rg: string
    birth_date: string; avatar_url: string
    zip_code: string; street: string; street_number: string
    neighborhood: string; city: string; state: string
    address_type: string; complement: string
  }
  initialPromotor: {
    orgId:        string | null
    razaoSocial:  string
    cnpj:         string
    nomeFantasia: string
    codigo:       string | null
  }
}

const ABAS: { value: Aba; label: string; icon: typeof User }[] = [
  { value: 'pessoais', label: 'Dados pessoais',   icon: User },
  { value: 'promotor', label: 'Dados de promotor', icon: Building2 },
  { value: 'endereco', label: 'Endereço',          icon: MapPin },
]

export function PerfilTabs({ userId, nomeUsuario, initialPessoal, initialPromotor }: Props) {
  const [aba, setAba] = useState<Aba>('pessoais')

  return (
    <div className="flex flex-col gap-5">

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a] overflow-x-auto">
        {ABAS.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" onClick={() => setAba(value)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              aba === value ? 'bg-[#E8B84B]/10 text-[#E8B84B]' : 'text-[#666] hover:text-[#999]'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ProfileForm fica sempre montado (preserva o que foi digitado) e
          esconde Dados pessoais/Endereço entre si via secaoAtiva — mas some
          por inteiro (foto inclusa) na aba "promotor", que é tabela/form
          diferente e não dá pra misturar no mesmo estado. */}
      <div className={aba === 'promotor' ? 'hidden' : undefined}>
        <ProfileForm
          userId={userId}
          secaoAtiva={aba === 'endereco' ? 'endereco' : 'pessoais'}
          initial={initialPessoal}
        />
      </div>

      <div className={aba === 'promotor' ? undefined : 'hidden'}>
        <PromotorForm userId={userId} nomeUsuario={nomeUsuario} initial={initialPromotor} />
      </div>

    </div>
  )
}
