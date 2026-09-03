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

## Exploração do portal do desenvolvedor Gertec (26/08/2026) — achado sobre Cerimonial de Chaves

Seguindo o passo 0 acima, entramos no `portal.developer.gertec.com.br` pra
procurar o processo de homologação/certificado. Mapeamento da trilha certa
e um achado que pesa na decisão comercial.

**Trilha do portal**: o menu "POS" que aparece primeiro é da linha **POS
Linux** (Ficha técnica POS Linux, PPComp, SHOPIN) — não é a trilha da
GPOS780, que é Smart POS Android. A trilha certa é **"Primeiros passos"**
→ depois **"Desenvolvimento Android"** (ainda não aberto). Dentro de
"Primeiros passos" existem os artigos: Glossário, Cuidados com o produto,
**Cerimonial de Chaves**, Criptografia Triple-DES/TDES/3DES, Conexão móvel,
Entendendo o funcionamento de uma compra com cartão, Remoção de Chaves DES
do Mapa ABECS, Integração - Primeiros Passos, TEF.

**O que é o Cerimonial de Chaves, lido direto no artigo oficial + no
"Formulário de Cerimonial de Chaves.docx"** (achado no Desktop do usuário):

- É o procedimento formal de **carregar a chave criptográfica** (TDES ou
  DUKPT-TDES) que o pinpad/POS usa pra criptografar PIN/dados — sem isso,
  o aparelho não consegue processar transação real com captura de PIN.
- **Exige presença física** na unidade da Gertec, com equipe deles +
  representantes do cliente/adquirente, seguindo princípios PCI de **dupla
  custódia** (2-3 "custodiantes", cada um sabe só uma parte da chave) — a
  própria doc desaconselha fazer com 1 pessoa só.
- Precisa agendar por e-mail (sugerir 3 datas), preencher o formulário
  (documento .docx com campos: equipamento alvo — PINPAD/MOBILE
  PINPAD/POS/MOBILE POS e modelo exato; algoritmo da chave; KCV; KSI se
  DUKPT; propósito — PIN/Dados/Transporte; quantidade de componentes da
  chave; se está protegida por chave de transporte), e levar documento de
  identificação.
- Custodiantes recomendados: pessoas de confiança (diretor, gerente, time
  de segurança) — a doc questiona explicitamente se pode ser "o
  desenvolvedor" e não dá resposta fechada (depende do que for combinado
  no e-mail).
- Chave fica guardada num **HSM** (Hardware Security Module) — cofre digital
  à prova de violação, com autodestruição das chaves em caso de tentativa de
  invasão física.

**Por que isso importa pra decisão comercial (Caminho 1 vs 2 do levantamento
acima)**: esse processo é pesado, presencial, com regra de dupla custódia e
burocracia de agendamento — não é algo que uma software house like a Tipo7
normalmente faz por conta própria pra um app. Na prática, **quem passa por
esse cerimonial já é o provedor de TEF ou a adquirente**, que entrega ao
integrador um SDK que já sabe falar com a chave carregada, sem o integrador
precisar tocar na chave em si. Isso é mais uma evidência a favor do
**Caminho 1 (TEF terceirizado)**: se formos pelo Caminho 2 (SDK direto de
adquirente) ou por integração de baixíssimo nível direto no keymanager da
WangPOS, é provável que sejamos nós (Tipo7) quem teria que passar por esse
cerimonial — o que não faz sentido pro tamanho da operação.

**Ainda não confirmado**: se o provedor de TEF escolhido (SiTef/PayGo/Connect
TEF) já resolve o cerimonial de chave por trás (bem provável, é o modelo
padrão do mercado) ou se ainda assim algum cerimonial local seria necessário
pra vincular a GPOS780 específica. Pergunta a mais pra somar na cotação do
próximo passo 1.

## Primeiras mudanças de layout aplicadas e testadas (01/09/2026)

Duas mudanças pequenas e de baixo risco (arquivo em produção, mexe com
dinheiro/veículo real — evitando reescrever tudo de uma vez):

1. **`web/src/lib/nativeCaixaApp.ts`** — `isNativeCaixaApp()`, detecta se a
   página roda dentro do app Android nativo (checando a presença de
   `window.CobrancaBridge`, injetada só lá). Reaproveitável em qualquer
   outra tela que precise diferenciar "rodando no navegador" vs "rodando na
   GPOS780".
2. Em `AtendenteClient.tsx`: bloco **"Impressora e ticket de entrada"**
   escondido por completo quando `isNativeCaixaApp()` — a GPOS780 já tem
   impressora térmica embutida, esse seletor genérico
   (Bluetooth/PrintServer/celular) não se aplica lá. `formatoImpressao`
   também passa a ignorar qualquer preferência salva no localStorage do
   mesmo evento quando em app nativo, ficando sempre `'nenhuma'` — evita
   herdar configuração de um uso anterior em navegador comum.
3. Grids `Modelo/Cor` e `Nome/WhatsApp`, que eram `grid-cols-2` fixo (nunca
   respondiam a tamanho de tela), viraram `grid-cols-1 sm:grid-cols-2` —
   empilham em 1 coluna em telas estreitas (GPOS780), continuam 2 colunas
   em tablet/PC como já era.

**Testado**: `tsc --noEmit` sem erros, recarregado no emulador `Tipo7Caixa`
com login real — confirmado visualmente que o bloco de impressora sumiu e
os campos empilharam certinho.

**Cabeçalho compactado (01/09/2026)**, mesma sessão — pedido do usuário:
- Linha 1: marca (ícone + "tipo7", mesmo estilo do `Header.tsx` do site) +
  nome do evento, truncando se necessário (`truncate`).
- Linha 2: badge do módulo (ícone `Car` + "ESTACIONAMENTO").
- 1 botão (`Menu`) abre um bottom-sheet "Funções do caixa" com o que antes
  eram 2 links de texto soltos (contagem do caixa, sangria) + o botão
  "Voltar" — que agora só aparece **fora** do app nativo (dentro da GPOS780
  não existe outra tela do site pra voltar, o app só serve pra essa
  função).
- Reduziu de 4 blocos empilhados (título 2 linhas + info do caixa + sangria
  + config de impressora) pra 2 linhas + 1 botão antes do formulário.

Testado: `tsc --noEmit` sem erros, recarregado no emulador, menu abre e
mostra as opções certas (sem "Voltar", confirmando a detecção de app
nativo).

**Ajustes no menu + "Ver meu caixa" (01/09/2026)**, mesma sessão:
- Modal "Funções do caixa" estava abrindo colado embaixo da tela
  (`items-end sm:items-center`, herdado do padrão de outro modal) — trocado
  pra `items-center` sempre, agora abre centralizado.
