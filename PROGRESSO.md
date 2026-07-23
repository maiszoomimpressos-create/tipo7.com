# Tipo7.com — Registro de Progresso

> Documento atualizado automaticamente. Registra tudo que foi decidido, construído e configurado.

---

## Credenciais e Acessos

> As chaves estão salvas no arquivo `.env` na raiz do projeto.
> **Nunca compartilhe esse arquivo publicamente nem suba ele para o GitHub.**

| Item | Valor |
|---|---|
| Supabase Project ID | `emgkdnxvdfbdhsqmykom` (nome "tipo7" — corrigido em 23/07/2026, estava desatualizado aqui) |
| Supabase URL | `https://emgkdnxvdfbdhsqmykom.supabase.co` |
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

> ⚠️ Esta tabela estava desatualizada (última revisão manual: 15/06/2026). Em 20/07/2026 foi conferido o código real do projeto e vários itens marcados como "A fazer" já estavam implementados e funcionando. Corrigido abaixo.

| Módulo | Status |
|---|---|
| Estrutura do banco de dados (usuários, papéis, eventos, cargos) | ✅ Concluído |
| Projeto Next.js (web) configurado com Supabase | ✅ Concluído |
| Landing page — Header com logo e botão de acesso | ✅ Concluído |
| Landing page — Carrossel de eventos (estilo Sympla, responsivo) | ✅ Concluído |
| Landing page — Geolocalização (detecta cidade, filtra eventos) | ✅ Concluído |
| Landing page — Busca de eventos reais do banco por cidade | ✅ Concluído |
| RLS (políticas de segurança por linha no banco) | ✅ Concluído (migration `20260624000001_rls_events_profiles.sql`) |
| Autenticação de usuários (login/cadastro) | ✅ Concluído |
| Cadastro e gestão de organizações | ✅ Concluído (wizard `TipoPessoaModal`) |
| Cadastro e gestão de eventos | ✅ Concluído (wizard 4 etapas em `/criar-evento`) |
| Venda de ingressos | ✅ Concluído (`/checkout`, `event_tickets`, `orders`) |
| Sistema de validação de ingressos (QR proprietário) | ✅ Implementado (bilheteria, `app/bilheteria`) |
| Pagamentos (Mercado Pago) | ✅ Concluído (OAuth em `/api/mp/*`, também há PagBank) |
| Painel do promotor | ✅ Concluído (`/minha-area`, KPIs de receita/vendidos/checkins) |
| Landing page — Filtros de categoria (Show, Festival, Teatro...) | 🔥 Próximo |
| Landing page — Barra de busca por nome/artista | 🔥 Próximo |
| Landing page — Grade de cards de eventos | 🔥 Próximo |
| Landing page — Rodapé | 🔜 A fazer |
| App mobile (React Native + Expo) | 🔜 A fazer |
| Painel administrativo Tipo7.com | 🔜 A fazer |
| Sistema de notificações | 🔜 A fazer |
| Relatórios e analytics | 🔜 A fazer |
| **Módulo de Estacionamento avulso** (novo, ver seção abaixo) | 🟡 Em planejamento |

---

## Sessão de trabalho — 20/07/2026

### Feito
- Ambiente local configurado do zero: Git e Node.js instalados, projeto clonado em `D:\PROJETOS ON LINE\TIPO7`, dependências instaladas, servidor dev rodando em `localhost:3000`.
- **Roteamento do "Criar evento" padronizado**: todos os pontos de entrada (menu desktop, menu mobile, CTA da home "Criar meu evento", link do rodapé) agora apontam para `/minha-area` (dashboard do promotor) em vez de ir direto para `/criar-evento`. Motivo: o dashboard vai virar o hub central de onde o usuário escolhe criar um evento OU contratar pacotes/complementos avulsos (ex: estacionamento). O próprio `/minha-area` já redireciona sozinho para `/criar-evento` quando a organização não tem nada cadastrado ainda, então o fluxo de quem é novo não quebra.
  - Arquivos alterados: `web/src/components/layout/Header.tsx` (2 links), `web/src/components/layout/Footer.tsx`, `web/src/components/home/PromoterCTA.tsx`.

