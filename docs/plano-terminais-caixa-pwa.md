# Plano — acesso simplificado a caixa/scanner/estacionamento por terminal (PWA)

Documento de registro de uma discussão de arquitetura (24/08/2026), antes de
começar a codar. Junta várias decisões tomadas em sequência numa conversa —
serve pra não perder o fio se a sessão for retomada depois, ou por outra
pessoa/sessão.

**Prazo dado pelo usuário**: fazer o máximo disso funcionar "essa semana",
pronto pra uso real. Ver seção **Priorização sugerida** no fim — o escopo
completo é grande demais pra uma semana só, então dividi em fases.

## O problema que disparou a conversa

Tela de Equipe do evento (`web/src/app/evento/[id]/PainelEquipe.tsx`), editor
de função: uma grade solta de 8 checkboxes de permissão (Scanner, Caixa,
Estacionamento entrada, Estacionamento saída, Autorizar sangria, Ver lista,
Ver relatórios, Gerenciar check-in). Usuário achou confuso pra quem só quer
"botar o segurança pra trabalhar sábado" — pediu ideia de simplificação.

## Decisões fechadas nesta conversa

### 1. Permissão vira "módulo com ponto", não checkbox solto

Hoje `vender_ingresso` (permissão de Caixa) não diz **onde** — mistura caixa
de bilheteria e caixa de estacionamento sob o mesmo texto. Só por baixo dos
panos, via `estacionamentoId` no registro do `Caixa`, é que o sistema
realmente sabe a diferença (usado hoje só pra montar o link certo em
`TrabalhoClient.tsx:123`, `caixaHref`).

Decisão: generalizar isso pra virar o modelo principal, não um detalhe
escondido. Cada atribuição de trabalho (Caixa **e** Scanner) passa a saber
explicitamente **de qual módulo/ponto** ela é:

- **Caixa** → Bilheteria, Estacionamento, ou (futuro) Alimentação/Tenda.
- **Scanner** → Portaria (entrada de ingresso), Estacionamento‑entrada, ou
  Estacionamento‑saída. **Achado novo**: hoje Scanner é só `validar_ingresso`
  solto, sem vínculo de portão nenhum — vai precisar do mesmo tratamento que
  o Caixa já tem parcialmente.

Falta ainda:
- Criar a permissão `vender_alimentacao` (ou nome similar) no enum
  `EventPermission` (`server/prisma/schema.prisma:30`) — hoje só existe a
  flag `moduloTenda` no evento, sem permissão/caixa dedicados.
- Fazer o modelo `Caixa` aceitar vínculo com a tenda, do jeito que já aceita
  `estacionamentoId` (`server/prisma/schema.prisma:852`).
- Dar ao Scanner um campo de "ponto" (portão/portaria), hoje inexistente.
- Redesenhar a UI de `SeletorPermissoes` em `PainelEquipe.tsx` pra virar
  cards de módulo em vez da grade de 8 checkboxes soltos.

### 2. Redirect inteligente após login (token+PIN ou normal)

Hoje a rota pública `/caixa` (`web/src/app/caixa/CaixaLoginClient.tsx`) pede
token (8 dígitos) + PIN, autentica e manda sempre pro hub genérico
`/trabalho/[eventoId]` (linha 43). Dali a pessoa clica manualmente em qual
ferramenta quer abrir.

Decisão: trocar esse redirect fixo por uma decisão automática:

1. Ela tem algum **caixa aberto agora** (bilheteria, estacionamento, ou
   futuro alimentação)? → manda direto pra ele (é onde ela está trabalhando
   neste minuto).
2. Se não tem caixa aberto → olha as funções "sem caixa" atribuídas a ela
   (scanner de portaria, scanner de estacionamento) → se só tem uma tela
   possível, manda direto.
3. Hub (`/trabalho/[eventoId]`) só entra como último recurso, no caso raro
   de haver mais de uma tela "sem caixa" simultânea sem nada pra desempatar.