- Novo item **"Ver meu caixa"**: resumo de quanto já entrou no turno,
  quebrado por forma de pagamento (Dinheiro/PIX/Cartão) + fundo inicial +
  valor esperado na gaveta. **Não precisou de endpoint novo** — `GET
  /caixas/:caixaId` já calculava tudo isso (`calcularSaldoCaixa` em
  `caixas.service.ts`), só faltava uma tela pro operador consultar (só o
  dono/admin via até agora). Permissão de quem pode ver já vem resolvida
  nesse mesmo endpoint (dono OU o operador do caixa).
- Achado real no caminho: `fundo_inicial` chega como Decimal do Prisma
  (serializa como string no JSON) — `formatBRL()` esperava number puro;
  sem o `Number(...)` mostrava "100" cru em vez de "R$ 100,00". Os outros
  campos (totalDinheiro/Pix/Cartao/expectedGaveta) já vêm como number de
  verdade, somados em JS no backend.

Testado: `tsc --noEmit` sem erros, recarregado no emulador — modal
centralizado confirmado, "Ver meu caixa" abre e mostra os valores certos
com a formatação corrigida.

**Achado à parte**: a sessão de login não persiste entre reinícios do app
(fica só em memória, `web/src/lib/auth/session.ts`) — reiniciar o app
nativo sempre volta pra tela de login. Não é bug, é como o site já
funciona hoje (refresh de página também desloga); só relevante se algum dia
quisermos "lembrar login" no app nativo especificamente.

## Login completo confirmado + início do redesenho de layout (01/09/2026)

Login de verdade testado com token+PIN reais de um evento de teste
("EVENTO DE TESTES (NÃO E VÁLIDO)") — funcionou de ponta a ponta, caiu
direto na tela do Estacionamento (Atendente). A partir daqui começamos a
**Fase de layout**: redesenhar `AtendenteClient.tsx` (1200 linhas, hoje
pensado pra tela normal de PC/tablet) pro tamanho pequeno da GPOS780
(retrato, ~720×1280 reais — testado num emulador 1080×2400 que aproxima a
proporção). Mantendo a identidade visual já existente do produto
("Midnight Minimal with Gold Accent", ver `DESIGN_SYSTEM.md`) — não é
redesenho de marca, é adaptação de layout/ergonomia pro formato pequeno.

## Papéis do ecossistema TEF (26/08/2026) — onde a Tipo7 se encaixa

Lido o artigo "TEF" do portal Gertec, que define 3 papéis. Registrando aqui
porque esclarece de vez qual é o papel da Tipo7 na integração:

| Papel | Função | Quem |
|---|---|---|
| **TEF House** | desenvolve o software que conecta o estabelecimento com as adquirentes | SiTef, PayGo, Connect TEF |
| **Software House** | integra o TEF da TEF House dentro do sistema de automação comercial próprio, dá suporte ao cliente final | **Tipo7** |
| **Adquirente** | negocia taxa, processa pagamento, antecipa recebíveis | Stone, Cielo, Rede, GetNet etc. — contratada à parte pelo promotor/cliente |

Confirma a arquitetura já desenhada (app fino/ponte nativa chamando o SDK do
provedor de TEF escolhido) — a Tipo7 nunca precisa virar TEF House nem
Adquirente, só integrar como Software House.

**Ponto a esclarecer na cotação**: o artigo abre com "as soluções TEF **da
Gertec**", o que soa contraditório com o achado anterior ("não existe TEF da
Gertec, é só fabricante de hardware"). Leitura mais provável: é a Gertec se
posicionando como fabricante de hardware **homologado** pra rodar TEFs de
terceiros, não que a Gertec seja ela própria uma TEF House — mas vale
confirmar direto na cotação, pra não presumir errado.

## Referência técnica encontrada — impressão de QR Code via Gertec EasyLayer (26/08/2026)

Artigo do portal (trilha "Gertec EasyLayer") mostra como gerar e imprimir QR
Code na térmica embutida do aparelho — **não é sobre pagamento**, é
impressão. Guardado aqui porque conecta direto com
[[project_estacionamento_ticket_qr]] (ticket de estacionamento com QR
impresso na entrada) e [[project_impressao_termica_sessao_11_08]].

- **EasyLayer** é a biblioteca própria da Gertec pra periféricos (impressora
  térmica embutida) — diferente do SDK de pagamento (WangPOS, achado via ADB
  na sessão de mão na massa). As duas coexistem no mesmo aparelho, uma pra
  cada função.
- Dependências: `EasyLayer-SK210-v2.1.7-release.aar` (impressão) +
  `io.nayuki:qrcodegen:1.7.0` (geração do QR, alternativa ao ZXing).
- Fluxo: gera o QR como `Bitmap` (`generateQRCode(texto, largura, altura)`),
  imprime via métodos de imagem do EasyLayer, ou mostra em tela via
  `ImageView`.

**Quando isso vira útil de verdade**: só quando a Fase de implementação do
app Android nativo começar (depois da decisão comercial de TEF). Nesse
ponto, essa é a implementação de referência pra imprimir o ticket com QR
direto na GPOS780, sem reinventar.

## SDK Android oficial da Gertec — achado no portal (27/08/2026)

Usuário conseguiu acesso ao portal `gertec.atlassian.net` (Service Desk/
Confluence, login próprio) e colou o conteúdo do artigo **"Gertec SDK
GPOS780"**, seção "Pacote SDK". Registro do conteúdo e da leitura técnica.

### O que o pacote de desenvolvimento contém

Três bibliotecas:
- **PPComp** — "Biblioteca Compartilhada" (família GPOS700) — é a camada de
  pagamento/TEF propriamente dita.
- **GEDI** — funções de impressora, NFC e outros módulos do equipamento.
- **GANDI** — configurações exclusivas dos equipamentos Android padrão
  (APN etc.).

Conteúdo do pacote: driver USB do dispositivo Android, bibliotecas de
integração, documentação das bibliotecas, apps de exemplo.

### Achado decisivo: PPComp é casado com a Adquirente, não é agnóstico

A própria página avisa: **"A versão da PPComp deve corresponder à do
Adquirente principal que será utilizado!"** — ou seja, o PPComp não é uma
camada neutra que fala com qualquer adquirente. Cada build/versão já vem
homologada pra uma adquirente específica.

Tabela colada pelo usuário (Build Number → GANDI/GEDI → PPComp → Adquirente):

| Build Number | GANDI | GEDI | PPComp | Adquirente |
|---|---|---|---|---|
| 888 (2307111859) | 1.2.16 | 1.16.19 | 1.31 | — |
| 933 (2404182135) | 1.2.19 | 1.16.21 | 1.32 | **Fiserv - Rede** |
| 935 (2404301413) | 1.2.20 | 1.16.21 | 1.32 | **Fiserv - Rede** |
| 978A (2503141249) | 2.1.4 | 2.1.2 | 1.38 | — |
| 981 (2504142159) | 2.1.9 | 2.1.4 | 1.38 | — |
| 987 (2508121440) | 2.1.14 | 2.1.10 | 1.37 | — |
| 988 (2511121019) | 2.1.19 | 2.1.14 | 1.37 | — |
| 988B (2602091811) | 2.1.19 | 2.2.6 | 1.39 | — |

