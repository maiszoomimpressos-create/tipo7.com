# Integração Tipo7 ↔ Autosave

Documento de referência pra quem estiver mexendo nessa integração — API do
Autosave (contrato exato), status atual do que já foi implementado aqui no
Tipo7, e o que falta pra ir pro ar.

## O que é

O Autosave (`https://autosave-nine.vercel.app`, projeto irmão do mesmo dono)
centraliza dados de veículos e pessoas (clientes/usuários). O Tipo7 consulta
de lá pra pré-preencher cadastro/perfil, e manda de volta o que o usuário
preencheu aqui — via de mão dupla.

## Contrato da API (Autosave)

Toda chamada usa o header `x-api-key: <chave>`. Cada chave só tem acesso a
**um** recurso (`vehicles` ou `customers`) — usar a chave errada no endpoint
errado dá `403`.

### Buscar veículo por placa

```
GET /api/v1/vehicles?plate=ABC1234
x-api-key: <chave de veículos>

→ 200 { "found": true, "vehicles": [ { "plate", "name", "brand", "model", "year", "color", "type", "status", "owner_name", ... } ] }
→ 200 { "found": false, "vehicles": [] }
→ 401 { "error": "Chave de API inválida." }
→ 403 { "error": "Esta chave não tem acesso a este recurso." }
```

Só devolve os campos que a chave tem marcado pra devolver (configurável em
`/api-docs` no Autosave, editável a qualquer momento sem trocar a chave).

### Criar ou atualizar veículo

```
POST /api/v1/vehicles
x-api-key: <chave de veículos>
Content-Type: application/json

{ "plate": "ABC1234", "brand": "Fiat", "model": "Strada", "color": "Branco" }

→ 201 { "vehicle": {...}, "created": true }   (placa nova)
→ 200 { "vehicle": {...}, "created": false }  (placa já existia — atualiza só os campos enviados)
```

Aceita qualquer campo do modelo de veículo, mesmo que a chave não tenha
permissão de leitura pra ele (a permissão da chave só limita o que ela
**recebe** nas buscas, não o que ela pode salvar).

### Buscar cliente (por external_id, cpf, cnpj ou e-mail)

```
GET /api/v1/customers?external_id=<uuid-do-tipo7>
GET /api/v1/customers?cpf=12345678900
GET /api/v1/customers?cnpj=12345678000199
GET /api/v1/customers?email=fulano@exemplo.com
x-api-key: <chave de clientes>

→ 200 { "found": true, "customer": {...} }
→ 200 { "found": false, "customer": null }
```

Qualquer um dos quatro acha o mesmo registro, se ele já tiver esse dado
salvo. Campos disponíveis: `external_id`, `customer_type` (`pf`/`pj`),
`full_name` (nome ou razão social), `trade_name` (nome fantasia, só PJ),
`email`, `cpf`, `cnpj`, `phone`, `rg`, `birth_date`, `zip_code`, `street`,
`street_number`, `neighborhood`, `city`, `state`, `complement`,
`address_type`.

### Criar ou atualizar cliente

```
POST /api/v1/customers
x-api-key: <chave de clientes>
Content-Type: application/json

{
  "external_id": "uuid-do-usuario-no-tipo7",
  "full_name": "Fulano de Tal",
  "email": "fulano@exemplo.com",
  "cpf": "123.456.789-00",
  "phone": "46988212387"
}

→ 201 { "customer": {...}, "created": true }
→ 200 { "customer": {...}, "created": false }
```

Manda **só o que tiver** — não sobrescreve com vazio o que já estava salvo
lá se você omitir um campo. Precisa mandar pelo menos um de `external_id`,
`cpf`, `cnpj` ou `email` pra identificar a pessoa.

### Erros comuns

| Situação | O que acontece |
|---|---|
| Chave revogada ou inexistente | `401` |
| Chave do recurso errado (ex: chave de veículos batendo em `/customers`) | `403` |
| Autosave fora do ar / timeout | connection error — o código do Tipo7 já trata isso como "não achou", nunca trava o fluxo |

## Onde ficam as credenciais (Tipo7)

Tabela `api_integracoes`, uma linha por área:

| `area_slug` | Recurso no Autosave | Usada em |
|---|---|---|
| `usuarios` | `customers` | `buscarClientePorCpf`, `enviarClienteParaAutosave` |
| `estacionamento` | `vehicles` | `buscarVeiculoPorPlaca`, `salvarVeiculoNaAutosave` |

**Status atual (confirmado em 2026-07-31):** as duas linhas já estão com a
chave certa cada uma — corrigido um bug em que as duas apontavam pra mesma
chave (a de clientes), quebrando a consulta de placa. Testado ponta a ponta
e funcionando contra produção do Autosave.

## O que já está implementado aqui (mas NÃO publicado ainda)

Estes arquivos já têm o código pronto pra sincronização de mão dupla, só
não foram commitados/deployados:

- `web/src/lib/autosave.ts` — lê credenciais de `api_integracoes`, funções
  de busca (`buscarVeiculoPorPlaca`, `buscarClientePorCpf`) e envio
  (`salvarVeiculoNaAutosave`, `enviarClienteParaAutosave`)
- `web/src/app/api/auth/sync-autosave/route.ts` — rota que lê o perfil
  atual do usuário logado e manda pro Autosave
- `web/src/contexts/AuthContext.tsx` — chama `sync-autosave` depois que o
  cadastro é criado
- `web/src/app/perfil/ProfileForm.tsx` — chama `sync-autosave` depois que o
  perfil é salvo
- `web/src/app/api/webhooks/autosave/route.ts` — recebe notificação do
  Autosave quando um cliente muda por outra via (API ou tela lá) e
  atualiza o perfil aqui
- `supabase/migrations/20260731000001_api_integracoes.sql` — cria a tabela
  de credenciais
- `web/src/app/admin/api/` + `web/src/app/api/admin/integracoes/` — painel
  pra editar as credenciais sem precisar mexer em código

**Confirmado por teste direto:** `POST https://www.tipo7.com/api/auth/sync-autosave`
devolve `404` em produção — ou seja, nada disso está no ar ainda. Usuário
real que se cadastra ou edita o perfil hoje no site **não** dispara nada
disso.

## Telefone do motorista (novo campo `driver_phone`)

A Autosave agora guarda e devolve `driver_phone` no recurso `vehicles`
(testado e funcionando em produção). Objetivo: já que pessoas trocam de
número, quando o atendente digitar uma placa que já existe na Autosave e
ela tiver telefone salvo, mostrar um modal **"É esse o número? [telefone]"**
com confirmar/editar, em vez de perguntar do zero toda vez:

- **Confirmou** → segue o fluxo normal de acesso/pagamento com esse número.
- **Editou** → usa o número novo digitado, e esse número precisa ser
  **mandado de volta pra Autosave** (pra já vir certo da próxima vez).

**Já pronto** (`web/src/lib/autosave.ts`, arquivo isolado, seguro de
publicar junto com o resto da sincronização):
- `buscarVeiculoPorPlaca` agora também devolve `telefone: string | null`.
- `salvarVeiculoNaAutosave` agora aceita um `telefone?: string` opcional —
  só manda se vier preenchido (não apaga o que já estava salvo lá se você
  omitir).

**Falta fazer** (não mexi porque fica dentro de arquivos com outras
mudanças de pagamento/caixa em andamento, não revisadas):
- `web/src/app/api/estacionamento/entrada/route.ts` — hoje já recebe
  `body.telefoneCondutor` e já chama `salvarVeiculoNaAutosave({ placa,
  modelo, cor })` na linha ~139, só falta passar
  `telefone: body.telefoneCondutor` junto.
- A tela onde o atendente digita a placa (provavelmente dentro de
  `web/src/app/estacionamento/[eventoId]/page.tsx`) — ao chamar
  `buscarVeiculoPorPlaca` e receber `telefone` preenchido, mostrar o modal
  de confirmação antes de liberar o campo de telefone pra digitação livre.

## O bloqueio pra publicar

`web/src/app/perfil/page.tsx` (e a nova prop `secaoAtiva` do `ProfileForm`)
já foi alterado como parte de **outra** frente de trabalho — reforma de
permissões de organização/venue (`venue_admins`, `organizations.type`,
etc.) — que não tem relação com essa integração e não foi revisada aqui.
Publicar esse arquivo do jeito que está exige que a tabela `venue_admins` e
as migrations de `org_admin`/`venue_admins` também estejam aplicadas, senão
a página de perfil quebra.

No total há ~70 arquivos não commitados no repositório agora, cobrindo
várias frentes (PIX, caixas de bilheteria, permissões de admin, perfil).
Não publicar tudo de uma vez sem revisão — inclui fluxo de pagamento real.

## Caminho recomendado

1. Aplicar as migrations `20260731000001_api_integracoes.sql` e
   `20260731000002_autosave_sync_usuarios.sql` (documentação/seed).
2. Commitar e publicar **só**: `lib/autosave.ts`, `api/auth/sync-autosave/`,
   `api/webhooks/autosave/route.ts`, e o `fetch('/api/auth/sync-autosave')`
   dentro de `AuthContext.tsx` (essa parte é isolada, sem dependência de
   outra coisa).
3. Pra `ProfileForm.tsx`/`perfil/page.tsx`: ou (a) publicar a reforma de
   venue/org admin junto — depois de alguém revisar essa parte —, ou
   (b) fazer uma versão do `ProfileForm.tsx` sem a prop `secaoAtiva` só
   com a chamada de sync, publicar isso primeiro, e aplicar a reforma de
   abas depois, separado.
4. Depois de publicado, testar com `curl` batendo direto em
   `https://www.tipo7.com/api/auth/sync-autosave` (autenticado) e
   conferindo se o registro aparece em `/cadastros` no Autosave.