**Por que isso não gera ambiguidade na prática**: fechar caixa já é
self-service hoje (`BilheteiroClient.tsx:2667` — botão "Enviar contagem e
ver apuração", vira `fechamento_pendente` até o dono validar o troco, mas
quem fecha é o próprio operador, sem precisar do dono presente). Então ela
já consegue, sozinha, encerrar o turno de caixa da bilheteria antes de virar
scanner do estacionamento à noite — não fica "em 2 lugares ao mesmo tempo".

**Em aberto**: essa lógica deve valer só pra `/caixa` (token+PIN) ou também
pro login normal (email/senha)? Recomendação: valer pros dois, mesma regra,
sem duplicar código — mas não foi confirmado explicitamente ainda.

### 3. Porta única, não link pessoal por caixa

Esclarecimento importante do usuário: `/caixa` continua sendo **uma porta
só, genérica** do sistema (não um link único por pessoa/caixa). Quem
identifica a pessoa e decide o destino é o par token+PIN digitado ali
dentro, não a URL em si. Isso já é como a rota funciona hoje — só falta
trocar o destino fixo pela lógica inteligente do item 2.

### 4. PWA, não app nativo

Perguntado explicitamente se valeria a pena fazer app nativo (iOS/Android)
pra esse acesso. Recomendação dada e aceita: **não** — ficar 100% web, só
tornando a rota `/caixa` instalável como PWA (ícone na tela inicial, abre em
tela cheia, sem barra de navegador). Motivos: sem revisão de loja pra cada
correção, deploy automático já existente continua servindo, mesmo código
pra PC/tablet/celular/maquininha GPOS780 (que já roda navegador normalmente).

**Única exceção prevista**: a cobrança de cartão em si na maquininha GPOS780
pode exigir SDK nativo do adquirente escolhido (Stone/GetNet/Cielo/PagBank —
**ainda não decidido**, ver [[project_maquininha_cartao_e_sync_abas]]). Isso
é um bridge nativo fino e pontual pra essa função específica, não um app
inteiro — decisão adiada até escolher o adquirente.

**Gap técnico encontrado**: o projeto **não tem PWA configurado ainda** —
sem `manifest.json`, sem ícones, sem service worker. É pré-requisito antes
de qualquer botão de instalação funcionar.

### 5. Fluxo de entrega do acesso, dentro do cadastro do usuário

Quando o funcionário aceita o convite de trabalho e define o PIN pela
primeira vez (`BlocoTokenPin.tsx`, callback `onPinAtualizado` disparado após
`salvarPin()` ter sucesso), aparecem dois botões novos:

1. **"Instalar neste aparelho" (PWA)**, com ícone de exclamação/info ao
   lado — comportamento por plataforma:
   - Android/Chrome/Edge/desktop: instala com 1 toque de verdade, via
     evento `beforeinstallprompt` capturado e `.prompt()` disparado no clique.
   - iPhone/Safari: **não tem API pra instalar por código** (limitação da
     Apple) — o botão abre uma explicação com o passo manual
     (Compartilhar → "Adicionar à Tela de Início"). Detectar plataforma e
     trocar o comportamento/texto automaticamente.
2. **"Enviar link por WhatsApp"** — reaproveita a integração Z-API já
   existente e testada (ver [[project_boot_whats_nao_entrega_estacionamento]]).
   Manda o link **puro** da tela (`/caixa`, sem token na URL) — no aparelho
   novo ela digita token **e** PIN do zero, igual em qualquer outro
   aparelho. Serve pro caso dela estar aceitando o convite num aparelho, mas
   for trabalhar em outro (PC do balcão, maquininha).

   **Correção de rumo (24/08/2026)**: a ideia inicial era pré-preencher o
   token na URL pra economizar 1 campo. Usuário decidiu contra — token na
   URL vira redundância desnecessária e menos seguro (fica sentado em
   histórico de mensagem/navegador). Regra final, sem exceção: **todo
   aparelho, toda vez, digita token + PIN completos** — nunca fica nada de
   credencial salvo, só o atalho/ícone do PWA instalado fica salvo.

**Resolvido**: pré-preencher telefone do cadastro no envio por WhatsApp
continua uma escolha de UX separada (não afeta segurança, já que não é
credencial) — ainda não confirmado, mas de baixa prioridade.

