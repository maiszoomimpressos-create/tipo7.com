# Levantamento de requisitos — Maquininha de cartão (Gertec GPOS780)

Documento de planejamento (26/08/2026), antes de começar a codar. Objetivo:
mapear o que precisa ser decidido e construído pra aceitar pagamento com
cartão físico (presente) na maquininha, tanto no **Estacionamento** quanto
na **Portaria/venda de ingresso**. Nada implementado ainda — isso é
levantamento, não execução.

Contexto prévio já registrado no projeto: [[project_maquininha_cartao_e_sync_abas]]
e a seção "Pagamento no Estacionamento" de `docs/plano-terminais-caixa-pwa.md`.

## Correção importante em relação ao que estava registrado antes

Uma memória anterior deste projeto dizia "adquirente recomendado: PagBank".
**Isso não reflete a realidade atual** — o usuário confirmou nesta sessão que
o gateway de pagamento da PagBank **nunca saiu do sandbox**, não está
funcionando em produção. Este documento trata a escolha de adquirente como
**totalmente em aberto**, sem viés nenhum pra PagBank ou qualquer outra.

## O aparelho

**Gertec SmartPOS GPOS780** — já em mãos, comprado **sem vínculo** com
nenhum banco/adquirente (aparelho "cru").

| Item | Especificação |
|---|---|
| Sistema operacional | Android 11 |
| Processador / RAM | Quad-core A53 2GHz / 2GB RAM DDR4 |
| Armazenamento | 32GB flash + slot SD até 128GB |
| Tela | 5,5" colorida, 1280x720, touchscreen |
| Conectividade | Wi-Fi 2.4/5GHz, 4G/3G/2G (chip próprio), Bluetooth 5.0 BLE |
| Leitores | Magnético (trilhas 1/2/3), NFC (contactless), chip (smartcard ISO7816) |
| Impressora térmica | Embutida, 70mm/s |
| Câmera | Traseira 5MP com flash |
| Certificações | PCI 6, EMV L1&L2, Visa/Master/Amex/Discover/UnionPay/JCB |

