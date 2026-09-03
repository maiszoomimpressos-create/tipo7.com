plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.tipo7.caixa"
    compileSdk = 34

    // Keystore de desenvolvedor da Gertec (achado em INFOGedi_780.rar,
    // portal deles) — a GPOS780 física bloqueia instalação de qualquer app
    // não assinado por um certificado na whitelist dela
    // (INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES, mesmo em app nosso
    // limpo — ver docs/maquininha-gpos780-levantamento-requisitos.md,
    // "Investigação a fundo do bloqueio de instalação"). Confirmado nessa
    // mesma investigação: um app de exemplo deles assinado com esse
    // keystore instala normalmente no aparelho físico.
    // Condicional: se o arquivo não existir (outro dev, CI, etc.), builda
    // com o keystore padrão de debug do Android — funciona em
    // emulador/testes de layout, só não instala na GPOS780 física.
    val gertecKeystore = file("../keystore/Development_GertecDeveloper_EnhancedAPP.jks")
    val temKeystoreGertec = gertecKeystore.exists()

    defaultConfig {
        applicationId = "br.com.tipo7.caixa"
        // GPOS780 roda Android 11 (API 30) — minSdk não pode passar disso.
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        val baseUrlDebug = (project.findProperty("TIPO7_BASE_URL_DEBUG") as String?) ?: "http://10.0.2.2:3000"
        val baseUrlRelease = (project.findProperty("TIPO7_BASE_URL_RELEASE") as String?) ?: ""
        buildConfigField("String", "BASE_URL_DEBUG", "\"$baseUrlDebug\"")
        buildConfigField("String", "BASE_URL_RELEASE", "\"$baseUrlRelease\"")
    }

    signingConfigs {
        if (temKeystoreGertec) {
            create("gertecDev") {
                storeFile = gertecKeystore
                storePassword = "Development@GertecDeveloper2018"
                keyAlias = "developmentgertecdeveloper_enhancedapp"
                keyPassword = "Development@GertecDeveloper2018"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (temKeystoreGertec) signingConfig = signingConfigs.getByName("gertecDev")
        }
        debug {
            if (temKeystoreGertec) signingConfig = signingConfigs.getByName("gertecDev")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    // GANDI e GEDI embutem a mesma pasta fonte "aidl/" inteira por baixo
    // (achado já registrado no levantamento: as duas rodam sobre a mesma
    // plataforma WangPOS/Weipass/Wiseasy — não é só o .aidl, tem .java
    // duplicado lá dentro também) — conflito de merge sem isso. Não afeta
    // nada em runtime (é fonte auxiliar de compilação, não código do nosso
    // app), então "pickFirst" pra pasta inteira resolve sem risco.
    packaging {
        resources {
            // "aidl/**" sozinho não bastou — a mesma pasta fonte reaparece
            // duplicada em mais de um caminho dentro dos dois .aar
            // (aidl/wangpos/... E wangpos/... direto, por exemplo). Em vez
            // de continuar caçando path por path, libera geral: os dois
            // .aar são da mesma origem (WangPOS/Weipass), duplicar recurso
            // aqui é sempre "mesmo conteúdo, dois lugares", nunca conflito
            // de verdade.
            pickFirsts += "**"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    // Chamada HTTP da ponte JS↔Android pro backend (POST /api/pagamentos-fisicos/cobrar).
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    // GANDI (config/gerenciamento do aparelho GPOS780) — baixada do portal
    // Gertec (SDK 988B.zip), copiada em app/libs/. Usada pra tentar
    // CanInstallUnknownAppsEnabled/EnableDebugInstallMode (ver GandiHelper.kt
    // e docs/maquininha-gpos780-levantamento-requisitos.md, seção
    // "Investigação a fundo do bloqueio de instalação").
    implementation(files("libs/libgandi-2.1.19-668c185a-gpos780Neo-payment-release.aar"))
    // GEDI (periféricos do aparelho — impressora térmica embutida, NFC,
    // câmera). Mesma origem da GANDI (SDK 988B.zip / portal Gertec). Só
    // adicionada como dependência por enquanto — nenhum código chamando ela
    // ainda; é pra quando entrarmos na Fase de impressão de ticket na
    // GPOS780 (ver docs/maquininha-gpos780-levantamento-requisitos.md).
    implementation(files("libs/libgedi-2.2.6-b801c08-gpos780Neo-payment-release.aar"))
}