Só as versões 933/935 vieram com a coluna Adquirente preenchida no que foi
colado (**Fiserv - Rede**) — não confirmado se as demais linhas são a mesma
adquirente (cortado na cópia) ou se há outras mais abaixo na página original.
**Pergunta em aberto pro usuário**: rolar a página completa e confirmar.

### Leitura técnica — o que isso muda na decisão

Esse achado **reforça** o Caminho 1 (TEF terceirizado) como opção mais
flexível: se o SDK oficial "Gertec" pra GPOS780 já nasce amarrado a uma
adquirente específica (aparentemente Rede/Fiserv, na trilha encontrada até
agora), então "usar o SDK direto da Gertec" na prática **é** Caminho 2 (SDK
de adquirente específica), só que rodando por cima de bibliotecas com nome
Gertec (GEDI/GANDI) em vez de acessar a WangPOS por baixo diretamente. Não
existe, pelo visto até agora, uma trilha "SDK Gertec multi-adquirente" —
isso ficaria a cargo de um TEF terceirizado (SiTef/PayGo/Connect TEF) rodando
por cima dessa mesma base.

**Também explica uma peça do quebra-cabeça de 26/08**: é bem provável que a
"whitelist de certificado" que bloqueou o sideload de navegador/apps nas
tentativas anteriores seja resolvida justamente por esse cadastro no portal
— o próprio acesso que o usuário já tem agora pode ser o passo que faltava
pra registrar a assinatura de um app próprio. Ainda não testado — próximo
passo real depois de baixar o pacote é tentar instalar o app de exemplo do
SDK e ver se passa da barreira `INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES`
que travava antes.

**Ainda não confirmado**: se esse pacote SDK é exclusivo Rede/Fiserv ou se
existe versão equivalente pra outras adquirentes (Stone, Cielo, GetNet) na
mesma trilha do portal — vale procurar por outras páginas irmãs no mesmo
espaço "DA" do Confluence.

### Achado que simplifica tudo: PPComp é padrão ABECS, TEF já embute ele por dentro (27/08/2026)

Usuário colou o artigo "PPComp GPOS700 family – Shared Library" (a
documentação de baixo nível da biblioteca de PIN pad). Achado mais
importante, direto do aviso oficial no topo do artigo:

> *"caso o cliente já esteja utilizando algum SDK de TEF para pagamento, por
> exemplo SDK Software Express, SDK Stone ou SDK REDE, etc., **na maioria dos
> casos não será necessário incluir em seu aplicativo a biblioteca
> compartilhada**, visto que estes SDKs já a possuem internamente."*

**Leitura**: PPComp é a implementação Gertec do padrão **"Biblioteca
Compartilhada para PIN pad"** da **ABECS** (associação das bandeiras/cartões
no Brasil) — interface EMV de baixo nível (`PP_Open`, `PP_GetCard`,
`PP_GoOnChip`, `PP_FinishChip`, `PP_GetPin`, `PP_SetKbd`, tratamento de botão
"inflado" no Android, senão a tela trava ~2min por segurança, etc.). É
trabalho pesado, exige conhecimento prévio de arquitetura EMV, documento
próprio da ABECS embutido.

**Isso só importa de verdade pro Caminho 2 (SDK direto de adquirente/PPComp
cru)**. No Caminho 1 (TEF terceirizado — SiTef/PayGo), o SDK do TEF House já
embute o PPComp por dentro — a Tipo7, como Software House (ver tabela de
papéis já registrada acima), integraria contra o SDK do SiTef/PayGo, não
contra PPComp diretamente. **Reduz a complexidade real de implementação se
o Caminho 1 for o escolhido** — reforça ainda mais essa direção.

Também existe um app de teste oficial (`PPCOMP test.apk`, mar/2021) com
passo a passo de teste manual (Open → GetCard → produto Débito/Crédito →
GoOnChip → senha → FinishChip) — útil só se algum dia formos pelo Caminho 2
ou quisermos validar o hardware isoladamente antes de escolher TEF.

**Próximo passo real, mais produtivo que continuar explorando o portal
Gertec**: mandar a cotação já rascunhada em
`docs/rascunho-email-cotacao-tef.md` pra SiTef/PayGo/Connect TEF — as
respostas deles (BYOD, cerimonial de chave, split, estorno) importam mais
agora do que aprofundar em PPComp.

## Scaffold do app Android iniciado (01/09/2026), em paralelo à cotação

Enquanto a cotação (Caminho 1) não tem resposta, começamos a parte que não
depende dela: a casca nativa em WebView descrita na seção "App único
cobrindo Bilheteria/Estacionamento/Tenda/Praça de Alimentação" acima.

**Criado:**
- `android/` — projeto Android novo no monorepo (Kotlin, Gradle Kotlin DSL,
  wrapper gerado de verdade a partir de uma distribuição Gradle 8.9 já em
  cache na máquina). `MainActivity` carrega `{BASE_URL}/caixa` numa WebView
  — zero tela recriada, 100% reaproveitamento do `/caixa` que já existe.
- `CobrancaBridge.kt` — ponte JS↔Android (`window.CobrancaBridge.cobrarCartao(...)`
  → `window.Tipo7CobrancaCallback(callbackId, resultadoJson)`), documentada
  com o contrato final pra não precisar mudar do lado da página web quando o
  SDK real de TEF entrar. Hoje ela só repassa pro backend via HTTP
  (OkHttp) — nenhum cartão é lido de verdade ainda.
- `server/src/pagamentos-fisicos/pagamentos-fisicos.controller.ts` —
  endpoint novo `POST /pagamentos-fisicos/cobrar` (mesma auth Bearer/
  SupabaseJwtGuard do resto do backend), exposto especificamente pra essa
  ponte chamar. Não substitui a cobrança automática que
  `estacionamento.service.ts` já dispara ao fechar ticket com
  `formaPagamento='cartao'` — os dois convivem por enquanto; unificar isso
  é decisão pra quando o SDK real entrar (ver achado abaixo).

**Testado de verdade, não só "compilou no editor":**
- `cd android && .\gradlew.bat assembleDebug` → `BUILD SUCCESSFUL`, gerou
  APK debug de verdade.
- `cd server && npm run build` (nest build, produção) → sem erros.
- **Instalado e aberto num emulador real** (AVD novo `Tipo7Caixa`, criado
  separado do emulador que já estava aberto pra outro projeto, pra não
  mexer nele — mesma imagem `android-36/google_apis/x86_64` já em cache,
  sem baixar nada). Subiu `web` (Next dev, :3000) e `server` (Nest dev,
  :3001) locais, instalou o APK via `adb install`, abriu a `MainActivity` —
  **a tela real de "Acesso ao caixa" (login por token+PIN) carregou dentro
  da WebView nativa**, confirmando o caminho completo: app → WebView →
  `http://10.0.2.2:3000/caixa` → proxy Next.js → backend Nest. Log do
  servidor confirma a rota nova mapeada: `PagamentosFisicosController
  {/pagamentos-fisicos}` → `POST /pagamentos-fisicos/cobrar`.