### 6. Hardware de desenvolvimento confirmado

**Gertec SmartPOS GPOS780** — já estava anotado desde 19/08
([[project_maquininha_cartao_e_sync_abas]]), reconfirmado nesta conversa.
É Android completo, roda navegador/webview normal — a rota `/caixa` e o
fluxo PWA funcionam nele sem adaptação nenhuma. O que falta decidir é só o
adquirente/gateway de pagamento (item 4).

## O que já existe vs. o que falta

| Peça | Status |
|---|---|
| Rota `/caixa` (token+PIN → sessão) | ✅ existe |
| `BlocoTokenPin` (criar/trocar PIN, mostrar token) | ✅ existe |
| `caixaHref` (decide bilheteria vs estacionamento por `estacionamentoId`) | ✅ existe, só usado no hub hoje |
| Fechamento de caixa self-service | ✅ existe |
| Redirect inteligente pós-login (reaproveitando `caixaHref`) | ❌ falta trocar o redirect fixo de `CaixaLoginClient.tsx:43` |
| PWA (manifest, ícones) | ✅ feito 24/08 — `app/manifest.ts` + `app/apple-icon.png` + ícones em `public/icons/` |
| Botão instalar PWA (com tratamento Android vs iOS) | ✅ feito 24/08 — `web/src/lib/pwaInstall.ts` + `BlocoTokenPin.tsx` |
| Botão enviar link por WhatsApp | ✅ feito 24/08, via `wa.me` (ver nota abaixo) — link puro, sem token |
| Permissão + caixa de Alimentação/Tenda | ❌ não existe (nem permissão nem vínculo no `Caixa`) |
| Vínculo de ponto/portão no Scanner | ❌ não existe |
| UI de módulos (substituindo grade de 8 checkboxes) | ✅ feito 24/08 (`PainelEquipe.tsx`) — só com as permissões que já existem, ver Fase E |
| Adquirente/gateway de cartão pro GPOS780 | ❌ não decidido |

## Priorização sugerida (dado o prazo de 1 semana)

Não dá pra fazer tudo isso com qualidade numa semana, ainda mais com o resto
da lista de pendências do projeto rodando em paralelo. Sugestão de fases,
da mais barata/maior impacto pra mais cara:

**Fase A — redirect inteligente** (baixo risco, sem mudança de schema)
Trocar o redirect fixo de `CaixaLoginClient.tsx` pela lógica do item 2,
reaproveitando `caixaHref` que já existe. Isso sozinho já entrega "digitou
token+PIN, caiu direto vendendo" pra bilheteria e estacionamento (que já
existem hoje).

**Fase B — PWA básico + os 2 botões**
Criar manifest/ícones/service worker mínimo, depois os botões de instalar e
enviar por WhatsApp em `BlocoTokenPin.tsx`.

**Fase C — Scanner ganha vínculo de ponto** (schema change)
Nova coluna/tabela pra portão do scanner, ajuste na atribuição de função.

**Fase D — módulo de Alimentação/Tenda completo** (schema change + tela nova)
Permissão nova, `Caixa` aceitar vínculo com tenda, tela de venda dedicada —
é a peça mais cara de todas, provavelmente não cabe nesta semana.

**Fase E — UI de módulos na tela de Equipe** ✅ feita parcialmente (24/08)
Trocada a grade solta de 8 checkboxes por dois cards expansíveis em
`PainelEquipe.tsx` — **Caixa** (Bilheteria/Estacionamento) e **Scanner**
(Portaria/Estacionamento) — com as permissões "extras" (sangria, ver lista,
relatórios, check-in) soltas embaixo, como antes. Renomeados só os rótulos
dos pontos dentro de cada módulo (ex: `vender_ingresso` virou "Bilheteria"
em vez de "Caixa", pra não repetir o nome do módulo) — os valores de
permissão no banco não mudaram, `permLabel` (chips fora do editor) também
não mudou. Reaproveita `Wallet`/`ScanQrCode` como ícone de cada módulo.

