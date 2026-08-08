# Boot Whats — novo campo `details` em `/whatsapp/purchase-confirmation`

> Documento pra combinar com o time da Boot Whats a mudança abaixo antes do
> texto do template de mensagem ser ajustado do lado de vocês. A Tipo7 já
> está mandando esses campos em produção — o texto da mensagem continua
> sendo montado inteiramente por vocês, isso aqui só amplia os dados
> disponíveis pra montar.

## Contexto

Hoje a Tipo7 dispara `POST /whatsapp/purchase-confirmation` quando um
ingresso é emitido (pagamento aprovado), uma chamada por ingresso do pedido
(a API só aceita 1 QR code por mensagem). O corpo sempre teve:

```json
{
  "to": "5546988212387",
  "type": "ingresso_emitido",
  "recipientName": "Nome do comprador",
  "qrData": "abc123..."
}
```

Isso já funciona, mas o time de vocês não tinha nome do evento, data ou
local pra colocar no texto da mensagem — ficava genérico ou vocês tinham
que adivinhar/deixar fixo.

## O que mudou (já em produção, 08/08/2026)

O corpo passa a incluir também um objeto `details`, com o mesmo evento e
ingresso da chamada:

```json
{
  "to": "5546988212387",
  "type": "ingresso_emitido",
  "recipientName": "Nome do comprador",
  "qrData": "abc123...",
  "details": {
    "nome_evento": "Festival de Verão",
    "data": "2026-12-15T22:00:00.000Z",
    "ingresso": "Pista",
    "local": "Espaço Alpha",
    "cidade": "Chapecó",
    "estado": "SC"
  }
}
```

### Campos de `details`

| Campo | Tipo | Sempre presente? | Observação |
|---|---|---|---|
| `nome_evento` | string | sim | Título do evento. Cai pra `"Evento"` se por algum motivo o evento não for encontrado. |
| `data` | string (ISO 8601) | não — pode vir `""` | Data/hora de início do evento, em UTC. Ex: `"2026-12-15T22:00:00.000Z"`. Formatar/converter fuso do lado de vocês, conforme o público-alvo. |
| `ingresso` | string | sim | Nome do tipo de ingresso desse ticket específico (ex: "Pista", "VIP", "Meia-entrada"). Cada chamada já é 1 ingresso só, então esse campo é sempre singular. |
| `local` | string | não — pode vir `""` | Nome do espaço/venue do evento. |
| `cidade` | string | não — pode vir `""` | |
| `estado` | string | não — pode vir `""` | Sigla, 2 letras (ex: "SC"). |

**Importante:** `details` é **retrocompatível** — os campos antigos
(`to`, `type`, `recipientName`, `qrData`) continuam exatamente iguais, no
mesmo lugar. Se o template do lado de vocês ainda não usa `details`, nada
quebra; a chamada segue funcionando como sempre funcionou.

## Próximos passos combinados

- [ ] Time da Boot Whats ajusta o template de `type: "ingresso_emitido"`
      pra usar `details.nome_evento` / `details.data` / `details.ingresso`
      (e `local`/`cidade`/`estado` se quiserem enriquecer mais o texto).
- [ ] Confirmar aqui neste documento (ou por onde for combinado) quando o
      ajuste do template estiver no ar, pra gente validar ponta a ponta com
      uma compra de teste real.
- **Ainda não implementado do lado da Tipo7:** o mesmo `details` só existe
  hoje pra `type: "ingresso_emitido"`. Quando o fluxo de ticket de
  estacionamento (nova feature, ainda em desenho) entrar, vai precisar do
  mesmo tratamento pra `type: "estacionamento_emitido"` — combinamos isso
  numa próxima rodada.
