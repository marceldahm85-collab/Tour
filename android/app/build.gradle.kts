plugins {
    id("com.android.application")
}

val releaseKeystorePath = providers.environmentVariable("ANDROID_RELEASE_KEYSTORE_PATH").orNull
val releaseStorePassword = providers.environmentVariable("ANDROID_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ANDROID_RELEASE_KEY_ALIAS").orNull

android {
    namespace = "at.marcel.bergtouren"
    compileSdk = 36
    defaultConfig {
        applicationId = "at.marcel.bergtouren"
        minSdk = 26
        targetSdk = 35
        versionCode = 15
        versionName = "0.7.0"
        buildConfigField(
            "String",
            "WEB_APP_URL",
            "\"https://marceldahm85-collab.github.io/Tour/\""
        )
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    signingConfigs {
        create("release") {
            if (!releaseKeystorePath.isNullOrBlank()
                && !releaseStorePassword.isNullOrBlank()
                && !releaseKeyAlias.isNullOrBlank()
            ) {
                storeFile = file(releaseKeystorePath)
                storeType = "PKCS12"
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseStorePassword
            }
        }
    }
    buildTypes {
        debug {
            applicationIdSuffix = ".gallerytest"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = false
            isDebuggable = false
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
}
