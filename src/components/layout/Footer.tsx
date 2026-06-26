import { Ticket } from 'lucide-react'

const LINKS = {
  Plataforma: [
    { label: 'Explorar eventos',  href: '/eventos'       },
    { label: 'Criar evento',      href: '/criar-evento'  },
    { label: 'Minha conta',       href: '/perfil'        },
    { label: 'Meus ingressos',    href: '/meus-ingressos'},
  ],
  Suporte: [
    { label: 'Central de ajuda',  href: '#' },
    { label: 'Fale conosco',      href: '#' },
    { label: 'Para promotores',   href: '#' },
  ],
  Legal: [
    { label: 'Termos de uso',       href: '/termos'            },
    { label: 'Privacidade',         href: '/privacidade'       },
    { label: 'Proteção de dados',   href: '/protecao-de-dados' },
  ],
}

export function Footer() {
  const ano = new Date().getFullYear()

  return (
    <footer className="border-t border-[#111] bg-[#070707]">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Topo: logo + colunas de links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

          {/* Marca */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <a href="/" className="flex items-center gap-2 w-fit">
              <Ticket size={18} style={{ color: '#E8B84B' }} />
              <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 16 }}>
                <span className="text-white">tipo</span>
                <span style={{ color: '#E8B84B' }}>7</span>
              </span>
            </a>
            <p className="text-[#333] text-xs leading-relaxed max-w-[180px]"
               style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Plataforma de criação e venda de ingressos para eventos de todos os tamanhos.
            </p>
          </div>

          {/* Colunas de links */}
          {Object.entries(LINKS).map(([titulo, itens]) => (
            <div key={titulo} className="flex flex-col gap-3">
              <p className="text-[#333] text-[11px] font-semibold uppercase tracking-widest"
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {titulo}
              </p>
              <ul className="flex flex-col gap-2.5">
                {itens.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[#444] text-xs hover:text-white transition-colors duration-150"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Linha divisória */}
        <div className="h-px bg-[#111] mb-6" />

        {/* Rodapé inferior */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[#2a2a2a] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            © {ano} Tipo7. Todos os direitos reservados.
          </p>
          <p className="text-[#2a2a2a] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Feito no Brasil 🇧🇷
          </p>
        </div>

      </div>
    </footer>
  )
}
