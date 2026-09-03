# Pesquisa — integração com SiTef (Software Express) na GPOS780

Documento de apoio pra call de suporte com a Software Express/Gertec
(03/09/2026). Levantamento feito por pesquisa externa (site oficial dev.
softwareexpress.com.br, fóruns do Projeto ACBr, documentação de terceiros
que já integram) — **não é uma confirmação oficial**, é material pra chegar
na call já sabendo o vocabulário certo e as perguntas certas. Complementa
[maquininha-gpos780-levantamento-requisitos.md](./maquininha-gpos780-levantamento-requisitos.md).

**Contexto da virada**: o módulo de pagamento físico que construímos até
agora (`pagamentos-fisicos`, `CobrancaBridge.kt`) usa um
`MockPaymentProvider` — nunca conversou com adquirente de verdade. A
avaliação é que esse caminho não serve mais: precisa ser SiTef de verdade.
Este documento existe pra preparar a virada.

## Vocabulário — 3 nomes que aparecem juntos e confundem

| Nome | O que é |
|---|---|
| **SiTef** | O servidor central da Software Express (empresa do grupo Fiserv) que fala com os adquirentes/bancos. É o "backend" de tudo — bilhões de transações/ano, 200+ bandeiras. |
| **CliSiTef** | A **biblioteca** que uma automação comercial (nós) usa pra falar com o servidor SiTef. Existe em várias plataformas (Windows, Linux, **Android**). |
| **m-SiTef** | Um **aplicativo Android pronto**, feito pela própria Software Express, que já embute o CliSiTef dentro dele. Fica instalado no aparelho (baixável pela Smart Store da Gertec) e outros apps conversam com ele por **Intent**, sem precisar embutir biblioteca nenhuma. |

## Os 3 caminhos de integração possíveis pra nós

### Caminho A — CliSiTef embutido no nosso APK (`clisitef-android.jar` + `.so`)
Inclui o `.jar` + bibliotecas nativas `libclisitef.so` direto no projeto
Android (`android/app/build.gradle.kts`, igual fizemos com GANDI/GEDI).
Nosso app implementa `ICliSiTefListener` e chama a transação por
`startTransaction`/`iniciaFuncaoSiTefInterativo`, recebendo retorno por
callback.

- ✅ Mais controle sobre a UI da transação, tudo dentro da nossa própria tela
- ❌ Exige passar pelo **"Roteiro de Pré-Homologação CliSiTef"** — um
  checklist extenso (60+ "sequências" numeradas de teste, encontrado
  referenciado em fóruns do Projeto ACBr) antes da Software Express liberar
  produção. É homologação técnica de verdade, não só cadastro.
- ❌ Mais trabalho de engenharia (gerenciar pinpad via USB/Bluetooth/
  interno, tratar toda a máquina de estados da transação)

### Caminho B — m-SiTef via Intent (app separado, já pronto no aparelho) — **RECOMENDADO PRA INVESTIGAR PRIMEIRO**
O app `m-SiTef` já vem homologado pela Software Express. A gente só
**dispara ele** do nosso app e recebe o resultado — não embute nada de
biblioteca nativa nossa.

```kotlin
val intent = Intent("br.com.softwareexpress.sitef.msitef.ACTIVITY_CLISITEF")
intent.putExtra("empresaSitef", "00000001")      // código da empresa no SiTef
intent.putExtra("enderecoSitef", "192.168.102.1;192.168.102.1:33121") // ver seção Rede abaixo
intent.putExtra("CNPJ_CPF", "12345678000199")     // CNPJ de QUEM está recebendo (o promotor/evento)
intent.putExtra("modalidade", "0")                // 0 = venda
intent.putExtra("valor", "1000")                  // em centavos
startActivityForResult(intent, REQUEST_CODE_MSITEF)
```

Resposta chega em `onActivityResult` (extras principais: `CODRESP` — `0` =
aprovado, `NSU_SITEF`, `BANDEIRA`, `REDE_AUT`, `COMP_DADOS_CONF` — dados do
comprovante). **Achado técnico**: `startActivityForResult`/`onActivityResult`
são APIs antigas do Android, hoje deprecated em favor de
`ActivityResultLauncher` — a doc oficial já tem um guia específico
("Exemplo de integração utilizando o AndroidX") pra isso.

- ✅ Muito menos trabalho de engenharia — é chamar uma Activity e ler o
  retorno, como qualquer Intent
- ✅ App m-SiTef já é baixável pela **Smart Store da Gertec** (loja de
  apps nativa do aparelho) — não depende de compilar biblioteca nativa
  nossa
- ❓ Precisa confirmar na call: será que ainda passamos pelo processo de
  homologação (mesmo que mais simples), ou o app m-SiTef sendo homologado
  já cobre a gente por completo?
