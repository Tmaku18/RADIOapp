import java.util.Properties

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}
val hasReleaseSigning =
    keystoreProperties.getProperty("keyAlias")?.isNotBlank() == true &&
        keystoreProperties.getProperty("keyPassword")?.isNotBlank() == true &&
        keystoreProperties.getProperty("storeFile")?.isNotBlank() == true &&
        keystoreProperties.getProperty("storePassword")?.isNotBlank() == true

android {
    namespace = "com.radioapp.radio_app"
    compileSdk = maxOf(flutter.compileSdkVersion, 35)
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.radioapp.radio_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        // Google Play policy currently requires API 35+ for new submissions.
        targetSdk = maxOf(flutter.targetSdkVersion, 35)
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            val releaseSigning = signingConfigs.findByName("release")
            if (releaseSigning != null && hasReleaseSigning) {
                signingConfig = releaseSigning
            } else {
                // Keep project introspection and debug workflows working; release tasks are
                // blocked below unless proper signing is configured.
                signingConfig = signingConfigs.getByName("debug")
            }
            // Enable minification with ProGuard rules
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

flutter {
    source = "../.."
}

// Workaround: Flutter CLI expects APK at build/app/outputs/flutter-apk/ when using
// modern AGP DSL (pluginManagement). AGP writes to android/app/build/outputs/apk/
// instead. Copy so "flutter run" / "flutter build apk" can find the APK.
// See: https://github.com/flutter/flutter/issues/174620
val cliOutDir = rootDir.parentFile!!.resolve("build/app/outputs/flutter-apk")
tasks.register("syncFlutterApks") {
    doLast {
        cliOutDir.mkdirs()
        val apkDir = layout.buildDirectory.dir("outputs/apk").get().asFile
        if (apkDir.exists()) {
            apkDir.walk().filter { it.isFile && it.extension == "apk" }.forEach { apk ->
                apk.copyTo(cliOutDir.resolve(apk.name), overwrite = true)
            }
        }
    }
}
android.applicationVariants.all {
    val cap = name.replaceFirstChar { it.uppercase() }
    listOf("package$cap", "assemble$cap").forEach { taskName ->
        tasks.matching { it.name == taskName }.configureEach {
            finalizedBy(tasks.named("syncFlutterApks"))
        }
    }
}

gradle.taskGraph.whenReady {
    val isReleaseBuildRequested = allTasks.any { task ->
        val n = task.name
        (n.contains("Release", ignoreCase = true) &&
            (n.startsWith("bundle", ignoreCase = true) ||
                n.startsWith("assemble", ignoreCase = true) ||
                n.startsWith("package", ignoreCase = true)))
    }
    if (isReleaseBuildRequested && !hasReleaseSigning) {
        throw GradleException(
            "Missing Android release signing config. Create android/key.properties " +
                "and provide storeFile, storePassword, keyAlias, keyPassword.",
        )
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
