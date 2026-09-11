plugins {
    kotlin("jvm") version "2.0.21"
    kotlin("plugin.serialization") version "2.0.21"
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}

/**
 * The files the proof of concept runs are the app's own, compiled straight out of the
 * Android source tree — not copies. They are listed one by one so that this list doubles
 * as the claim being made: these are the parts of Unica that carry no Android types.
 */
val sharedWithApp = listOf(
    "it/passini/unica/data/Source.kt",
    "it/passini/unica/data/Model.kt",
    "it/passini/unica/data/Inbox.kt",
    "it/passini/unica/notif/NotificationRules.kt",
)

sourceSets.main {
    kotlin.srcDir("../app/src/main/java")
    kotlin.setIncludes(sharedWithApp + "it/passini/unica/poc/**")
}

application {
    mainClass.set("it.passini.unica.poc.PocKt")
}

tasks.withType<JavaExec>().configureEach {
    // The demo output is Italian and draws boxes. Java 19+ picks the stream encoding from
    // the locale, which is often POSIX on a build machine, so state it outright.
    defaultCharacterEncoding = "UTF-8"
    jvmArgs("-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8")
}