- ⚠️ **Achado technical contraditório entre fontes** — ver seção Rede

### Caminho C — Interface Simplificada / e-SiTef REST
Voltado a e-commerce (loja virtual manda requisição HTTP/SOAP pro e-SiTef,
sem pinpad físico envolvido) — não parece ideal pro nosso caso (POS físico
com cartão presente na maquininha). Deixado registrado só pra descartar
com conhecimento de causa, não achamos necessário aprofundar.

## Confirmado pelo usuário (03/09/2026) — custo e modelo multi-cliente

O usuário já tinha essa resposta de contato prévio com a Software Express
(fora dessa pesquisa): o modelo de cobrança é **mensalidade por
maquininha** (valor X por terminal) **+ um valor X separado pelo serviço
SiTef em si**. O SiTef nessa modalidade **abrange ~99% dos adquirentes** —
não precisa negociar/homologar adquirente por adquirente. E confirmado
também: **dá pra fazer isso por cliente** — ou seja, o modelo "cada
promotor/evento com seu próprio CNPJ dentro da plataforma Tipo7" é
suportado. Isso resolve a maior parte da pergunta central da seção
abaixo — o que falta confirmar são só os detalhes: valor exato de cada
parte (por terminal vs pelo serviço), e o fluxo exato de credenciamento
por cliente (self-service vs manual via Tipo7).

## Requisitos comerciais — pergunta central pra amanhã

O modelo Tipo7 é de **plataforma**: muitos promotores de evento (cada um
com seu próprio CNPJ) usam o mesmo app/aparelho. Isso não é o modelo comum
de "1 automação = 1 loja".

O que a pesquisa sugere (precisa confirmar na call):
- A "Automação Comercial" (nós, Tipo7) provavelmente passa por um cadastro/
  homologação **uma vez só**, como fornecedor de software.
- Cada **estabelecimento final** (cada evento/promotor recebendo o
  dinheiro) parece precisar do próprio **código de empresa SiTef** vinculado
  ao próprio CNPJ — achado na pesquisa: "cada CNPJ tem 1 número de
  estabelecimento, mesmo pertencendo ao mesmo Grupo Comercial" e existe um
  modelo de contrato chamado **"SiTef Multi Stores"** pra gerenciar várias
  lojas.
- **Pergunta objetiva pra call**: no nosso caso (plataforma SaaS, cada
  eventos com CNPJ diferente, usando o mesmo hardware/app), qual é o
  fluxo — a Tipo7 credencia cada promotor dentro de uma conta "guarda-
  chuva", ou cada promotor precisa da própria adesão comercial direto com
  a Software Express/adquirente? Isso muda todo o desenho do produto
  (onboarding de promotor precisaria incluir esse passo ou não).

## Rede — ponto crítico pro nosso caso de uso (eventos, muitas vezes sem WiFi fixo)

Encontramos **duas informações que se contradizem** em fontes diferentes,
por isso vira pergunta obrigatória pra call:

- Uma documentação (PDV Legal, mais genérica) diz: **"M-SITEF funciona
  somente via Wi-Fi. Se o terminal estiver conectado por 3G ou 4G, a
  transação não será iniciada."**
- Outra documentação (específica de SmartPOS Gertec) lista endereço
  próprio pra 4G: `192.168.102.1:33121` — sugerindo que **nos aparelhos
  Gertec com chip/4G interno** o m-SiTef enxerga a conexão móvel como um
  IP interno de gateway (o aparelho provavelmente roteia o 4G através de
  uma interface local), e nesse caso funcionaria sim via 4G.

**Pergunta objetiva pra call**: a nossa GPOS780 especificamente — que tem
4G próprio — consegue rodar o m-SiTef **sem depender de WiFi do local do
evento**? Isso é decisivo: muitos eventos (área externa, terreno alugado
por um dia) não têm WiFi fixo disponível.

## Requisitos de cadastro encontrados (a confirmar)

- Adesão/contrato formal com a Gertec (um exemplo de e-mail de cadastro
  encontrado: `cadastro@gerun.com.br` — **não confirmado que seja o canal
  certo pra nós**, citar na call e pedir o canal oficial)
- Número da empresa SiTef + endereço do servidor TEF (fornecidos após
  cadastro)
- PinPad homologado, caso não use o leitor interno da própria GPOS780
- CNPJ de cada estabelecimento validado contra o CNPJ configurado no
  "Configurador SiTef" (dá erro/bloqueia venda se não bater)
- Ambiente de **homologação/teste** tem código de empresa fixo
  `00000000`; em produção o código é fornecido pelo setor comercial

## Parâmetros técnicos já mapeados (m-SiTef via Intent)

