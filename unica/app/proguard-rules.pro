# kotlinx.serialization keeps the generated serializers of @Serializable classes.
-keepclassmembers class it.passini.unica.data.** {
    *** Companion;
}
-keepclasseswithmembers class it.passini.unica.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
