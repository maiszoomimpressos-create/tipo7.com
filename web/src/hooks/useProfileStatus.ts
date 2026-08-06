'use client'

// Hook que verifica se o perfil do usuário está completo
// Retorna quais campos ainda faltam preencher
// Adicione novos campos obrigatórios aqui conforme a plataforma crescer
import { useEffect, useState } from 'react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { useAuth } from '@/contexts/AuthContext'

export interface CampoFaltando {
  campo: string   // identificador interno
  label: string   // nome amigável exibido ao usuário
}

interface ProfileStatus {
  incompleto:      boolean             // true se qualquer campo obrigatório estiver vazio
  camposFaltando:  CampoFaltando[]     // lista dos campos que faltam
  carregando:      boolean
}

// Evento global disparado sempre que o perfil é salvo em qualquer lugar da
// aplicação (ex: ProfileForm), pra todo hook ativo revalidar na hora — sem
// esse evento, o badge de "perfil incompleto" no Header só sumia após um
// reload manual da página.
export const PROFILE_UPDATED_EVENT = 'tipo7:profile-updated'

export function useProfileStatus(): ProfileStatus {
  const { user } = useAuth()

  const [camposFaltando, setCamposFaltando] = useState<CampoFaltando[]>([])
  const [carregando,     setCarregando]     = useState(true)

  useEffect(() => {
    if (!user) { setCarregando(false); return }

    const buscarStatus = () => {
      apiFetchAuth('/api/profile')
        .then(res => res.ok ? res.json() : null)
        .then((data: {
          full_name: string | null; phone: string | null; cpf: string | null; birth_date: string | null
          zip_code: string | null; street: string | null; street_number: string | null
          neighborhood: string | null; address_type: string | null
        } | null) => {
          const faltando: CampoFaltando[] = []

          // Campos verificados agora — adicione mais abaixo conforme necessário
          if (!data?.full_name)     faltando.push({ campo: 'full_name',     label: 'Nome completo' })
          if (!data?.phone)         faltando.push({ campo: 'phone',         label: 'Telefone' })
          if (!data?.cpf)           faltando.push({ campo: 'cpf',           label: 'CPF' })
          if (!data?.birth_date)    faltando.push({ campo: 'birth_date',    label: 'Data de nascimento' })
          if (!data?.zip_code)      faltando.push({ campo: 'zip_code',      label: 'CEP' })
          if (!data?.street)        faltando.push({ campo: 'street',        label: 'Rua' })
          if (!data?.street_number) faltando.push({ campo: 'street_number', label: 'Número do endereço' })
          if (!data?.neighborhood)  faltando.push({ campo: 'neighborhood',  label: 'Bairro' })
          if (!data?.address_type)  faltando.push({ campo: 'address_type',  label: 'Tipo de residência' })

          setCamposFaltando(faltando)
          setCarregando(false)
        })
    }

    buscarStatus()
    window.addEventListener(PROFILE_UPDATED_EVENT, buscarStatus)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, buscarStatus)
  }, [user])

  return {
    incompleto:     camposFaltando.length > 0,
    camposFaltando,
    carregando,
  }
}
