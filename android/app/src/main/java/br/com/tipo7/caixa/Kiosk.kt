package br.com.tipo7.caixa

import android.content.Context

// Preferência persistida (sobrevive a reboot/restart do app) pra saber se o
// modo kiosk (Device Owner + Lock Task) deve ser reativado sozinho no
// próximo onCreate(). Ver achado real em KioskControlReceiver.kt — antes
// disso, desativar via ADB durava só até o app reiniciar sozinho.
object Kiosk {
    private const val PREFS = "kiosk_prefs"
    private const val CHAVE_ATIVO = "ativo"

    fun ativo(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(CHAVE_ATIVO, true)

    fun setAtivo(context: Context, ativo: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(CHAVE_ATIVO, ativo).apply()
    }
}
