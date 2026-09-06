# Perguntas — call com suporte SiTef/Gertec (03/09/2026)

Documento só com as perguntas, pra usar durante a ligação. Contexto técnico
completo em [pesquisa-sitef-integracao.md](./pesquisa-sitef-integracao.md).

**Quem somos**: Tipo7, plataforma de eventos (ingressos + estacionamento).
Já temos uma GPOS780 comprada avulsa (sem vínculo com adquirente), rodando
Android 11, com um app próprio instalado nela. Queremos aceitar cartão
físico via SiTef.

---

## Já sabemos (confirmar, não perguntar do zero)

- Mensalidade = valor por maquininha/terminal **+** valor separado pelo
  serviço SiTef.
- SiTef cobre ~99% dos adquirentes — não precisa negociar um por um.
- Dá pra fazer por cliente (cada promotor de evento com seu próprio CNPJ).

## 1. Valor exato

Qual o valor de cada parte — mensalidade por maquininha e mensalidade do
serviço SiTef?

**Resposta:** _______________________________________________

## 2. Fluxo de credenciamento por cliente

Como fica o cadastro quando cada evento/promotor tem seu próprio CNPJ
recebendo o dinheiro — o próprio promotor se cadastra (self-service), ou é
a Tipo7 quem cadastra cada um manualmente?

**Resposta:** _______________________________________________

## 3. 4G vs WiFi

A GPOS780 tem 4G próprio. O m-SiTef funciona usando só o 4G, sem depender
de WiFi do local do evento? (Muitos dos nossos eventos são em área externa,
sem WiFi fixo disponível.)

**Resposta:** _______________________________________________

## 4. Caminho técnico recomendado

Pra integrar, existe o **m-SiTef** (app pronto que já roda no aparelho, a
gente só chama ele) e o **CliSiTef embutido** (biblioteca que a gente
coloca dentro do nosso próprio app). Qual caminho vocês recomendam pra
quem já tem app próprio rodando na maquininha?

**Resposta:** _______________________________________________

## 5. Homologação

Se usarmos o m-SiTef (caminho mais simples), ainda existe algum processo
de homologação técnica da nossa parte, ou o app m-SiTef já homologado
cobre a gente?

**Resposta:** _______________________________________________

## 6. Adquirentes na GPOS780 crua

Comprei a GPOS780 avulsa, sem vínculo com nenhum banco/adquirente. Quais
adquirentes/bandeiras consigo habilitar nela via SiTef?

**Resposta:** _______________________________________________

## 7. Prazo até produção

Como pedimos acesso ao ambiente de homologação/teste, e qual é o prazo
típico até liberar pra valer (produção)?

**Resposta:** _______________________________________________

---

> Depois da call, atualizar [pesquisa-sitef-integracao.md](./pesquisa-sitef-integracao.md)
> com as respostas confirmadas.