**Falta ainda** (Fases C e D, adiadas): módulo Caixa não tem ponto de
Alimentação (permissão não existe), e módulo Scanner usa
`estacionamento_entrada` como "ponto", mas essa permissão continua sendo a
mesma de sempre — ainda não existe um vínculo de PORTÃO real pro Scanner
(diferente do Caixa, que já vincula a um `estacionamentoId` de verdade via
`Caixa.estacionamentoId`). Build de produção (`npm run build`) rodado e
limpo depois da mudança.

Recomendo focar em **A + B** essa semana — é o que mais destrava uso real
imediato (equipe conseguindo entrar e trabalhar sem fricção nos aparelhos
que já existem hoje) sem mexer em banco de dados. C/D/E ficam pra depois.

## Regra de segurança confirmada (24/08/2026)

**Token e PIN nunca ficam salvos/pré-preenchidos em nenhum aparelho ou
link — sempre digitados por completo, todo login, em qualquer terminal**
(PC, tablet, celular, maquininha). O que fica salvo é só o atalho de acesso
(ícone do PWA instalado apontando pra `/caixa`), nunca a credencial. Isso
vale igual pro link mandado por WhatsApp (item 5 acima): é o link puro da
tela, sem token na URL.

## Perguntas ainda em aberto

1. Redirect inteligente vale só pra `/caixa` (token+PIN) ou também pro login
   normal (email/senha)?
2. No botão de WhatsApp, pré-preencher telefone do cadastro ou sempre pedir
   digitação? (baixa prioridade — não é questão de segurança, só de UX)
3. Adquirente/gateway de pagamento pra maquininha (Stone/GetNet/Cielo/
   PagBank) — ainda não decidido, bloqueia só a Fase de cobrança de cartão
   em si (não bloqueia A/B/C/D/E acima).

## Fase B — PWA ✅ feita (24/08/2026)

Implementado na mesma sessão, logo depois da Fase A + módulos:

- **`web/src/app/manifest.ts`** — manifest gerado pelo Next (rota
  `/manifest.webmanifest`, convenção de arquivo do App Router). `start_url:
  '/caixa'` — o PWA instalado abre direto na porta de acesso, não no site
  inteiro. `name`/`short_name`: "Tipo7 — Caixa" / "Tipo7 Caixa".
- **Ícones** — gerados com `sharp` (não havia nenhum logo em PNG no
  projeto, só o `Ticket` do lucide + wordmark via CSS no Header) — fundo
  escuro `#070707`, "7" dourado `#E8B84B`, em `public/icons/` (192, 512,
  512 maskable) + `web/src/app/apple-icon.png` (convenção de arquivo do
  Next, gera o `<link rel="apple-touch-icon">` sozinho).
- **`viewport.themeColor`** em `layout.tsx` — `metadata.themeColor` está
  descontinuado desde o Next 14, o jeito certo agora é o export `viewport`.
- **`web/src/lib/pwaInstall.ts`** — hook `usePwaInstall()`. Captura o
  evento `beforeinstallprompt` num módulo top-level (fora do ciclo de vida
  de componente) porque ele dispara cedo, antes do `BlocoTokenPin` sequer
  existir na árvore (só monta depois da pessoa criar o PIN) — um listener
  local perderia o evento. `isIOSSafari()` detecta a exceção (Apple não
  expõe API de instalação nenhuma).
- **`BlocoTokenPin.tsx`** — depois do PIN configurado, aparecem os 2
  botões: "Instalar neste aparelho" (1 clique real no Android/Chrome/Edge;
  no iPhone abre um modal com o passo manual — Compartilhar → Adicionar à
  Tela de Início) e "Enviar link por WhatsApp".

**Mudança de rumo em relação ao desenho original**: o botão de WhatsApp
**não** usa a integração Boot Whats já existente no projeto — descobri ao
implementar que ela só manda mensagens por **template fixo dela**
(`type: 'compra_confirmada' | 'ingresso_emitido' | ...`), sem texto livre;
adicionar um tipo novo exigiria coordenação com o time externo da Boot
Whats (mesmo padrão do `docs/boot-whats-details.md`), o que não cabia no
prazo da semana. Solução adotada: link **`wa.me`** — abre o WhatsApp já com
o número e a mensagem preenchidos, a pessoa confirma o envio ela mesma
(1 toque a mais que um envio automático, mas zero dependência externa).
Continua batendo com a regra de segurança: só o link puro vai na mensagem,
sem token — token+PIN sempre digitados no aparelho novo.