- Não testado ainda: logar de verdade com token+PIN e acionar o botão
  "Cobrar Cartão" pela ponte (`CobrancaBridge`) — a página web ainda não
  chama a ponte (isso não foi feito nesta sessão, só o transporte da ponte
  foi construído e fica pronto pra ser chamado).

**Bug real achado e corrigido (01/09/2026) — HMR bloqueado derrubava o
formulário de login**: ao tentar digitar token+PIN dentro do app Android, os
campos "esvaziavam" sozinhos no meio da digitação, como se não aceitassem
texto. Não era teclado nem WebView — o Next.js bloqueia `/_next/webpack-hmr`
quando acessado de uma origem diferente de `localhost` (`10.0.2.2`, que é
como o emulador/app enxergam a máquina dev), e sem HMR conectar o dev server
cai num loop de full-reload da página (76 recargas de `/caixa` capturadas
num teste de poucos minutos) — cada recarga zera o estado React e some com
o que tinha sido digitado. Corrigido com `allowedDevOrigins: ['10.0.2.2']`
em `web/next.config.mjs`. **Só afeta ambiente de dev** (produção não usa
HMR) — mas se algum dia testarem com o IP da rede local (aparelho físico
GPOS780), esse IP também precisa entrar nessa lista. Testado e confirmado:
login completo funciona (`Token ou PIN inválido.` renderizado corretamente
pra credencial de teste, sem apagar os campos).

**Achado de arquitetura em aberto, registrado aqui pra não esquecer**: o
endpoint novo assume que quem aciona a cobrança é o cliente (app), mas hoje
`estacionamento.service.ts` já cobra sozinho, no servidor, ao fechar o
ticket — isso só funciona porque é mock (não fala com hardware nenhum). Com
SDK real, o cartão só pode ser lido no aparelho que o operador tem na mão
— o servidor não consegue "acionar a maquininha à distância" sem um
transporte tipo SSE/push (opção B já registrada acima). Antes de plugar o
provider real, decidir: (a) o app native chama `cobrar` ANTES de fechar o
ticket e manda o resultado junto (inverte quem dispara), ou (b) mantém o
servidor disparando e usa push/SSE pra acionar o terminal certo. Não
bloqueia o scaffold atual, mas bloqueia a integração real.

## Pacotes de SDK reais analisados (01/09/2026) — achado forte sobre o bloqueio de instalação

Usuário conseguiu os dois pacotes de desenvolvimento direto no portal
Gertec e mandou os arquivos: `PPComp_1.39.zip` (3MB) e `SDK 988B.zip`
(933MB, quase tudo é `OS/ATUALIZADOR_FULL_GPOS780_v988B_USERTSEC.apk`,
907MB — o atualizador de firmware completo pra build 988B; `README.txt`
avisa **usar esse atualizador só a partir da versão de imagem 987** — nosso
aparelho está na 977, então **não** atualizar direto sem confirmar o
caminho de upgrade certo, risco real de brickar o aparelho).

**Conteúdo de verdade (sem o firmware):**
- `PPComp_1.39/` — só as 2 libs já esperadas (`libhcl` + `libppcomp`, .aar
  e .jar, variantes `logs`/`release`) — confirma o que já sabíamos: só
  importa pro Caminho 2 (SDK direto de adquirente).
- `SDK 988B/SDK/Libs/` — `Gandi_2.1.19` (config do aparelho) e `Gedi_2.2.6`
  (periféricos: impressora, NFC etc.) — as duas bibliotecas "genéricas Android"
  que já sabíamos existir.
- `SDK 988B/SDK/Docs/` — javadoc completo de GANDI e GEDI (só HTML, sem PDF
  narrativo).
- `SDK 988B/SDK/Gertec Service/` — `GertecService-2.7.3.1-...apk`, o
  serviço de sistema que provavelmente hospeda essas permissões por trás.
- `SDK 988B/SDK/Samples/` e `Tools/` — **vazias** nesse pacote, sem app de
  exemplo pronto pra testar instalação.

### Achado forte: 2 métodos GANDI parecem endereçar direto o bloqueio de sideload

Lendo o javadoc de `IGandi`, dois métodos batem exatamente com o problema
da sessão de 26/08 (4 tentativas de instalar navegador via `adb install`,
todas com `INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES`):

- **`CanInstallUnknownAppsEnabled(packageName, enable)`** — "Activates/
  Deactivates Can install unknown apps", por pacote específico. Não lista
  GPOS780 na lista de "Unsupported to" (só GPOS700A/X/Mini, 720, 730, 740,
  760, 790, 790M) — ou seja, **é suportado no nosso aparelho**.
- **`EnableDebugInstallMode(enable)`** — "Enable/Disable install any
  application **(debug image only)**". Bate direto com o achado de
  26/08 de que o aparelho roda build `userdebug`. Também não exclui
  GPOS780 da lista de suportados.

Os dois exigem "Customer privilege" / "Enhanced privilege" respectivamente
— **não confirmado ainda** o que exatamente concede esse privilégio a um
app (provavelmente ligado ao cadastro no portal do desenvolvedor, mesma
trilha do "Cerimonial de Chaves"/certificado já mapeada, mas não achei doc
narrativo explicando isso dentro do próprio pacote SDK — só o javadoc
técnico dos métodos).

**Reframing importante**: a hipótese anterior era "whitelist de assinatura
de certificado" bloqueando qualquer app não cadastrado. Esse achado sugere
algo mais simples e mais controlável: **`CanInstallUnknownAppsEnabled`
provavelmente vem OFF por padrão e bloqueia instalação de qualquer app não
pré-aprovado**, independente de quem assinou — não é sobre a chave de
assinatura em si, é sobre esse toggle específico.

**Teste barato e ainda não feito, próximo passo real**: tentar `adb
install` do **nosso próprio** `android/app/build/outputs/apk/debug/
app-debug.apk` (Tipo7 Caixa) no aparelho físico de verdade — as 4
tentativas de 26/08 foram todas com **navegadores de terceiros**
(Chromium/Bromite/F-Droid), nunca com um app nosso. Se instalar sem erro,
o bloqueio pode não ser tão universal quanto pensávamos. Se falhar com o
mesmo erro, confirma que precisamos achar como acionar
`EnableDebugInstallMode`/`CanInstallUnknownAppsEnabled` antes de instalar
qualquer coisa — e aí vira um problema de "preciso rodar código Java no
aparelho antes de conseguir instalar app nenhum", que pode exigir suporte
direto da Gertec ou achar um caminho via `adb shell` sem precisar de app
instalado primeiro (não pesquisado ainda).

