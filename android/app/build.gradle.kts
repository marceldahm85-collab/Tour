plugins {
    id("com.android.application")
}

android {
    namespace = "at.marcel.bergtouren"
    compileSdk = 36

    defaultConfig {
        applicationId = "at.marcel.bergtouren"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField(
            "String",
            "WEB_APP_URL",
            "\"https://marceldahm85-collab.github.io/Tour/\""
        )
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
}