Fontes: [gertec.com.br/produtos/gpos780](https://www.gertec.com.br/produtos/gpos780/),
[Manual do usuário GPOS780 (PDF)](https://www.gertec.com.br/wp-content/uploads/2024/08/Manual-Usuario-GPOS780.pdf).

**Ponto-chave que muda tudo**: a GPOS780 é hardware genérico da Gertec — o
mesmo aparelho físico é vendido "white-label" por várias adquirentes (Stone,
PagBank, Cielo, Rede etc.) e também é vendido avulso pra quem monta a própria
integração. **Quem processa o pagamento (e portanto qual SDK/API usar)
depende inteiramente de com quem a empresa fizer negócio** — isso não é uma
decisão técnica, é uma decisão comercial que precisa ser resolvida antes do
código.

## Os 3 caminhos possíveis

Levantei o que existe hoje no mercado brasileiro pra ativar pagamento numa
GPOS780 "crua". São três modelos genuinamente diferentes — a escolha entre
eles muda a arquitetura do que vamos construir.

### Caminho 1 — TEF terceirizado (SiTef, PayGo, Auttar, Connect TEF...)

Um provedor de TEF já homologado com várias adquirentes faz a ponte entre o
app comercial e o roteamento de pagamento. A empresa contrata **captura**
separadamente com uma ou mais adquirentes (Cielo, Rede, GetNet...), e o
provedor de TEF decide pra qual adquirente rotear cada transação.

- **Prós**: uma integração técnica só cobre várias adquirentes; trocar de
  adquirente no futuro não exige reescrever código; é o modelo clássico e
  mais maduro de automação comercial no Brasil (usado por PDVs de varejo,
  postos, restaurantes).
- **Contras**: mensalidade/taxa do provedor de TEF, além das taxas da(s)
  adquirente(s); mais uma camada de contrato pra negociar; algumas opções
  (Connect TEF) dizem cobrir Stone/Cielo/PagBank/Rede/GetNet/Mercado Pago e
  outras num só contrato — vale cotar antes de decidir.
- Exemplos encontrados: [PayGo Integrado](https://paygo.com.br/) (roda como
  app instalado na própria GPOS780, kit de integração em Java/Kotlin, `.aar`),
  [Connect TEF](https://docs.connecttef.com.br/) (API única, multi-adquirente,
  comunicação via Wi-Fi ou chip 4G da própria maquininha).

### Caminho 2 — SDK direto de uma adquirente específica

Contratar diretamente uma adquirente (Stone, PagBank, Cielo, Rede, GetNet) e
usar o SDK dela. Exemplo concreto: a PagBank tem o **PlugPag** (Bluetooth,
pra quando o app roda em outro aparelho) e também um modo de app instalado
dentro do próprio SmartPOS (Intent local).

- **Prós**: sem camada intermediária, potencialmente taxa menor (sem
  provedor de TEF no meio); suporte direto do fabricante do SDK.
- **Contras**: **não é garantido que a adquirente aceite ativar um hardware
  comprado avulso** (BYOD) — normalmente elas vendem/alugam o próprio
  aparelho já provisionado de fábrica. Isso precisa ser confirmado
  diretamente com cada adquirente antes de qualquer linha de código. Trocar
  de adquirente depois = reescrever a integração do zero.
- A PagBank está descartada como ponto de partida nesta rodada (gateway dela
  nunca funcionou de fato, ver correção acima) — mas pode voltar a ser opção
  se o time confirmar que aceitam ativar hardware próprio e o gateway for
  colocado pra funcionar de verdade.

### Caminho 3 — Ainda não decidido (registrado assim de propósito)

O usuário pediu explicitamente que este documento **não recomende** um
caminho comercial — a decisão depende de cotação/negociação com adquirentes
e provedores de TEF, fora do escopo técnico. Os dois caminhos acima ficam
registrados com prós/contras pra essa conversa acontecer com informação na
mão.

**Próximo passo concreto sugerido**: cotar em paralelo (a) um provedor de
TEF multi-adquirente (ex: Connect TEF) e (b) 1-2 adquirentes diretas,
perguntando explicitamente se aceitam ativação de GPOS780 comprada por fora.
Isso não bloqueia o levantamento técnico abaixo, que é o mesmo nos dois
caminhos.

## Onde o app que comanda a cobrança deve rodar — recomendação técnica

Essa pergunta ficou em aberto pro usuário decidir com apoio técnico. Minha
recomendação:

**Rodar um app Android nativo dentro da própria GPOS780** (não um bridge
Bluetooth controlado por outro aparelho).

Por quê:
- A GPOS780 é um Smart POS completo (tela, teclado touch, impressora,
  câmera) — é justamente pra isso que esse modelo existe. O padrão de
  mercado pra esse tipo de aparelho (visto tanto no PayGo Integrado quanto
  no modo "SmartPOS" da PagBank) é o app comercial **rodar localmente**,
  chamando o SDK/biblioteca de pagamento via Intent/AIDL local — não via
  Bluetooth pra outro dispositivo.
- Bluetooth (PlugPag "clássico") é o modelo certo pra maquininhas **sem**
  tela própria/burras (tipo Moderninha Pro2), controladas por um celular ou
  PC separado. Não é o caso aqui — jogaria fora a tela/impressora que a
  GPOS780 já tem embutida, e adiciona uma camada de pareamento/conexão que
  pode falhar.
- Confirma também a decisão já registrada em `docs/plano-terminais-caixa-pwa.md`
  ("cartão físico nunca vai ser a mesma integração que PIX/site, por
  natureza técnica — SDK nativo instalado no próprio aparelho, não é API
  web, não roda no navegador").

**O que isso implica pra arquitetura**: precisa de um app Android separado
do site Next.js — um "cliente fino" de pagamento, não um app completo. Ele:

1. Autentica com o backend Tipo7 (reaproveita login/token do caixa já
   existente — token+PIN, mesmo mecanismo de `/caixa`).
2. Recebe o valor a cobrar (gerado pelo operador na tela do caixa, que roda
   normalmente no navegador/PWA de outro aparelho, ou na própria GPOS780
   também via navegador — a decidir).
3. Dispara a transação local via SDK/biblioteca do provedor escolhido
   (Caminho 1 ou 2 acima).
4. Devolve o resultado (aprovado/negado, NSU, bandeira, comprovante) pro
   backend via API REST já existente, fechando a venda/ticket do mesmo jeito
   que PIX e Dinheiro já fecham hoje.

Isso mantém a regra "PWA, não app nativo" (`plano-terminais-caixa-pwa.md`,
item 4) praticamente intacta — só a função específica de cobrar cartão vira
um app nativo fino e pontual, não o sistema inteiro.

## Como o operador aciona a cobrança — duas variações possíveis

Fica em aberto qual das duas serve melhor, mas registro as opções pra
decisão futura:

- **A. GPOS780 é o próprio terminal do operador** — ele opera o caixa
  (bilheteria, estacionamento) direto na tela da GPOS780, pelo navegador
  (PWA `/caixa` já roda nela hoje, confirmado — "Android completo, roda
  navegador/webview normal"), e ao escolher "Cartão" o navegador aciona o
  app nativo de pagamento instalado no mesmo aparelho (via deep link/Intent
  do Android, ou WebView com bridge JS).
- **B. GPOS780 fica ao lado do PC/tablet do caixa** — o operador trabalha
  no PC normalmente, e só quando escolhe "Cartão" o valor é empurrado pra
  GPOS780 (rede local, já que ela tem Wi-Fi e/ou o backend já tem SSE
  configurado — ver `BilheteriaStreamService` usado hoje pra sync entre
  abas) — a GPOS780 mostra o valor, cobra, e o resultado volta pro PC via
  polling/SSE.

A opção B é mais parecida com o que Connect TEF já oferece pronto (webhook/
API entre o PDV e a SmartPOS via rede, sem precisar reinventar esse
transporte). A opção A é mais simples de operar fisicamente (um aparelho só)
mas exige plugar o "cliente fino" nativo dentro do próprio navegador da
GPOS780. Decidir isso depende também de qual caminho comercial (1 ou 2) for
escolhido, já que Connect TEF já resolve esse transporte pronto.

## Casos de uso — cobertos igualmente (Estacionamento + Portaria)

### Estacionamento

Contexto já existente: `AtendenteClient.tsx`, botão "Cartão" hoje só marca a
escolha e volta pro formulário — "confirmação de procedimento", sem
integração real (mesmo estágio que Dinheiro tinha antes do troco).

Requisitos funcionais:
- Operador informa o valor da vaga (já calculado pelo sistema, igual
  Dinheiro/PIX hoje).
- Sistema aciona a GPOS780 com esse valor.
- Aguarda resultado (aprovado/negado/cancelado pelo cliente/timeout).
- Se aprovado: fecha o ticket de saída do veículo, imprime/envia comprovante,
  registra no caixa (mesmo fluxo de conciliação que Dinheiro/PIX já têm).
- Se negado/cancelado: volta pro formulário, permite tentar outra forma de
  pagamento, sem duplicar cobrança.

### Portaria / venda de ingresso presencial

Requisitos funcionais (novo — hoje não há venda de ingresso via cartão
físico presencial documentada):
- Operador monta a venda (evento, tipo de ingresso, quantidade) na tela de
  Bilheteria, igual já acontece pra Dinheiro/PIX.
- Sistema aciona a GPOS780 com o valor total.
- Aprovado → emite o(s) ingresso(s) do mesmo jeito que a compra online emite
  (mesmo gerador de QR/ticket), imprime comprovante da maquininha.
- Negado/cancelado → mesma regra do estacionamento, sem duplicar.

### Requisitos comuns aos dois casos de uso

- **Timeout**: se a maquininha não responder em X segundos (a definir),
  operador precisa conseguir cancelar/tentar de novo sem travar o caixa.
- **Reconciliação financeira**: toda transação de cartão precisa registrar
  NSU + bandeira + valor + horário no mesmo lugar que já soma Dinheiro/PIX
  pro fechamento de caixa (`Caixa`, sangria, relatórios) — sem isso, o
  fechamento de caixa fica incompleto pra quem pagou de cartão.
- **Reimpressão de comprovante**: em caso de falha na impressão (papel
  acabou etc.), precisa reimprimir sem cobrar de novo.
- **Cancelamento/estorno**: fluxo de estorno de uma cobrança já aprovada
  (ex: cliente desistiu depois de pago) — depende de que operação o SDK/TEF
  escolhido oferece (nem todo caminho suporta estorno automático via API,
  às vezes é manual no próprio aparelho).
- **Modo de falha de conectividade**: a GPOS780 tem chip 4G próprio, então
  em teoria funciona mesmo sem Wi-Fi do local — mas cai fora do escopo de
  "venda offline sem internet" já registrado como pauta futura separada
  ([[project_venda_offline_sem_internet]]).

## Perguntas em aberto (decisão pendente, não bloqueiam este documento)

1. **Caminho comercial** (TEF terceirizado vs adquirente direta vs qual
   adquirente/provedor) — depende de cotação, fora do escopo técnico.
2. **Onde o operador clica "Cobrar Cartão"** — na própria GPOS780 (opção A)
   ou em outro aparelho com a GPOS780 ao lado (opção B) — depende em parte
   da resposta de (1).
3. **Estorno automático via API** existe no caminho escolhido, ou só manual
   no aparelho?
4. **Timeout padrão** de espera por resposta da maquininha — a definir junto
   com o provedor escolhido.

## Complemento (26/08/2026) — app único multi-adquirente + app único multi-módulo

Duas perguntas novas do usuário, respondidas e registradas aqui.

### App único suportando vários adquirentes, escolhidos pelo site

Viável nos dois caminhos comerciais, mas de jeito bem diferente:

- **Caminho 2 (SDK direto por adquirente)**: o app embute o SDK de cada
  adquirente que quiser suportar (Stone + Cielo + Rede + ... — cada um é uma
  biblioteca própria) e escolhe qual chamar em runtime, com base numa
  configuração vinda do backend (mesmo lugar onde já existe a seleção de
  gateway online, `Admin > Financeiro > Bancos > Gateways`). Custo real: cada
  adquirente embutida exige **homologação própria** antes de produção — N
  adquirentes = N processos de homologação separados.
- **Caminho 1 (TEF terceirizado)**: já é o caso de uso central desse tipo de
  plataforma — uma integração só, o provedor decide o roteamento pra
  qualquer adquirente contratada, sem homologar cada uma separadamente do
  lado do Tipo7.

**Achado novo pra pesar na decisão comercial** (não é recomendação de qual
adquirente, é constatação técnica): como esse requisito de multi-adquirente
escolhido dinamicamente apareceu, ele pesa a favor do Caminho 1 — é
exatamente o que essas plataformas resolvem prontas; no Caminho 2 essa
flexibilidade teria que ser construída (e homologada) do zero, adquirente
por adquirente.

**Em aberto**: se "escolher o gateway" é (a) configuração feita uma vez pelo
promotor/dono do evento (parecido com o seletor de gateway que já existe no
checkout online) ou (b) escolha/fallback feito pelo operador a cada venda —
muda o modelo de dados. (a) é 1 campo salvo no evento/local; (b) exige lógica
de retry entre adquirentes.

### App único cobrindo Bilheteria/Estacionamento/Tenda/Praça de Alimentação

Recomendação: **não reconstruir essas telas em nativo**. A rota `/caixa`
já faz a detecção automática de módulo por token+PIN (ver
`plano-terminais-caixa-pwa.md`, item "Redirect inteligente após login").
O app da GPOS780 deve ser uma **casca nativa fina (WebView)** carregando
essa mesma `/caixa` — reaproveita 100% da UI e da lógica de redirect já
existente. A única peça nativa de verdade é uma ponte JS↔Android: ao clicar
"Cobrar no cartão", a página chama a ponte, a ponte aciona o SDK de
pagamento, e devolve o resultado pra página confirmar a venda pelos
endpoints que já existem hoje (mesmo padrão que Dinheiro/PIX já fecham).

Isso significa 1 app só, não 4 apps/4 telas nativas separadas.

**Ressalva**: Bilheteria e Estacionamento já existem e já funcionam com essa
detecção automática. **Tenda e Praça de Alimentação não existem ainda no
sistema** — seguem como "Fase D — EM ESPECIFICAÇÃO" em
`plano-terminais-caixa-pwa.md` (sem catálogo, sem permissão, nada
implementado). O app pode já prever esses 2 módulos na arquitetura, mas eles
só aparecem/funcionam de fato quando a Fase D for construída.

### TEF agora não fecha a porta pra adquirente direta depois

Pergunta do usuário: começando pelo TEF (caminho hoje mais viável, sem
homologação própria por adquirente), dá pra sair depois adquirente por
adquirente direto, dependendo só da aprovação de cada uma?

Resposta: sim, com um detalhe — não é *só* aprovação. São duas coisas
separadas por adquirente: (1) **integração técnica própria** (cada
adquirente tem SDK/biblioteca diferente, não é código reaproveitado) e (2)
**homologação/certificação** depois da integração pronta (dias a semanas,
às vezes repete a cada atualização relevante do app).

Isso não invalida nada do trabalho feito com TEF: se a arquitetura for
desenhada com uma interface tipo `PaymentProvider` (o app chama essa
interface, não o SDK específico direto), o TEF vira **uma implementação**
dela. Uma adquirente direta no futuro é **adicionar** outra implementação
atrás da mesma interface — TEF continua servindo de padrão/fallback pra
quem não valer a pena homologar direto, sem reescrever nada do que já
funciona.

### Checado direto no developer.pagbank.com.br (26/08/2026)

Usuário mandou print do portal de desenvolvedor da PagBank (seção "Outros
serviços") perguntando se alguma dessas peças serve tanto pro site quanto
pra SmartPOS. Conferido direto na documentação oficial:

- **"Plataformas de e-commerce integradas"** — plugins pra lojas virtuais
  prontas (Shopify, WooCommerce etc.). Não se aplica ao Tipo7, que já tem
  checkout próprio via API.
- **"Mundo físico"** — é onde ficam SmartPOS, PlugPag e TEF da PagBank.
  **Confirmado pela própria doc**: essas soluções são amarradas
  exclusivamente à PagBank como adquirente — não são multi-adquirente.
- **"EDI"** — troca de documento fiscal B2B, sem relação com pagamento por
  cartão.
- **Confirmação oficial**: a doc do PagBank declara explicitamente que
  "Mundo Físico" (presencial) e "Mundo Digital/APIs" (online) são
  **integrações totalmente distintas** — bate com o que já estava registrado
  neste projeto antes de checar a fonte oficial.
- **Achado extra**: o "TEF" da PagBank não é um TEF multi-adquirente (tipo
  Connect TEF). É a PagBank se homologando **para ser uma das opções de
  captura dentro de plataformas TEF de terceiros** (SiTef, PayGo). Não
  substitui o Caminho 1 — é uma peça que pode se encaixar dentro dele, se um
  dia quiserem incluir a PagBank como uma das adquirentes configuradas lá.

### Achado decisivo — PagBank não aceita a GPOS780 já comprada (26/08/2026)

Usuário perguntou o que procurar pra integrar PagBank tanto no site quanto
no terminal, já que são duas frentes de venda. Checado direto na doc oficial
da PagBank:

- **Site (Mundo Digital)**: reaproveitável — Orders API (PIX, cartão,
  débito 3DS, boleto) e Checkout API (link de pagamento hospedado) são a
  mesma linha já testada em sandbox antes. Falta só sair de sandbox pra
  produção: conta avançada + credenciais de produção.
- **Terminal (Mundo Físico/SmartPOS)**: **a PagBank explicitamente não
  aceita hardware de terceiros**, mesmo sendo o mesmo modelo Gertec —
  doc oficial: "existem dependências instaladas nos terminais do PagBank
  que complementam junto com o SDK". Relato de comunidade (sem solução
  documentada) de alguém que recebeu terminal de debug **da própria
  PagBank** e mesmo assim teve erro de ativação/vínculo — processo tem
  atrito real na prática.
  - Caminho exigido: parceria comercial ativa + conta avançada
    (`pagbank.com.br/para-seu-negocio/parcerias`) → recebe terminal de
    **debug fornecido por eles** → desenvolve em Java/Kotlin nativo (SDK não
    aceita WebView) → homologação (~7 dias úteis) → terminal de
    **produção** (configuração separada do debug, não dá pra trocar um pelo
    outro).
  - **Consequência prática**: escolher PagBank pro terminal significa
    comprar/alugar um aparelho novo *deles* — a GPOS780 já comprada fica de
    fora dessa frente específica.

**Contraste direto**: o PayGo Integrado (TEF terceirizado, Caminho 1) já
lista a GPOS780 como terminal homologado/compatível — é o caminho que
aproveita o hardware que já está em mãos, ao contrário do PagBank direto.

**Decisão que falta**: manter a GPOS780 já comprada (→ terminal via TEF
terceirizado ou outra adquirente que aceite BYOD, PagBank fica só pro site)
ou abrir mão dela e comprar aparelho oficial da PagBank (→ PagBank cobre as
duas frentes com a mesma conta, mas descarta o investimento já feito no
aparelho atual).

### Mesmo fornecedor de TEF cobrindo site + terminal (26/08/2026)

Correção de nomenclatura: **não existe "TEF da Gertec"** — Gertec é só o
fabricante do hardware (a GPOS780 em si); o TEF é sempre software de uma
empresa separada (SiTef/Software Express, PayGo, Connect TEF etc.) que roda
em cima do aparelho.

Pergunta do usuário: dá pra usar o mesmo TEF terceirizado escolhido pro
terminal também no site? Checado — depende do fornecedor:

- **SiTef (Software Express)** tem produto irmão **e-Sitef**, gateway de
  pagamento online pro site, da mesma empresa — inclusive com liberdade de
  escolher adquirente/meio de pagamento pro sistema Web.
- **PayGo** também tem os dois: produto **Presencial** (TEF, já confirmado
  compatível com GPOS780) e gateway de checkout pra loja virtual, mesma
  empresa.
- **Connect TEF**: não foi encontrado produto de cobrança online da parte
  deles — parece ser só presencial. Se escolhido, provavelmente precisaria
  de gateway online separado pro site.

**Ressalva que continua valendo** (mesma lógica já documentada com PagBank):
mesmo usando o mesmo fornecedor nos dois, continuam sendo **duas
integrações técnicas diferentes** — produto online é API REST (cartão sem
cartão presente), produto do terminal é SDK nativo Android (cartão com
cartão presente). O que se ganha com o mesmo fornecedor é conta/conciliação
financeira unificada, não código compartilhado.

**Consequência pra escolha do fornecedor de TEF**: esse requisito (cobrir
site + terminal com a mesma empresa) põe SiTef e PayGo à frente da Connect
TEF nessa comparação específica.

### Correção importante — o site já usa split de pagamento, não conta única (26/08/2026)

Usuário perguntou se, optando por 1 CNPJ só (o do Tipo7) recebendo tudo, não
haveria split — os valores cairiam todos na conta Tipo7. Resposta como
modelo hipotético: sim, estaria certo (sem split automático, repasse pro
promotor vira responsabilidade manual/interna). **Mas checando o código,
esse não é o modelo que o site já usa hoje** — correção do que foi dito
antes nesta mesma conversa.

Achado real, direto no código: `server/src/common/pagbank-token.service.ts`
(`resolvePagBankSplit()`) e o equivalente OAuth em `server/src/mp/mp.service.ts`
mostram que o Tipo7 **já tem split de pagamento de verdade**, tanto PagBank
quanto Mercado Pago — cada promotor **conecta a própria conta** (OAuth), e
a cobrança nasce dividida automaticamente entre a conta do promotor e a
conta da Tipo7 (`feePct`), resolvido pelo próprio gateway no momento da
transação (`checkout.service.ts`, usado tanto pra PIX quanto pro fluxo
principal). **O checkout é bloqueado se o promotor não tiver conectado a
própria conta** — não existe fallback pra conta única da Tipo7, é bloqueio
proposital no código.

**Consequência pro terminal**: se a intenção é manter consistência com o
que já existe e já funciona no site, o modelo certo pro terminal também é
cada promotor com conta própria — não conta única da Tipo7.

### Split de pagamento existe no mundo físico também, mas por 2 caminhos diferentes

Pesquisado se SmartPOS/TEF suporta split como o gateway online já suporta:

- **Split nativo, na hora da transação**: oferecido diretamente por
  adquirentes grandes — Stone, Cielo, GetNet, Rede, Mercado Pago. **Não
  encontrada confirmação de que SiTef ou PayGo (TEF terceirizado, caminho
  que aproveita a GPOS780 já comprada) ofereçam split nativo no terminal**
  — precisa perguntar direto na cotação.
- **Orquestrador de split por fora (pós-transação)**: empresas tipo Split
  Digital fazem o split depois que o dinheiro já caiu numa conta — funciona
  com qualquer adquirente/TEF, sem depender de integração nativa no
  equipamento. É a automação via API do modelo "conta única + repasse".

**Duas rotas possíveis daqui**: (a) trocar de plano e usar uma adquirente
com split nativo (Stone/Cielo/GetNet/Rede/MP), perdendo a vantagem de
"qualquer adquirente, aproveita a GPOS780 já comprada"; ou (b) manter
SiTef/PayGo e adicionar um orquestrador de split por fora, pro repasse
automático pro promotor.

**Pergunta adicionada à cotação de SiTef/PayGo**: eles têm split de
pagamento nativo no terminal, ou só na versão online (e-Sitef/PayGo Web)?
A resposta decide entre a rota (a) e (b) acima.

## Sessão de mão na massa (26/08/2026) — testado direto no aparelho físico

Depois do levantamento acima, começamos a testar de verdade. Registro do que
foi tentado, achado e onde travou.

### Correção da premissa "roda navegador normal"

**Errado** — na prática, o aparelho vem com um **launcher restrito**, sem
Chrome, sem qualquer navegador, sem Google Play. Apps de fábrica visíveis:
Agenda, Calculadora, Câmera, Configurações, Galeria, Relógio + apps próprios
da Gertec (**Gertec Box**, **GPOS700xr** — ambos "Not for commercial use"),
**SmartStore** (loja própria da Gertec) e **Triagem**. A SmartStore não abre
(provavelmente exige conta/ativação Gertec que esse aparelho "cru" não tem).

### Build do Android: `userdebug`

`gpos780_android11_v01.00__international_userdebug_977` — variante
`userdebug` (não `user`, não `eng`). Isso permite ADB via cabo USB **sem
precisar achar o toggle de "Opções do desenvolvedor"** escondido no launcher
customizado, e sem popup de autorização na tela (comportamento típico de
build de debug, `ro.adb.secure=0`).

### ADB conectado com sucesso

Instalado `platform-tools` (Google, direto via `dl.google.com`, sem precisar
do Android Studio inteiro). Conectado por cabo USB, reconhecido pelo Windows
como `VID_05C6&PID_90DB` (**05C6 = Qualcomm** — confirma SoC Qualcomm por
baixo do capô). `adb devices` mostrou `product:GPOS780 model:GPOS780`,
status `device` (autorizado).

### Achado técnico valioso: o SDK de pagamento real é da WangPOS, não da Gertec

`adb shell pm list packages` revelou pacotes de sistema que **não são da
Gertec**:
- `wangpos.sdk4.base`, `wangpos.sdk4.emv`, `wangpos.sdk4.keymanager`,
  `wangpos.upgrade.system`, `com.wangpos.service`, `com.wangpos.updatespdemo`
- `com.weipass.escposservice` (serviço de impressão térmica ESC/POS),
  `cn.weipass.idreader` (leitor de documento/ID)
- `com.wiseasy.cortexdecoderservice`, `com.wiseasy.wmmi`

**Conclusão**: a Gertec é a marca/hardware, mas o motor de EMV/cartão/
keymanager por baixo é da **WangPOS** (fabricante chinês de plataforma
SmartPOS, comum em referência de hardware white-label) — junto com
componentes da **Wiseasy** (outra plataforma de gerenciamento de SmartPOS
comum nesse mercado). Isso é relevante pra qualquer SDK/TEF que formos
integrar: o caminho de mais baixo nível pode passar por essas APIs, não só
pelas da Gertec. Também apareceram `br.com.gertec.mymdm` e
`br.com.gertec.smartstoremdm` — confirma que existe um MDM/gerenciamento
central rodando no aparelho (razão provável de tanta coisa vir travada).

### Tentativa de instalar um navegador via ADB — 4 falhas na mesma causa

Sem navegador nenhum instalado, tentamos sideload de um navegador leve via
`adb install`, pra testar a PWA sem precisar construir app nenhum ainda:

1. **Cromite** (fork ativo do Chromium, `arm64_ChromePublic.apk`, versão
   atual 148) — `INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES`
2. **Cromite SystemWebViewShell** (app de teste do WebView, bem menor,
   ~4MB) — mesmo erro
3. **F-Droid.apk** (fonte totalmente diferente) — rede pro f-droid.org
   extremamente lenta/instável nesse ambiente, download não completou
   (não chegou a testar instalação)
4. **Bromite clássico** (build de 2022, `108.0.5359.156`, bem mais antigo
   que o Cromite atual) — **mesmo erro** de certificado

**Hipótese de maior confiança, levantada pelo usuário**: esse aparelho
específico pode ser uma unidade de **homologação/desenvolvimento** (não a
versão de uso comercial final), e terminais de pagamento certificados
costumam ter uma **whitelist de certificado de assinatura** — só instala
apps cuja chave já foi cadastrada/aprovada via o programa de desenvolvedor
do fabricante (prática comum de segurança PCI: impede que qualquer app não
verificado entre num aparelho que lê cartão). Isso explicaria por que
**todas** as tentativas falharam do mesmo jeito, independente de fonte,
idade ou tamanho do APK — inclusive um app **construído por nós mesmos**
provavelmente falharia igual, já que nossa chave de assinatura também não
estaria cadastrada.

**Não confirmado ainda** — próximo passo real: entrar no portal
`portal.developer.gertec.com.br` (onde o usuário já tem login) e procurar
por "Solicitar homologação" ou processo de cadastro de certificado/app,
possivelmente vinculado ao número de série desse aparelho específico. Isso
bloqueia tanto testar navegador quanto construir nosso próprio app nativo —
não adianta partir pra nenhum dos dois sem resolver isso primeiro.

### Decisão operacional confirmada

Tela do aparelho configurada pra **nunca suspender** (Configurações > Tela >
Suspensão = Nunca) — decisão confirmada pro uso real: terminal fixo de
bancada, sem PIN de bloqueio, sempre pronto pro operador. Mais pra frente,
quando tiver app de verdade rodando, o passo seguinte é usar "fixação de
tela" (Screen Pinning) ou o próprio Gertec Box/MDM pra travar o aparelho só
no app da Tipo7.

## Próximos passos sugeridos

0. **(Novo, bloqueia o resto)** Verificar no portal
   `portal.developer.gertec.com.br` se esse aparelho específico precisa de
   homologação/registro de certificado antes de aceitar qualquer app
   (inclusive um navegador de terceiros ou app próprio construído do zero).
   Ver seção "Sessão de mão na massa" acima.
1. Cotar/confirmar com 1-2 adquirentes diretas e 1 provedor de TEF
   (ex: Connect TEF) se aceitam ativar uma GPOS780 comprada avulsa, e a que
   taxa.
2. Com a resposta, confirmar o "onde roda"/"quem aciona" (seção acima).
3. Só depois disso entra a Fase de implementação em si (app Android fino +
   endpoints novos no backend Tipo7 pra registrar a transação de cartão).

Combinado anterior (`plano-terminais-caixa-pwa.md`): essa integração entra
depois que o módulo de Estacionamento estiver fechado — continua valendo,
este documento só antecipa o levantamento pra não perder tempo depois.