**Sempre obrigatórios**: `empresaSitef`, `enderecoSitef`, `modalidade`,
`CNPJ_CPF`. **Obrigatório quando `modalidade = "0"`** (venda): `valor` (em
centavos). Outros parâmetros vistos em exemplos: `operador`, `data`,
`hora`, `numeroCupom`, `numParcelas`, `timeoutColeta`,
`acessibilidadeVisual`.

**Retorno principal** (extras do `Intent data` em `onActivityResult`):
`CODRESP` (0 = aprovado), `CODTRANS`, `NSU_SITEF`, `BANDEIRA`, `REDE_AUT`,
`TIPO_PARC`, `VLTROCO`, `COMP_DADOS_CONF` (dados do comprovante, pra
imprimir via GEDI).

## Perguntas objetivas pra levar pra call de amanhã

1. ~~Pro modelo "plataforma com N promotores/CNPJs diferentes usando o
   mesmo app", qual é o fluxo comercial certo?~~ **RESPONDIDA** (usuário já
   confirmou em contato anterior: dá pra fazer por cliente, mensalidade é
   por maquininha + valor separado do serviço SiTef, cobre ~99% dos
   adquirentes). Falta só o **fluxo exato de credenciamento por cliente**
   — self-service (o promotor mesmo cadastra) ou manual (Tipo7 cadastra
   pra ele)?
2. A GPOS780 com 4G interno consegue rodar m-SiTef sem depender de WiFi do
   local do evento?
3. Caminho recomendado pra nós: m-SiTef via Intent (Caminho B) ou CliSiTef
   embutido (Caminho A)? Achamos que B é mais rápido — eles confirmam?
4. Se for Caminho B, ainda existe processo de homologação técnica da nossa
   parte, ou o app m-SiTef já homologado cobre a gente?
5. Quais adquirentes/bandeiras a GPOS780 "crua" (comprada avulsa, sem
   vínculo prévio) consegue habilitar via SiTef?
6. ~~Custo — mensalidade fixa por caixa/terminal, taxa por transação, ou
   ambos?~~ **RESPONDIDA** (ver item 1) — falta só o **valor exato** de
   cada parte (por terminal e pelo serviço SiTef).
7. Ambiente de homologação: como pedimos acesso, e qual é o prazo típico
   até liberar produção?

## Fontes consultadas

- [CliSiTef — Introdução](https://dev.softwareexpress.com.br/docs/clisitef/clisitef_introducao/)
- [Interface Android — Introdução](https://dev.softwareexpress.com.br/en/docs/clisitef-interface-android/introducao/)
- [Interface Android — Inclusão no Projeto](https://dev.softwareexpress.com.br/docs/clisitef-interface-android/inclusao_no_projeto/)
- [Interface Android — Funções disponíveis](https://dev.softwareexpress.com.br/docs/clisitef-interface-android/funcoes_disponiveis/)
- [m-SiTef — Guia de Integração](https://dev.softwareexpress.com.br/docs/m-sitef/m-SiTef/)
- [m-SiTef — Iniciando através de outro app](https://dev.softwareexpress.com.br/docs/m-sitef/introducao_integracao_outro_app/)
- [m-SiTef — Parâmetros de entrada](https://dev.softwareexpress.com.br/docs/m-sitef/parametros_entrada/)
- [m-SiTef — Resposta pra outro app](https://dev.softwareexpress.com.br/docs/m-sitef/resposta_msitef_outro_app/)
- [m-SiTef — Exemplo AndroidX](https://dev.softwareexpress.com.br/docs/m-sitef/androidx/)
- [Processo de homologação (Interface Simplificada)](https://dev.softwareexpress.com.br/docs/sitef-interface-simplificada/processo_homologacao/)
- [SiTef — página institucional Software Express](https://www.softwareexpress.com.br/pt/solucoes/SiTef/)
- [PDV Legal — Integração m-SiTef](https://ajuda.pdvlegal.com.br/integracoes/m-sitef)
- [SmartPOS.net.br — Integração Fiserv](https://ajuda.smartpos.net.br/en/integracoes/integracao-fiserv)
- [Projeto ACBr — SDK CliSiTef Android](https://www.projetoacbr.com.br/forum/files/file/528-sdk-clisitef-android)
- [Projeto ACBr — Roteiro de Pré-Homologação CliSiTef (Scribd, não acessado por completo)](https://www.scribd.com/document/707688920/Roteiro-de-Pre-Homologacao-CliSiTef-v17-ATUAL)

**Nota de confiabilidade**: o domínio oficial `dev.softwareexpress.com.br`
não estava acessível por fetch direto durante essa pesquisa (falha de
DNS/rede do lado daqui) — o conteúdo acima veio de resumos de busca sobre
essas páginas, não da leitura completa e direta delas. Vale conferir a
página ao vivo se possível antes ou durante a call.
