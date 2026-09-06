// Detecta se a página está rodando dentro do app Android nativo do caixa
// (android/, ver docs/maquininha-gpos780-levantamento-requisitos.md) em vez
// de um navegador comum. A WebView do app injeta a ponte `CobrancaBridge`
// via addJavascriptInterface — isso só existe lá, nunca num navegador normal
// (Chrome, Safari etc.), então a presença dela é um jeito confiável de
// detectar o contexto sem precisar de config nenhuma.
//
// Uso: esconder/adaptar UI que não faz sentido dentro do app nativo — ex.:
// a GPOS780 já tem impressora térmica embutida, então o seletor genérico de
// impressora (Bluetooth/PrintServer/celular) não deve aparecer lá.
export function isNativeCaixaApp(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as unknown as { CobrancaBridge?: unknown }).CobrancaBridge !== 'undefined'
}
