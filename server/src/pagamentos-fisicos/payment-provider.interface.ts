// Abstração genérica de "cobrança física" (cartão presente na maquininha),
// pensada pra servir QUALQUER módulo do Tipo7 que precise cobrar cartão
// físico — Estacionamento hoje, Bilheteria/Tenda/Praça de Alimentação amanhã
// (ver docs/maquininha-gpos780-levantamento-requisitos.md). Nenhum módulo de
// negócio deve chamar um SDK de adquirente/TEF diretamente: todos passam por
// PagamentosFisicosService, que por sua vez chama a implementação de
// PaymentProvider configurada (hoje: mock; depois: SiTef/PayGo/adquirente
// direta, trocando só o `provide` em pagamentos-fisicos.module.ts).
//
// Isso é o que o levantamento chamou de "interface tipo PaymentProvider":
// decisão comercial (qual TEF/adquirente) fica isolada atrás dessa interface,
// sem vazar pro código de cada módulo que cobra.

export interface ChargeRequest {
  /** Valor a cobrar, em reais (não em centavos). */
  valor: number;
  /** Caixa que está operando a cobrança — todo caixa físico já existe hoje. */
  caixaId: string;
  /** Nome do módulo/entidade de origem, ex: 'estacionamento_sessao', 'order'. */
  origem: string;
  /** Id da entidade de origem (sessão de estacionamento, order de ingresso, etc). */
  origemId?: string;
}

export interface ChargeResult {
  aprovado: boolean;
  /** Número Sequencial Único da transação, devolvido pela adquirente/TEF. */
  nsu?: string;
  /** Bandeira do cartão usado (Visa, Master, Elo...). */
  bandeira?: string;
  /** Código de autorização da transação. */
  autorizacao?: string;
  /** Motivo da negativa/erro, quando aprovado === false. */
  mensagemErro?: string;
}

export interface PaymentProvider {
  /** Identifica a implementação ativa (salvo em pagamentos_fisicos.provider). */
  readonly nome: string;
  cobrar(req: ChargeRequest): Promise<ChargeResult>;
}

/** Token de injeção — troque o `useClass` em pagamentos-fisicos.module.ts
 *  pra apontar pra implementação real (TEF/adquirente) quando a decisão
 *  comercial for fechada. Nada fora do módulo precisa mudar. */
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
