import { Ticket } from 'lucide-react'

const LINKS = {
  Plataforma: [
    { label: 'Explorar eventos',  href: '/eventos'        },
    { label: 'Criar evento',      href: '/criar-evento'   },
    { label: 'Minha conta',       href: '/perfil'         },
    { label: 'Meus ingressos',    href: '/meus-ingressos' },
  ],
  Suporte: [
    { label: 'Central de ajuda',  href: '#' },
    { label: 'Fale conosco',      href: '#' },
    { label: 'Para promotores',   href: '#' },
  ],
  Legal: [
    { label: 'Termos de uso',      href: '/termos'             },
    { label: 'Privacidade',        href: '/privacidade'        },
    { label: 'Proteção de dados',  href: '/protecao-de-dados'  },
  ],
}

export function Footer() {
  const ano = new Date().getFullYear()

  return (
    <footer style={{ background: 'var(--pp-bg)', borderTop: '1px solid var(--pp-border)' }}>
      <div className="max-w-6xl mx-auto px-6 py-14">

        {/* Topo: logo + colunas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

          {/* Marca */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <a href="/" className="flex items-center gap-2 w-fit group">
              <Ticket
                size={18}
                style={{ color: '#fb5607' }}
                className="transition-transform duration-300 group-hover:rotate-12"
              />
              <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 16 }}>
                <span style={{ color: 'var(--pp-text)' }}>tipo</span>
                <span style={{ color: '#fb5607' }}>7</span>
              </span>
            </a>
            <p
              className="text-xs leading-relaxed max-w-[180px]"
              style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--pp-text-3)' }}
            >
              Plataforma de criação e venda de ingressos para eventos de todos os tamanhos.
            </p>
          </div>

          {/* Colunas de links */}
          {Object.entries(LINKS).map(([titulo, itens]) => (
            <div key={titulo} className="flex flex-col gap-3">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--pp-text-3)' }}
              >
                {titulo}
              </p>
              <ul className="flex flex-col gap-2.5">
                {itens.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="t7-hover-orange text-xs"
                      style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--pp-text-3)' }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divisor */}
        <div className="pp-divider mb-6" />

        {/* Rodapé inferior */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p
            className="text-xs"
            style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--pp-text-3)' }}
          >
            © {ano} Tipo7. Todos os direitos reservados.
          </p>
          <p
            className="text-xs"
            style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--pp-text-3)' }}
          >
            Feito no Brasil 🇧🇷
          </p>
        </div>

      </div>
    </footer>
  )
}