### Bug encontrado (ainda não corrigido)
- Em `web/src/app/criar-evento/CriarEventoClient.tsx`, o card de evento tem um `<a>` (link do card) contendo outro `<a>` aninhado (botão "Continuar editando") — HTML inválido, causa erro de hidratação no React (`<a> cannot contain a nested <a>`). Corrigir trocando a tag externa por `<div>` com navegação via `onClick`/`router.push`, ou removendo o `<a>` interno.

### Decisão em andamento — Módulo de Estacionamento avulso
Contexto: possível cliente quer contratar **somente** o controle de estacionamento, sem usar o sistema de eventos/ingressos.

Direção combinada até agora:
1. **Reaproveitar a base existente** (auth, `organizations`, RLS, sistema de código único) em vez de criar um produto/app separado — mais rápido e permite upsell futuro (cliente de estacionamento pode depois querer vender ingressos também).
2. Introduzir o conceito de **"produtos contratáveis por organização"** (ex: tabela `organization_products`, com valores tipo `eventos`, `estacionamento`), independente da tabela `events` — hoje o sistema só entende `organização → evento`, não dá pra "pendurar" um cliente que só quer estacionamento.
3. O **dashboard (`/minha-area`) vira o hub central**: de lá o usuário escolhe criar um evento OU contratar um pacote avulso (estacionamento, e outros que vierem depois). A oferta desses pacotes também deve aparecer como upsell contextual dentro do próprio wizard de criação de evento (ex: na etapa de "Local" ou no checklist de publicação).

**Ainda não decidido / próximos passos:**
- Desenho exato do modelo `organization_products` no banco (colunas, RLS, como fica o vínculo com `venues`/estacionamento em si).
- Como o cliente que só quer estacionamento entra no sistema pela primeira vez (ele ainda passa pelo `TipoPessoaModal` de tipo Organizador/Estabelecimento, ou tem um fluxo de onboarding próprio?).
- Regras de negócio do estacionamento em si (avulso tipo shopping vs. vinculado a evento, cobrança por hora, mensalista, etc.) — ainda não levantadas com o cliente.

## Sessão de trabalho — 21/07/2026

### Estudo — Impressão de ingressos e caixas (bilheteria + estacionamento)

**Como funciona hoje (bilheteria/caixa, desktop):**
- Impressão já é unificada com o caixa — mesmo `BilheteiroClient.tsx` vende e imprime.
- Mecanismo: `window.print()` do navegador + Chrome aberto com `--kiosk-printing` (suprime a caixa de diálogo), imprimindo na impressora padrão do Windows. Formato (A4 ou térmica 80mm) é escolhido por evento e salvo em `localStorage` no computador do caixa.
- Existe uma integração QZ Tray pronta (`/api/qz/cert`, `/api/qz/setup`, certificado + `.bat` de auto-configuração) mas **não está ligada** ao fluxo de impressão — nenhum código chama `qz.print()`. É infraestrutura parada, não usada ainda.
- Conclusão: no modelo desktop, o tipo de conexão da impressora (cabo/Wi-Fi/Bluetooth) **não muda nada no código** — quem resolve isso é o driver/spooler do Windows. Cabo USB é o mais confiável para caixa fixo; Wi-Fi precisa de IP fixo/reservado; Bluetooth não é recomendado para posto fixo.