## Primeiro contato com a SiTef — por telefone (01/09/2026)

Usuário ligou pra SiTef (não por e-mail, então sem registro escrito pra
citar aqui). Foco da ligação foi comercial/valores, não técnico — usuário
não é da área técnica, então os detalhes abaixo são o que deu pra captar,
sem garantia de precisão total (nada em texto pra conferir):

- **BYOD confirmado**: aceitam ativar a GPOS780 **já comprada avulsa**
  ("máquina destravada e própria"). Também oferecem aparelho alugado como
  alternativa, se um dia fizer sentido trocar.
- Eles têm **um time de programadores que ajuda** na integração (postura
  de suporte ativo ao Software House, bate com o papel esperado de TEF
  House descrito antes).
- **Não capturado**: valores exatos (só que "pesquisou preços", sem
  números registrados aqui), cerimonial de chave, split de pagamento,
  estorno, prazo de homologação, kit de integração/SDK em si.

**Isso já resolve a maior pergunta em aberto do levantamento** (BYOD) —
Caminho 1 com a GPOS780 atual está confirmado viável comercialmente.

**Bloqueio real pra codar**: tudo que temos até aqui é verbal. Não dá pra
integrar sem material escrito — SDK, documentação técnica, ou pelo menos
um contato técnico direto. Próximo passo natural: pedir pra SiTef mandar
isso por e-mail (kit de integração, documentação, e as perguntas técnicas
que já estavam na cotação original — cerimonial de chave, split, estorno).

## Investigação a fundo do bloqueio de instalação (02/09/2026) — aparelho físico, com root

GPOS780 conectada de verdade (`0123abcd`, build igual à de 26/08:
`977`/`userdebug`/Android 11). Testes feitos:

1. **`adb install` do nosso próprio APK** (não navegador de terceiro,
   primeira vez testando isso) → **mesmo erro** de 26/08:
   `INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES: has mismatched
   certificates at entry`.
2. **Verificado com `apksigner verify --print-certs`**: nosso APK está
   perfeitamente assinado, 1 único signer (`Android Debug`), sem
   inconsistência real nenhuma — confirma que **o problema é do aparelho,
   não do nosso app**.
3. **`adb root` funcionou** — aparelho aceita root de verdade (build
   userdebug). Reinstalar como root, ou via `adb push` + `pm install` de
   dentro do shell, deu o mesmo erro — não é limitação do cliente `adb`,
   é o `PackageManagerService`/`installd` do aparelho recusando mesmo.
4. **Logs do sistema quase vazios de propósito** (`main`: 13KB de 16MB,
   `crash`: 0B) — aparelho endurecido, não loga verbosamente por padrão
   (postura típica de terminal certificado PCI).
5. **Não é restrição padrão do Android**: `dumpsys device_policy` sem
   Device Admin ativo; `dumpsys user` mostra `Restrictions: none` e
   `Effective restrictions: none` pro usuário 0 atual (`no_install_
   unknown_sources` só aparece no template de Guest, não aplicado a nós).
   Ou seja, **não dá pra destravar via `adb shell settings put` nem via
   DevicePolicyManager** — não é esse o mecanismo.
6. **Achado interessante, mas beco sem saída por ADB**: `br.com.gertec.
   mymdm` (app MDM já instalado de fábrica) tem `android.permission.
   INSTALL_PACKAGES` + `DELETE_PACKAGES` — privilégio de sistema real
   pra instalar qualquer coisa. Mas `dumpsys package` mostra **zero
   componentes exportados** (nenhuma Activity/Service/Receiver acessível
   de fora) em `mymdm`, `smartstoremdm`, `gertecinstaller`, `autorun`,
   `factory_service` — não tem porta aberta pra acionar isso via `adb
   shell am broadcast`/`am start` sem já ter código nosso rodando no
   aparelho.
7. **Nenhum serviço "gandi" registrado** em `service list` do Binder —
   a API GANDI (`CanInstallUnknownAppsEnabled`/`EnableDebugInstallMode`,
   achado de ontem) deve falar por outro caminho (só chamável de dentro
   de um app já instalado com o SDK, não via ADB puro) — **não testado
   ainda de fato**, porque exigiria conseguir instalar um app primeiro
   pra rodar esse código, o que é exatamente o problema.

**Conclusão**: não existe atalho por ADB/root pra destravar isso. Os dois
caminhos reais que sobram, nessa ordem de prioridade prática:

1. **Ir pela SiTef primeiro** — SDKs de TEF House costumam já vir
   pré-homologados/whitelisted pelo fabricante do hardware (é o modelo
   padrão do mercado, parceria direta Gertec↔SiTef) — reforça ainda mais
   o Caminho 1, agora também por motivo técnico, não só comercial.
2. **Cadastro formal no portal Gertec** (Cerimonial de Chave/homologação
   de app, trilha já mapeada em 27/08) — caminho de fallback se a SiTef
   não resolver isso sozinha.

**Deliberadamente não tentado**: remount de `/system` ou qualquer
modificação de partição de sistema — risco real de brickar um aparelho
físico de pagamento, não é decisão pra tomar sem confirmação explícita.

**Lib GANDI integrada no app mesmo assim (02/09/2026)**: copiada pra
`android/app/libs/libgandi-2.1.19-...aar`, dependência declarada em
`app/build.gradle.kts`, chamada em `GandiHelper.kt` (`EnableDebugInstallMode`
+ `CanInstallUnknownAppsEnabled`) disparada no `MainActivity.onCreate`.
Precisou de `tools:replace="android:allowBackup"` no manifest (a lib GANDI
declara `allowBackup=true`, conflitava com o nosso `false`). Build passa
limpo. **Testado no aparelho físico — instalação continua falhando com o
mesmo erro.** Confirma o problema circular já documentado: o código GANDI só
roda depois que o app já está instalado, mas é a instalação em si que está
bloqueada — ter a lib no APK não resolve isso sozinho.

## 🎉 RESOLVIDO — instalação destravada com chave de desenvolvedor da Gertec (02-03/09/2026)

Usuário achou e mandou `INFOGedi_780.rar` (portal Gertec) — um projeto
Android **completo** de exemplo (`infoGEDI`), diferente dos pacotes SDK
anteriores (que só tinham as libs `.aar`, sem projeto/app de exemplo de
verdade). Dentro dele:

- Um APK pré-compilado (`APK/INFOGedi.apk`).
- O projeto-fonte completo, incluindo o **keystore de desenvolvedor da
  Gertec**: `Development_GertecDeveloper_EnhancedAPP.jks` (senha e alias no
  próprio `build.gradle` do projeto: storePassword/keyPassword =
  `Development@GertecDeveloper2018`, alias =
  `developmentgertecdeveloper_enhancedapp`). Certificado real:
  `CN=GertecDeveloper EnhancedAPP, O=Gertec Brasil Ltda`, emitido por
  `Development EnhancedAPP CA` da própria Gertec, válido até 2029.