Build de produção rodado e limpo depois de cada mudança.

## Extra — criação guiada de portões ✅ feito (24/08/2026)

Discussão paralela, mesma sessão: ficou confuso pro usuário onde a função
"Estacionamento entrada/saída" (Equipe) se conecta com os portões reais do
local físico (Estrutura). Resposta: **já existia conexão** (`SeletorPortao`
em `PainelEquipe.tsx`, ao adicionar/editar membro, já lista os portões
reais) — só não era visível/guiado o suficiente.

Melhoria aplicada em `GerenciadorEstacionamentos.tsx`
(`EstacionamentoModal`), só no modo **criação** (não em editar — um local já
existente continua gerindo portões pela lista principal, como sempre): logo
depois de nome/cobrança/vagas, pergunta **"Quantos portões esse local vai
ter?"** (1 a 4).
- **1** → não pergunta tipo, cria direto como "Portão único", tipo `ambos`
  (não tem outro portão pra dividir entrada de saída).
- **2+** → mostra uma linha por portão, ali mesmo no formulário (nome +
  tipo entrada/saída/ambos), tudo criado junto com o local num só clique em
  "Criar" (POST do estacionamento, depois um POST por portão em paralelo).

Deixado de propósito **fora** desse formulário: escolher QUEM (qual pessoa)
trabalha em cada portão — isso continua acontecendo depois, na tela Equipe,
que é onde já existe hoje. Estrutura física (quantos portões, o que cada um
faz) e escala de equipe (quem trabalha onde) são decisões em momentos
diferentes — misturar as duas no mesmo formulário deixaria ele gigante.
Typecheck e `npm run build` rodados e limpos depois da mudança.

## Fase C.1 — Estacionamento vira 1 permissão só, portão decide o resto ✅ feito (26/08/2026)

