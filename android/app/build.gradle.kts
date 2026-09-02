plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.tipo7.caixa"
    compileSdk = 34

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

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        buildConfig = true
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
}