**Teste decisivo**: instalado `INFOGedi.apk` (assinado com essa chave) no
aparelho físico via `adb install` → **sucesso**. Confirma de vez que o
bloqueio (`INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES`) é mesmo uma
whitelist de certificado, e essa chave de desenvolvedor está nela.

**Aplicado no nosso projeto**:
- Keystore copiado pra `android/keystore/` (fora de `app/`, **gitignored**
  — é credencial de terceiro, nunca commitar).
- `app/build.gradle.kts`: `signingConfig` novo (`gertecDev`) usado tanto em
  `debug` quanto `release`, **condicional** — se o arquivo não existir
  (outro dev, CI), cai de volta no keystore padrão do Android (build
  continua funcionando, só não instala na GPOS780 física).
- **Resultado: nosso próprio APK (Tipo7 Caixa) instalou no aparelho físico
  de verdade** — `adb install` retornou `Success` pela primeira vez desde
  26/08.

**Ajuste de rede pro app físico** (o app rodando na GPOS780 de verdade usa
Wi-Fi, não o `10.0.2.2` do emulador):
- Confirmado: PC na rede local em `192.168.18.39` (Ethernet), GPOS780 em
  `192.168.18.56` (Wi-Fi), mesma sub-rede, `ping` ok.
- `network_security_config.xml`: adicionado `192.168.18.39` como domínio
  liberado pra cleartext (além do `10.0.2.2` do emulador).
- `next.config.mjs`: `allowedDevOrigins` também recebeu esse IP (mesmo
  motivo do `10.0.2.2` de antes — sem isso, o HMR quebra e a página
  recarrega em loop).
- Build feito com `-PTIPO7_BASE_URL_DEBUG=http://192.168.18.39:3000`
  (override de linha de comando, não mudou o padrão do `gradle.properties`
  — emulador continua usando `10.0.2.2` por padrão).

**Bug real achado e corrigido no caminho**: chamar `GandiHelper.
tentarLiberarInstalacao()` no `onCreate` — mesmo depois de mover pra uma
thread separada — **trava a WebView inteira** no aparelho físico (tela
preta, nunca carrega nada, sem log nenhum, processo fica "R" rodando mas
nada renderiza). Como o problema que isso tentava resolver (instalação
bloqueada) já foi resolvido pela chave Gertec, a chamada foi **desativada**
(comentada, não removida) em `MainActivity.onCreate` — sem ela, a tela
carrega normalmente. Causa raiz exata do travamento não investigada a
fundo (não era mais necessário).

**Resultado final, testado e fotografado**: app Tipo7 Caixa rodando na
tela física real da GPOS780 (720×1280 confirmado), carregando `/caixa` via
Wi-Fi do dev server local, idêntico ao que já rodava no emulador.

## Achado de segurança — app nativo vazava navegação pro site geral (03/09/2026)

Usuário testando no navegador comum (não no app nativo) notou que, num
cenário de "sem caixa aberto ainda", o sistema mandava pro hub geral
(`/trabalho/[eventoId]`) — que tem link pra **"Meus trabalhos"** (painel
pessoal da conta, todos os eventos) e outras ferramentas fora do escopo.
Levantou a bandeira certa: **"nas maquininhas só teremos as telas de
estacionamento e bilheteria, conecta com o site apenas as informações
pertinentes ao evento que o token e PIN direcionar"** — um terminal
público (GPOS780, PC compartilhado) nunca pode ter caminho pra navegação
ampla, pra área pessoal de ninguém, nem pra home pública.