**Estacionamento (porteiro/ambulante, mobile):**
- `AtendenteClient.tsx` (registra entrada/saída de carro) **hoje não imprime nada** — nem ticket de entrada nem comprovante de saída. Ponto em aberto, ainda não implementado.
- Achado técnico importante: impressoras térmicas portáteis baratas usam Bluetooth **Classic (perfil SPP)**, não BLE. A Web Bluetooth API do navegador só enxerga BLE — ou seja, mesmo Chrome Android não consegue falar com a maioria dessas impressoras via site. Precisaria de **app nativo**.
- No Android, app nativo (React Native, já no roadmap) resolve bem (ex: lib `react-native-bluetooth-escpos-printer`), é o padrão usado por apps de delivery no Brasil.
- No iOS, a Apple bloqueia acessório Bluetooth Classic não-certificado (MFi) — térmica Bluetooth barata **não funciona em iPhone**, only modelos MFi certificados (caros, poucas opções).
- **Decisão pendente (usuário ainda não sabe):** se os porteiros/vendedores ambulantes vão usar aparelho próprio (BYOD, Android+iPhone misturado) ou aparelho fornecido pela operação (permitiria padronizar em Android). Essa decisão define se a impressão térmica portátil é viável via app nativo ou fica limitada/inviável em parte da equipe.
- Enquanto a decisão não sai: seguir construindo o módulo de estacionamento sem depender de impressão física (fluxo digital funciona sozinho); impressão térmica portátil entra depois como camada plugável.

### Configuração do ambiente
- Permissões do Claude Code neste computador configuradas para modo sem confirmações (`bypassPermissions`) a pedido explícito do usuário, ciente do risco em ações destrutivas/irreversíveis (ex: sobrescrever dados de produção no Supabase). Configurado em `C:\Users\Free\.claude\settings.json` (afeta todas as sessões do Claude Code nesta máquina, não só este projeto).

---

## Sessão de trabalho — 23/07/2026

### Bug corrigido — Login com Google não funcionava (nem local, nem produção)

**Sintomas:** em localhost, o Google recusava na hora com "Erro 401: invalid_client — The OAuth client was not found". Em produção (tipo7.com), o Google aceitava o login mas travava voltando pra tela de login com `?erro=supabase`.

**Causas (duas, independentes):**
1. `.env.local` tinha `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` com valores placeholder (11 caracteres, não é um Client ID real do Google) — por isso o Google rejeitava até tentar autenticar.
2. No Supabase (Authentication → Providers → Google), o provedor Google estava **desabilitado** (`external_google_enabled: false`, sem client_id configurado) — por isso, mesmo com o Google aceitando o login em produção (as credenciais na Vercel lá eram de um OAuth Client antigo, cujo projeto no Google Cloud não foi mais localizado — provavelmente criado em outra conta Google ou projeto perdido), o `supabase.auth.signInWithIdToken()` sempre falhava.

**Correção aplicada:**
- Renomeado o projeto Google Cloud "sistema-de-ingressos" para "Tipo7" (só nome de exibição, ID do projeto continua o mesmo).
- Criado um novo OAuth Client ID (tipo Aplicativo Web) nesse projeto, com origens/redirects para `https://tipo7.com` e `http://localhost:3000`.
- `.env.local` atualizado com o novo Client ID/Secret reais.
- Provedor Google habilitado no Supabase via Management API (`external_google_enabled: true` + client_id/secret) — token de acesso usado: `SUPABASE_ACCESS_TOKEN` do `.env.local`, que dá acesso de management API (não só dados) ao projeto.
- Vercel (produção): variáveis `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` atualizadas manualmente pelo usuário no dashboard + redeploy.
- Faltava também cadastrar a variante `www` no Google Cloud (site é acessado por `https://www.tipo7.com`, só tínhamos `https://tipo7.com` sem www) — causava `redirect_uri_mismatch`. Adicionado `https://www.tipo7.com` (origem) e `https://www.tipo7.com/api/auth/google/callback` (redirect) junto com as versões sem www.
- Testado e funcionando: login com Google confirmado pelo usuário em localhost **e** em produção (tipo7.com).

**Nota técnica:** a integração MCP da Vercel (`plugin:vercel:vercel`) falhou repetidamente ao completar o fluxo OAuth ("No OAuth flow is in progress") mesmo com callback colado rapidamente — não foi possível usar para ler/escrever env vars da Vercel diretamente nesta sessão. Alterações na Vercel tiveram que ser feitas manualmente pelo usuário no dashboard.

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
