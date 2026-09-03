package br.com.tipo7.caixa

import android.app.admin.DeviceAdminReceiver

// Existe só pra virar pré-requisito técnico do Android: pra usar
// DevicePolicyManager.setLockTaskPackages()/addPersistentPreferredActivity()
// (kiosk de verdade — botões física/logicamente não fazem nada fora do
// nosso app) o app precisa estar registrado como Device Admin E virar
// Device Owner via `adb shell dpm set-device-owner`. Não implementa
// nenhuma política de senha/bloqueio própria — só o cadastro em si.
// Ver docs/maquininha-gpos780-levantamento-requisitos.md, seção Kiosk.
class AdminReceiver : DeviceAdminReceiver()