**4 vazamentos achados e corrigidos:**
1. `CaixaLoginClient.tsx` (`decidirDestino`) — dentro do app nativo
   (`isNativeCaixaApp()`), nunca mais cai no hub. Sem caixa direto pra
   entrar, fica na própria tela de login com erro ("Peça pro organizador
   abrir e designar um caixa"), sem navegar pra lugar nenhum.
2. `bilheteria/[eventoId]/caixa/[caixaId]/page.tsx` — tela "Acesso negado"
   tinha `href="/"` (home pública). Removido.
3. `estacionamento/[eventoId]/page.tsx` — mesmo link, mesmo fix.
4. `bilheteria/[eventoId]/page.tsx` — tela "Aguardando abertura do caixa"
   linkava pro hub (`/trabalho/[eventoId]`). Trocado por um botão
   "Atualizar" novo (`AtualizarButton.tsx`, só recarrega a página) — resolve
   o mesmo problema (checar de novo se o caixa abriu) sem sair do escopo.

**Por que os 3 primeiros não dependiam de `isNativeCaixaApp()`**: são
páginas de servidor (sem `'use client'`, sem acesso a `window`) — em vez de
tentar detectar o contexto no servidor, a correção foi só **nunca ter esse
link**, em nenhum contexto — mais simples e seguro nos dois casos (não
existe cenário real onde alguém precisa desse link específico).

**Testado**: `tsc --noEmit` sem erros. Não testado ainda no app nativo de
verdade forçando cada um desses 4 cenários (caixa fechado, sem permissão,
etc.) — próximo passo real antes de considerar resolvido de verdade.

**5º vazamento achado no aparelho físico de verdade (03/09/2026)**: o
usuário viu, na própria GPOS780, um modal pedindo **endereço completo**
(CEP/Rua/Bairro/Tipo de residência) com link pra `/perfil`. Origem:
`ProfileCompletionModal.tsx` — modal **global**, renderizado em
`Providers.tsx` (raiz do app, aparece em cima de QUALQUER página), dispara
sozinho 2s depois de carregar se o perfil da conta logada tiver endereço
incompleto. Não era específico de nenhuma tela de caixa, por isso escapou
da varredura anterior. Corrigido: `isNativeCaixaApp()` bloqueia o
`useEffect` que decide mostrar o modal — nunca aparece dentro do app
nativo. **Testado no aparelho físico de verdade**: recarregado, modal não
apareceu mais, voltou direto pra tela de login normal.

**Lição registrada**: vazamentos de escopo no app nativo podem vir de
qualquer lugar do site, não só das telas de caixa em si — qualquer
componente **global** (providers, modais, banners) precisa ser auditado
também, não só as páginas óbvias.

## 🎉 Impressão térmica confirmada funcionando (03/09/2026)

Via GEDI (`GEDI.getInstance(ctx).getPRNTR()` → `Init()` →
`DrawStringExt(config, texto)` → `Output()`, achado no javadoc do pacote
SDK 988B). Implementado com cuidado pra não repetir o susto da GANDI:

- `PrinterHelper.kt` — chama a sequência acima, tudo em try/catch.
- `PrintTestReceiver.kt` — `BroadcastReceiver` **só acionável via ADB**
  (`am broadcast -a br.com.tipo7.caixa.TESTE_IMPRESSAO`), roda numa thread
  separada, **completamente desacoplado do boot do app** — se travasse, só
  travava essa thread isolada, a WebView já tinha carregado antes de
  qualquer chance de disparar isso.

**Testado no aparelho físico de verdade**: app carregou normal, broadcast
disparado, app continuou respondendo (não travou) — e **o papel saiu de
verdade** da impressora térmica embutida, confirmado pelo usuário. Primeira
função de hardware da GPOS780 (além de instalar app) comprovada funcionando
via nosso próprio código.

**Também nessa sessão**: campo Placa (`AtendenteClient.tsx`) ganhou
`autoCapitalize="characters"` — teclado já abre em maiúsculo (placa é
sempre maiúscula), sem o operador precisar tocar em Shift toda hora. Isso é
controlado 100% por nós (atributo HTML do input), não vem fixo de fábrica —
o teclado que aparece na GPOS780 segue as mesmas regras de qualquer
navegador, porque é a mesma WebView carregando a mesma página.

## Teclado dinâmico no campo Placa (03/09/2026)

Pedido do usuário: trocar o teclado (letras ↔ números) sozinho conforme a
posição do caractere sendo digitado na Placa, já que os 2 formatos
brasileiros são previsíveis:
- Mercosul: `L L L N L N N` (posição 5 = LETRA)
- Antiga: `L L L N N N N` (posição 5 = NÚMERO)

Implementado `inputModePlaca(comprimento)` em `AtendenteClient.tsx` —
retorna o `inputMode` HTML certo pra próxima posição (`text` nas 1-3,
`numeric` na 4, `text` na 5 — ambígua entre os formatos, cobre os dois —
`numeric` nas 6-7). Também ganhou `autoCapitalize="characters"` (mesma
sessão, pedido anterior) e some com o teclado sozinho ao completar os 7
caracteres.

**Ressalva honesta**: `tsc` limpo, mas **não testado ainda no aparelho
físico** — trocar `inputMode` num campo já focado nem sempre reage igual
em todo WebView/IME (pode ter uma piscada ou demorar a reagir dependendo
do teclado do sistema). Próximo passo real: testar isso especificamente
no aparelho assim que tivermos token+PIN válido de novo.

## Fixação de tela (Screen Pinning) — terminal travado no nosso app (03/09/2026)

Motivado por um toque acidental durante teste que jogou o app pra tela
inicial do Android (achado real, ao vivo) — usuário perguntou como travar
o terminal só na nossa tela. Dois níveis possíveis, registrados:

1. **Screen Pinning** (`startLockTask()`) — padrão do Android, qualquer
   app pode chamar, sem permissão especial. Botão Voltar/Recentes/Home
   param de responder até liberar de propósito (toque e segure Voltar +
   Recentes juntos). **Implementado agora** em `MainActivity.onCreate`,
   depois do `loadUrl`.
2. **Device Owner** (MDM de verdade) — trava mais forte (barra de status,
   troca de app), mas só funciona em aparelho sem conta configurada.
   **Ainda disponível** nesse aparelho (`dumpsys device_policy` confirma
   nenhum Device Admin ativo) — fica registrado como próximo passo, se um
   dia precisarmos de trava mais forte que Screen Pinning.

**Testado no aparelho físico de verdade**: instalado, app abriu e já
mostrou o diálogo nativo do Android "O app está fixado". Depois de
confirmar, tentei **Home** e **Recentes** via ADB (`keyevent 3` e `187`) —
os dois foram bloqueados, o app nunca saiu da própria tela (só voltou pro
login, dentro do app). Funciona.

**Nota pra nós mesmos, não bloqueia nada**: enquanto estivermos
testando/desenvolvendo, screen pinning ativo também bloqueia NOSSO próprio
acesso via toque físico ao Recentes/Home pra trocar de app no aparelho —
únicas saídas: o gesto de liberar (toque e segure Voltar+Recentes), ou
matar o processo via `adb shell am force-stop`.

**Próximo passo real de impressão**: adaptar `imprimirTicketEstacionamento`
(já existe em `AtendenteClient.tsx`, hoje só fala com PrintServer/RawBT)
pra ter um 3º caminho usando essa `PrinterHelper` quando `isNativeCaixaApp()`
— aí sim vira o ticket de verdade (placa/modelo/cor/QR), não só o texto de
teste fixo de agora.

## GEDI integrada também (03/09/2026)

Mesmo padrão da GANDI — copiada pra `android/app/libs/`, dependência
declarada em `app/build.gradle.kts`. **Nenhum código chamando ela ainda**
(só a dependência disponível, de propósito — lição da GANDI ontem: chamar
API de aparelho sem entender direito pode travar a tela). Fica pronta pra
quando entrarmos na Fase de imprimir ticket na térmica embutida da GPOS780.

**Achado no caminho**: GANDI e GEDI embutem a **mesma pasta fonte
`aidl/wangpos/...` inteira**, duplicada em mais de um caminho dentro de
cada `.aar` — confirma de novo (agora a nível de arquivo, não só de pacote
Android via `pm list packages`) que as duas rodam sobre a mesma base
WangPOS/Weipass por baixo. Resolvido com `packaging { resources {
pickFirsts += "**" } }` no `build.gradle.kts` — as duplicatas são sempre
"mesmo conteúdo, dois lugares", nunca conflito de verdade, então liberar
geral é seguro.

**Testado**: build passa limpo, instala no aparelho físico (mesma chave
Gertec), app abre e carrega normal — GEDI presente no APK não quebrou nada.

**O que isso desbloqueia**: dá pra continuar todo o desenvolvimento/teste
do app Android **direto no aparelho físico** de agora em diante, não só no
emulador — inclusive testar a instalação real de um SDK de TEF (SiTef)
assim que ele chegar, sem depender de resolver esse bloqueio de novo.
**Ressalva**: essa é uma chave de **desenvolvimento**, não de produção —
antes de distribuir o app de verdade (fora de teste), precisa decidir se
usa homologação própria da Tipo7 no portal Gertec, ou se o SDK do TEF
escolhido resolve isso por conta própria (bate com a leitura de que SDKs de
TEF House costumam vir pré-homologados).

## Próximos passos sugeridos

0. **(Atualizado 27/08)** Confirmar se a página do SDK lista outras
   adquirentes além de Fiserv/Rede; conferir o Build Number do aparelho
   físico (`adb shell getprop ro.build.display.id`) contra a tabela acima;
   baixar o Pacote de Desenvolvimento e testar se o app de exemplo instala
   sem cair no erro de certificado que travava as tentativas de 26/08. Ver
   seção "SDK Android oficial da Gertec" acima.
1. Cotar/confirmar com 1-2 adquirentes diretas e 1 provedor de TEF
   (ex: Connect TEF) se aceitam ativar uma GPOS780 comprada avulsa, e a que
   taxa.
2. Com a resposta, confirmar o "onde roda"/"quem aciona" (seção acima).
3. Só depois disso entra a Fase de implementação em si (app Android fino +
   endpoints novos no backend Tipo7 pra registrar a transação de cartão).

Combinado anterior (`plano-terminais-caixa-pwa.md`): essa integração entra
depois que o módulo de Estacionamento estiver fechado — continua valendo,
este documento só antecipa o levantamento pra não perder tempo depois.

## 03/09/2026 — teste ao vivo no aparelho físico: placa com teclado dinâmico

Testado direto na GPOS780 (não emulador) o ajuste da Placa no Estacionamento
(`autoCapitalize="characters"`, `inputMode` dinâmico por posição do
caractere, auto-blur ao completar 7 caracteres). **Confirmado funcionando**:
digitado `ABC1D23`, o campo aceitou maiúsculas e a busca automática disparou
sozinha (spinner apareceu) assim que bateu 7 caracteres — o `blur()` some
com o teclado sem precisar tocar em outro lugar.

A pedido do usuário, replicado o mesmo comportamento no campo **PIN** da
tela de login (`/caixa`): ao completar os 6 dígitos, o campo também some
com o teclado sozinho (`e.target.blur()` no `onChange`, só quando
`next.length === 6` — com 4 dígitos não dá pra saber se terminou, porque 4
já é um tamanho válido por si só, então só o de 6 tem gatilho automático).

**Achado no caminho, útil pra próximos testes no aparelho físico**: depois
de `am force-stop` num app que chamou `startLockTask()` (Screen Pinning),
o Android trava a tela do **launcher** no modo fixado (toast "Para liberar
o app, toque em Voltar e Visão geral..."), porque o pinning não foi
liberado antes do processo morrer — `am start` de novo no nosso app não
adianta enquanto isso não for resolvido. Solução via ADB, sem precisar do
gesto físico Voltar+Recentes: `adb shell am task lock stop`. Confirmado
que isso não deixa o aparelho em nenhum modo="lockTaskMode" residual
(`dumpsys activity activities | grep mLockTaskModeState` mostra `NONE`
depois).

## 03/09/2026 — kiosk de verdade: Device Owner + Lock Task (Screen Pinning não segurava)

Achado real testando com o usuário no aparelho físico: o `startLockTask()`
simples (Screen Pinning, sem Device Owner) **não segurava os botões da
GPOS780** — um toque nos botões (Home/Recentes) já tirava o app, achado que
motivou essa mudança. A trava de verdade do Android é **Lock Task via
Device Owner**: aí sim os botões física/logicamente não fazem nada fora do
app allowlistado, sem gesto de escape nenhum pro usuário.

**O que foi feito**:
- `AdminReceiver.kt` — `DeviceAdminReceiver` vazio, só o cadastro técnico
  necessário pra virar Device Owner.
- `MainActivity.kt` — no `onCreate`, se `dpm.isDeviceOwnerApp(packageName)`
  for verdade: `setLockTaskPackages(admin, [package])` +
  `addPersistentPreferredActivity(admin, filtroHOME, MainActivity)` (vira
  a Home persistente do aparelho, sem prompt de escolha). Se não for Device
  Owner ainda, cai pro Screen Pinning comum como fallback (com aviso no
  log).
- `BootReceiver.kt` — `BOOT_COMPLETED` → abre a `MainActivity` direto,
  reforço em cima de já sermos a Home persistente.
- `KioskControlReceiver.kt` — válvula de escape só por ADB (`adb shell am
  broadcast -a br.com.tipo7.caixa.KIOSK_DESATIVAR -n
  br.com.tipo7.caixa/.KioskControlReceiver`), pra tirar o aparelho do modo
  kiosk sem precisar de factory reset. **Achado**: só tirar o pacote do
  `setLockTaskPackages` não ejeta sozinho quem já está em Lock Task — foi
  preciso a `MainActivity` guardar uma referência estática de si mesma e
  a válvula chamar `stopLockTask()` na instância ativa.
- Ativado no aparelho via `adb shell dpm set-device-owner
  br.com.tipo7.caixa/.AdminReceiver` — **só funciona com o aparelho sem
  nenhuma conta cadastrada** (confirmado 0 contas antes de rodar).

**Achado sério no caminho — bug real de produção que isso revelou**: logo
depois de `am force-stop`, o Android **bloqueia silenciosamente** o
force-stop de um app em Lock Task por Device Owner (processo continua
vivo, mesmo PID) — mas `adb install -r` (reinstalar por cima) consegue
passar por cima disso (mata e reinicia o processo como parte da troca de
pacote). Isso quer dizer que em produção, se o app travar precisando de
reinício, `force-stop` manual não resolve — só reinstalar ou usar a
válvula de escape.

**Achado sério #2 — por que a tela ficava branca depois do boot**: o
`WebViewClient` original não tinha nenhum tratamento de erro — se o
`loadUrl()` inicial falhasse (ex: WiFi ainda subindo logo depois de ligar
o aparelho), a tela ficava branca pra sempre, sem tentar de novo sozinha.
Corrigido com `onReceivedError` fazendo retry com backoff (2s, 4s, 6s...
até 15s) chamando `loadUrl()` de novo. **Testado e confirmado**: reboot
completo → aparelho liga → cai direto no painel de token/PIN sozinho em
~8s, sem intervenção nenhuma.

**Achado sério #3 — nada a ver com kiosk, mas travou o teste por um
tempo**: o `gradle.properties` tem `TIPO7_BASE_URL_DEBUG=http://10.0.2.2:3000`
como valor padrão (só funciona no **emulador**) — rebuild sem passar
`-PTIPO7_BASE_URL_DEBUG=http://<ip-da-rede>:<porta>` explicitamente faz o
app físico apontar pro endereço errado silenciosamente (parece "travado"
carregando, sem erro óbvio). E a porta do servidor web dev mudou de sessão
pra sessão (hoje era **1200**, não 3000/3001/3002) — sempre conferir com
`netstat -ano | grep LISTENING` qual porta está realmente de pé antes de
buildar pro aparelho físico.

**Teste final confirmado**: reboot → boot completo (~15s) → app carrega
sozinho (~8s depois) → `input keyevent 3` (Home) e `187` (Recentes) não
tiram o app → `mLockTaskModeState=LOCKED` em todo o teste.

**Ressalva importante**: Device Owner é mais difícil de reverter que
Screen Pinning — não decorre de fábrica, mas some com `adb shell dpm
remove-active-admin br.com.tipo7.caixa/.AdminReceiver` (não precisa de
factory reset). Só funciona com o aparelho "limpo" (sem contas
cadastradas) — se algum dia logarem uma conta Google nele, precisa tirar a
conta antes de conseguir promover a Device Owner de novo.