Continuação direta da Fase C (gap já registrado acima: "Vínculo de
ponto/portão no Scanner"). Usuário revisou a tela de "Funções" no admin
(print real, achando confuso ter "Estacionamento — Entrada" e
"Estacionamento — Saída" como 2 permissões soltas e independentes) e
levantou o problema de verdade:

**As operações reais do estacionamento são 4** (não 2):
1. Verificar veículo (registrar placa/modelo/cor na entrada)
2. Cobrar estacionamento (carro que chegou sem ticket online)
3. Escanear o ticket de saída (confirma saída de quem já pagou online) —
   **não existe ainda**
4. Validar ticket comprado online, na entrada — **não existe ainda**,
   depende de vender estacionamento online (também não existe)

**O problema**: quais dessas a pessoa consegue fazer já é decidido pelo
**portão** (`EstacionamentoPortao.tipo`: entrada/saída/ambos), escolhido lá
na criação do local (ver seção "Extra" acima, `SeletorPortao` em
`PainelEquipe.tsx`). Pedir pra pessoa **também** marcar
"Estacionamento — Entrada"/"— Saída" como permissão solta é redundante — e
pior, deixava marcar "saída" numa pessoa vinculada a um portão só de
entrada, sem nada impedir isso na tela (o backend já rejeitava certo na
hora H, ver abaixo, mas a UI mentia).

**Decisão (passou por 3 formatos na mesma sessão até fechar)**:

1. Primeira tentativa: 1 permissão só ("Estacionamento", módulo próprio),
   concedendo os 2 valores do banco sempre juntos, derivando entrada/saída
   do portão. Usuário corrigiu: perdia a distinção real entre "verificar
   veículo" (entrada) e "cobrar" (saída) — são operações diferentes de
   verdade, faz sentido continuarem sendo 2 permissões.
2. Segunda tentativa: "Caixa" e "Scanner" como módulos de topo,
   Bilheteria/Portaria/Estacionamento como pontos dentro deles (formato
   que já existia desde a Fase E, 24/08). Usuário corrigiu de novo: isso
   inverte a relação real. "Caixa é uma ATRIBUIÇÃO da função que ela vai
   desenvolver — na Bilheteria ela TEM um caixa, não o Caixa TEM
   Bilheteria."
3. **Formato final**: o **LOCAL** é o agrupador (Bilheteria, Portaria,
   Estacionamento — futuro: Praça de Alimentação), cada um com seu(s)
   atributo(s) dentro:
   - Bilheteria → tem **Caixa** (`vender_ingresso`)
   - Portaria → tem **Scanner** (`validar_ingresso`)
   - Estacionamento → **Entrada** (`estacionamento_entrada`, verificar
     veículo/registro) e **Saída** (`estacionamento_saida`, Caixa/cobra) —
     os 2 continuam permissões independentes, cada uma com sua própria
     caixinha, só que agrupadas visualmente dentro do card
     "Estacionamento" em vez de soltas numa grade sem contexto (era isso
     que gerava a confusão original do print).

O portão vinculado à pessoa (`SeletorPortao`) continua narrowing por
cima disso — a função dá o teto do que ela pode fazer (ex: pode Entrada
E Saída), o portão específico restringe pra 1 instância física de gate.
Não é redundante: são 2 camadas diferentes (o que o CARGO pode fazer vs.
qual PORTÃO essa pessoa especificamente opera).

**Pontos 3 e 4 (escanear ticket online, validar ticket online) ficam de
fora desta fase** — não existe venda de estacionamento online ainda, não
tem o que tratar. Fica pra quando essa feature existir.

### Como foi implementado

Sem migração de banco — o enum `EventPermission` já tinha os 2 valores
(`estacionamento_entrada`/`estacionamento_saida`), só precisou reagrupar a
UI:

- **`components/PermissaoCard.tsx` virou a fonte única** de label/desc/
  help por permissão (`PERMISSOES_INFO`) **e** do agrupamento por local
  (`MODULOS`, `EXTRAS`, `PERMISSOES_ESTACIONAMENTO`) **e** do componente
  de seleção pronto (`SeletorPermissoesAgrupado`) — reaproveitado tal e
  qual em `PainelEquipe.tsx` (seletor por evento) e `FuncoesClient.tsx`
  (modelos de função do admin), que antes tinham cada um sua própria
  implementação da mesma grade (drift entre as duas era o motivo de
  `/admin/funcoes` não ter as descrições/agrupamento que o seletor do
  evento já tinha).
- Label de cada permissão agora é o ATRIBUTO, não o local: `vender_
  ingresso` → "Caixa" (antes "Bilheteria"), `validar_ingresso` →
  "Scanner" (antes "Portaria") — o local virou o título do card que
  agrupa, não precisa repetir no nome da permissão.
- **`/estacionamento/[eventoId]/page.tsx`** ganhou a melhoria de verdade,
  que sobrevive independente do agrupamento da tela: quando a pessoa tem
  um portão vinculado (`portaoRestrito`), `podeEntrada`/`podeSaida` passam
  a vir do `tipo` do portão (`['entrada','ambos'].includes(tipo)` /
  `['saida','ambos'].includes(tipo)`) em vez de só das 2 permissões soltas
  — só cai de volta nas permissões quando **não** há portão vinculado (ex:
  local com portão único).
- **Backend não mudou** (`estacionamento.service.ts`) — os métodos
  `entrada()`/`sair()` já validavam o `tipo` do portão contra a ação e
  cruzavam com `getStaffPortao()` antes disso — a segurança de verdade
  sempre esteve ali, correta.

Arquivos tocados: `components/PermissaoCard.tsx`, `PainelEquipe.tsx`,
`FuncoesClient.tsx`, `estacionamento/[eventoId]/page.tsx`. Typecheck e
`npm run build` rodados e limpos a cada iteração.

**Falta ainda** (fora do escopo desta fase, de propósito): pontos 3 e 4 da
lista acima (ticket online) só fazem sentido quando "vender estacionamento
online" existir — feature futura, sem data.
