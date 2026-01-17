# Add project specific ProGuard rules here.

# Keep Stripe classes
-keep class com.stripe.android.** { *; }
-keepclassmembers class com.stripe.android.** { *; }
-dontwarn com.stripe.android.**

# Keep Stripe PaymentIntent
-keep class com.stripe.android.model.PaymentIntent { *; }
-keep class com.stripe.android.model.PaymentMethod { *; }
-keep class com.stripe.android.model.Card { *; }

# Keep Stripe exceptions
-keep class com.stripe.android.exception.** { *; }

# Keep Flutter classes
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }
-keep class io.flutter.plugins.**  { *; }

# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Keep Google Sign-In
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Keep Google Play Core (for deferred components - optional Flutter feature)
-dontwarn com.google.android.play.core.splitcompat.SplitCompatApplication
-dontwarn com.google.android.play.core.splitinstall.SplitInstallException
-dontwarn com.google.android.play.core.splitinstall.SplitInstallManager
-dontwarn com.google.android.play.core.splitinstall.SplitInstallManagerFactory
-dontwarn com.google.android.play.core.splitinstall.SplitInstallRequest$Builder
-dontwarn com.google.android.play.core.splitinstall.SplitInstallRequest
-dontwarn com.google.android.play.core.splitinstall.SplitInstallSessionState
-dontwarn com.google.android.play.core.splitinstall.SplitInstallStateUpdatedListener
-dontwarn com.google.android.play.core.tasks.OnFailureListener
-dontwarn com.google.android.play.core.tasks.OnSuccessListener
-dontwarn com.google.android.play.core.tasks.Task

# Keep model classes (for JSON serialization)
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep annotation default values
-keepattributes AnnotationDefault

# Keep generic signatures
-keepattributes Signature
-keepattributes *Annotation*

# Keep line numbers for debugging
-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
