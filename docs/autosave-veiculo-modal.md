# Autosave — dados coletados no modal "Veículo" (Tipo7) + problema encontrado

> Documento pra mandar pro time da Autosave: primeiro a lista completa dos
> campos que o modal de cadastro de veículo no perfil da Tipo7 coleta e
> envia pra `POST /vehicles`, depois um problema real que encontramos
> testando ao vivo e não conseguimos diagnosticar do nosso lado.

## Contexto

A aba "Veículo" em `/perfil` (Tipo7) não grava nada em banco próprio — só
coleta os dados na tela e repassa direto pra `POST {baseUrl}/vehicles`
(header `x-api-key`), conforme o contrato que vocês passaram. Autosave é a
fonte única de verdade dos veículos.

## Campos coletados e enviados

Só `plate` é obrigatório na nossa tela; todo o resto é opcional — só vai no
corpo da requisição se o usuário preencheu.

**Identificação:** `plate`, `name`, `type`, `brand`, `model`, `year`,
`color`, `status`, `category`, `species`, `body_type`

**Documento (CRLV):** `chassis_number`, `renavam`, `engine_number`,
`security_code`, `license_expiry` (`AAAA-MM-DD`), `licensing_year`,
`restrictions`

**Características técnicas:** `odometer_km`, `fuel_type`, `capacity`,
`power_cv`, `displacement`, `cmt`, `axles`

**Proprietário / motorista / local:** `owner_name`, `owner_document`
(CPF/CNPJ, só dígitos), `driver_phone` (só dígitos), `city`, `state`,
`notes`

Isso é exatamente o conjunto de 30 campos do contrato que vocês nos
passaram — não adicionamos nenhum campo extra.

## Problema encontrado (08/08/2026) — precisa da ajuda de vocês pra diagnosticar

Testando `type` e `status` com valores diferentes, direto contra
`https://www.tipo7.com/api/profile/veiculo` (nosso endpoint, que só repassa
pra vocês), achamos este padrão:

| Campo | Valor testado | Resultado do nosso lado |
|---|---|---|
| `type` | `"car"` | ✅ 201, sucesso |
| `type` | `"motorcycle"` | ✅ 201, sucesso |
| `type` | `"carro"` | ❌ falha |
| `type` | `"moto"` | ❌ falha |
| `type` | `"xyz"` (lixo) | ❌ falha |
| `status` | `"active"` | ✅ 201, sucesso |
| `status` | `"ativo"` | ❌ falha |
| `status` | `"inactive"` | ❌ falha |
| `status` | `"xyz"` (lixo) | ❌ falha |

**O estranho:** nas tentativas que falham, a resposta demora ~0.8 a 1.8
segundo — tempo real de rede, não é uma rejeição instantânea — mas do
nosso lado a conexão simplesmente não completa (viramos um erro genérico
de "serviço inalcançável" antes mesmo de conseguir ler uma resposta JSON
de vocês). **Não aparece nada nos nossos próprios logs de servidor** pra
essas tentativas, mesmo checando na hora — como se a chamada saísse, mas o
retorno nunca voltasse formatado como uma resposta HTTP normal.

**O que pedimos pra vocês verificarem, do lado de lá:**
1. Os logs de vocês têm registro dessas chamadas (mesmo IP/token de API,
   por volta de 08/08/2026 entre 18h e 19h UTC)? As placas de teste usadas
   foram `TST9Z9E1` a `TST9Z9E6` e `TST9Z9F1` a `TST9Z9F5`.
2. Existe alguma validação de enum em `type`/`status` que, ao rejeitar um
   valor fora da lista aceita, devolve algo que não seja um JSON de erro
   normal (ex: fecha a conexão em vez de responder com 400)? Isso bateria
   com o sintoma que vemos.
3. Qual é a lista completa e oficial de valores aceitos pra `type` e
   `status`? Confirmamos que `type: "car"`/`"motorcycle"` e
   `status: "active"` funcionam — precisamos do resto da lista (em inglês,
   pelo visto, não em português como o exemplo original sugeria) pra
   montar os `<select>` da tela certos.

Sem essa lista oficial, hoje `type`/`status` ficam como campo de texto
livre no nosso modal — o que significa que um usuário pode digitar um
valor inválido e a tela trava do jeito descrito acima, sem mensagem de
erro clara. Assim que tivermos a lista, trocamos pra `<select>` e esse
problema some (usuário só escolhe entre opções válidas).
