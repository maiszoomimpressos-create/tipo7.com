# Tipo7.com — Documentação do Projeto

## Visão Geral
Plataforma SaaS de divulgação e venda de ingressos para eventos.
Vendida para organizadores de eventos, com suporte a múltiplos perfis por usuário.

---

## Plataformas
- **Web** — Next.js
- **App Mobile** — React Native + Expo
- **Backend/API** — NestJS (Node.js + TypeScript)
- **Banco de Dados** — Supabase (PostgreSQL)
- **Cache** — Redis
- **Pagamentos** — Mercado Pago

---

## Perfis de Usuário (Papéis)
Um único usuário pode ter múltiplos papéis ativos simultaneamente:

| Papel | Descrição |
|---|---|
| `comprador` | Padrão para todos. Compra e usa ingressos. |
| `promotor` | Cria e gerencia eventos. |
| `estabelecimento` | Dono de local/venue. Cadastra espaços para eventos. |
| `gestor` | Gerencia operações de um evento específico. |
| `admin` | Administrador geral da plataforma (Tipo7.com). |

> Um promotor ou dono de estabelecimento continua podendo comprar ingressos de outros eventos normalmente.

---

## Arquitetura Multi-Tenant
- Cada organização (empresa de eventos, estabelecimento) é um tenant isolado
- Um usuário pode pertencer a múltiplos tenants com papéis diferentes em cada um
- Segurança garantida via **RLS (Row Level Security)** do Supabase
- Alternância de contexto no app: "Modo Comprador / Promotor / Estabelecimento"

---

## Sistema de Validação de Ingressos

### Camadas de Segurança (Sistema Proprietário)
1. **Código Criptografado Proprietário** — formato exclusivo, só o sistema valida
2. **Token Dinâmico** — código muda a cada 30 segundos (estilo TOTP)
3. **Uso Único** — após escaneado, ingresso é invalidado imediatamente
4. **Impressão Digital do Dispositivo** — ingresso vinculado ao celular do comprador
5. **Geolocalização** — confirma proximidade ao evento na validação
6. **Confirmação Ativa** — notificação no app pedindo confirmação do comprador

### Leitura de Códigos
- QR Code (dinâmico e criptografado)
- Código de Barras
- Sistema proprietário de validação (a definir)

---

## Módulos do Sistema (a detalhar)
- [ ] Autenticação e Gestão de Usuários
- [ ] Gestão de Eventos
- [ ] Gestão de Estabelecimentos
- [ ] Venda de Ingressos
- [ ] Pagamentos (Mercado Pago)
- [ ] Validação de Ingressos
- [ ] Painel Administrativo (Tipo7.com)
- [ ] Painel do Promotor
- [ ] Painel do Estabelecimento
- [ ] App do Comprador
- [ ] Sistema de Notificações
- [ ] Relatórios e Analytics

---

## Integrações
- **Supabase** — banco de dados, autenticação, storage, tempo real
- **Mercado Pago** — gateway de pagamento
- **Redis** — cache e filas
- **CDN** — assets e imagens

---

## Decisões Técnicas Importantes
- Todo o código em **TypeScript** (frontend, mobile e backend)
- Backend único (API) serve tanto web quanto mobile
- Segurança por papel usando RLS do Supabase
- Sistema de validação de ingressos 100% proprietário
- Arquitetura pensada para escala desde o início

---

## Histórico de Decisões
| Data | Decisão |
|---|---|
| 2026-06-11 | Definição da stack tecnológica |
| 2026-06-11 | Escolha do Supabase como banco de dados |
| 2026-06-11 | Definição do modelo multi-tenant com múltiplos papéis por usuário |
| 2026-06-11 | Decisão de criar sistema proprietário de validação de ingressos |

---

## Arquivos do Projeto
> Esta seção será atualizada conforme os arquivos forem criados.

---

## Observações
- Comentários serão adicionados em todo o código para facilitar entendimento
- Todas as alterações no Supabase serão feitas via código (sem copia e cola manual)
- O projeto deve suportar alta carga desde a arquitetura inicial
