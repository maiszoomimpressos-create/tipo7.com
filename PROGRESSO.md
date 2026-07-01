# Tipo7.com — Registro de Progresso

> Documento atualizado automaticamente. Registra tudo que foi decidido, construído e configurado.

---

## Credenciais e Acessos

> As chaves estão salvas no arquivo `.env` na raiz do projeto.
> **Nunca compartilhe esse arquivo publicamente nem suba ele para o GitHub.**

| Item | Valor |
|---|---|
| Supabase Project ID | `qnrvoqmfuczsieytpdhu` |
| Supabase URL | `https://qnrvoqmfuczsieytpdhu.supabase.co` |
| Supabase Anon Key | no arquivo `.env` → `SUPABASE_ANON_KEY` |
| Supabase Service Role Key | no arquivo `.env` → `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase Access Token | no arquivo `.env` → `SUPABASE_ACCESS_TOKEN` |
| Região do servidor | `sa-east-1` (São Paulo) |

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Web (site/painel) | Next.js |
| App mobile | React Native + Expo |
| Backend/API | NestJS |
| Banco de dados | Supabase (PostgreSQL) |
| Cache | Redis |
| Pagamentos | Mercado Pago |
| Linguagem | TypeScript (em tudo) |

---

## Arquitetura Definida

### Multi-tenant
- Cada organização (promotora ou estabelecimento) é um tenant isolado
- Um usuário pode pertencer a múltiplos tenants com papéis diferentes em cada um
- Segurança garantida via RLS (Row Level Security) do Supabase

### Papéis da Plataforma (fixos)
Um usuário pode ter vários papéis ao mesmo tempo:

| Papel | Descrição |
|---|---|
| `comprador` | Padrão para todos. Compra ingressos de qualquer evento. |
| `promotor` | Cria e gerencia seus próprios eventos. |
| `estabelecimento` | Dono de local/venue. |
| `gestor` | Trabalha para um promotor gerenciando operações de um evento. |
| `admin` | Administrador geral da plataforma Tipo7.com. |

### Cargos por Evento (personalizáveis)
O promotor cria cargos livres para cada evento (ex: "Segurança Portão A", "Garçom").
Cada cargo tem permissões configuráveis:

| Permissão | O que permite |
|---|---|
| `validar_ingresso` | Escanear e validar ingressos na entrada |
| `ver_lista_convidados` | Ver a lista de compradores/convidados |
| `ver_relatorios` | Ver relatórios de vendas e presença |
| `gerenciar_checkin` | Controlar entrada e saída no evento |
| `gerenciar_equipe` | Convidar e gerenciar outros membros da equipe |

### Sistema de Validação de Ingressos (proprietário — 6 camadas)
1. QR Code criptografado e proprietário
2. Token dinâmico (muda a cada 30 segundos, estilo TOTP)
3. Uso único (invalida após escaneado)
4. Impressão digital do dispositivo (vincula ao celular do comprador)
5. Geolocalização (confirma proximidade ao evento)
6. Confirmação ativa (notificação no app do comprador na hora da entrada)

---

## Banco de Dados — Tabelas Criadas

**Migration:** `supabase/migrations/20260615000001_usuarios_e_papeis.sql`
**Status:** ✅ Aplicada em produção em 15/06/2026

| Tabela | Descrição |
|---|---|
| `profiles` | Dados do usuário (nome, CPF, telefone, foto). Criado automaticamente no cadastro. |
| `user_platform_roles` | Papéis de cada usuário na plataforma. Um usuário pode ter múltiplos. |
| `organizations` | Empresas promotoras e estabelecimentos cadastrados. |
| `organization_members` | Membros de cada organização com seus papéis e status. |
| `events` | Eventos criados pelas organizações. |
| `event_positions` | Cargos personalizados criados pelo promotor para cada evento. |
| `event_position_permissions` | Permissões atribuídas a cada cargo de evento. |
| `event_staff` | Usuários escalados com cargos em eventos específicos. |

---

## Módulos do Sistema — Status

| Módulo | Status |
|---|---|
| Estrutura do banco de dados (usuários, papéis, eventos, cargos) | ✅ Concluído |
| Projeto Next.js (web) configurado com Supabase | ✅ Concluído |
| Landing page — Header com logo e botão de acesso | ✅ Concluído |
| Landing page — Carrossel de eventos (estilo Sympla, responsivo) | ✅ Concluído |
| Landing page — Geolocalização (detecta cidade, filtra eventos) | ✅ Concluído |
| Landing page — Busca de eventos reais do banco por cidade | ✅ Concluído |
| Landing page — Filtros de categoria (Show, Festival, Teatro...) | 🔥 Próximo |
| Landing page — Barra de busca por nome/artista | 🔥 Próximo |
| Landing page — Grade de cards de eventos | 🔥 Próximo |
| Landing page — Seção "Crie seu evento" (para promotores) | 🔥 Próximo |
| Landing page — Rodapé | 🔜 A fazer |
| RLS (políticas de segurança por linha no banco) | 🔜 A fazer |
| Autenticação de usuários (login/cadastro) | 🔜 A fazer |
| Cadastro e gestão de organizações | 🔜 A fazer |
| Cadastro e gestão de eventos | 🔜 A fazer |
| Venda de ingressos | 🔜 A fazer |
| Sistema de validação de ingressos (QR proprietário) | 🔜 A fazer |
| Pagamentos (Mercado Pago) | 🔜 A fazer |
| Painel do promotor | 🔜 A fazer |
| App mobile (React Native + Expo) | 🔜 A fazer |
| Painel administrativo Tipo7.com | 🔜 A fazer |
| Sistema de notificações | 🔜 A fazer |
| Relatórios e analytics | 🔜 A fazer |

---

## Arquivos do Projeto

```
Tipo7.com/
├── .env                                        ← chaves e credenciais globais
├── PROJETO.md                                  ← visão geral do produto
├── PROGRESSO.md                                ← este arquivo
├── supabase/
│   └── migrations/
│       ├── 20260615000001_usuarios_e_papeis.sql   ← estrutura base do banco
│       └── 20260615000002_eventos_exemplo.sql     ← dados de teste (remover em prod)
└── web/                                        ← projeto Next.js
    ├── .env.local                              ← chaves do Supabase
    ├── next.config.ts                          ← config de imagens externas
    └── src/
        ├── app/
        │   ├── layout.tsx                      ← fontes: Syne + Outfit + DM Sans
        │   ├── globals.css                     ← design system (cores, variáveis)
        │   ├── page.tsx                        ← landing page
        │   └── api/eventos/destaque/route.ts   ← API: busca eventos por cidade
        ├── components/
        │   ├── layout/
        │   │   └── Header.tsx                  ← header fixo com logo e botão
        │   └── home/
        │       ├── Carousel.tsx                ← carrossel responsivo com imagens reais
        │       └── LocationBar.tsx             ← barra de localização do usuário
        ├── contexts/
        │   └── LocationContext.tsx             ← contexto de cidade compartilhado
        ├── hooks/
        │   ├── useGeolocation.ts               ← detecta cidade via GPS/rede
        │   └── useWindowSize.ts                ← breakpoints responsivos
        └── lib/
            ├── supabase/
            │   ├── client.ts                   ← cliente Supabase (navegador)
            │   └── server.ts                   ← cliente Supabase (servidor)
            └── utils.ts                        ← utilitários CSS
```

---

## Regras de Trabalho

- Todo código tem comentários explicando o que faz e por quê
- Todas as alterações no banco são feitas via código (nunca manualmente no painel)
- Nunca commitar o arquivo `.env` no Git
