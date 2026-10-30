# Bergtouren – Android-Grundgerüst

Dieses Android-Modul ist eine separate native Hülle für die vorhandene Bergtouren-PWA. Es wird auf dem Branch `feature/android-gallery-shell` entwickelt und verändert die bestehende PWA auf `main` nicht.

## Technischer Stand dieses Schritts

- Android Activity mit eingebettetem WebView
- Lädt die bestehende GitHub-Pages-Web-App unter `https://marceldahm85-collab.github.io/Tour/`
- HTTPS-only: HTTP-Inhalte und TLS-Zertifikatsfehler werden nicht akzeptiert
- Navigation innerhalb des App-Pfads bleibt im WebView; externe Ziele werden an Android übergeben
- Sichere native Nachrichten-Schnittstelle über AndroidX WebKit `WebViewCompat.addWebMessageListener`
- Bridge ist auf den Web-Ursprung der App beschränkt und akzeptiert derzeit ausschließlich einen unverbindlichen `bridge.ping`-Handshake
- Datei-Auswahl bleibt für die bestehende JSON-Sicherungs-/Importfunktion der PWA verfügbar
- Keine Galerie-, Kamera-, Standort- oder sonstigen Medienberechtigungen in diesem Schritt
- Keine Kopie oder Migration der Tourdaten in diesem Schritt

## Build-Umgebung

- Android Gradle Plugin 9.5.0
- Gradle Wrapper 9.6.0
- JDK 17 oder neuer
- Android SDK Platform 36
- AndroidX WebKit 1.18.0

## Projekt öffnen

1. Android Studio öffnen.
2. Den Ordner `android/` als Gradle-Projekt öffnen.
3. Gradle-Synchronisierung abwarten.
4. Ein Android-Gerät oder einen Emulator mit Android 8.0 (API 26) oder neuer verbinden.
5. Das Run-Ziel `app` auswählen.

## Wichtige Grenzen

- Die Android-WebView besitzt einen eigenen Web-Speicher. Sie greift nicht auf den IndexedDB-Speicher von Chrome zu. Der einmalige Import deiner vorhandenen JSON-Sicherung wird in einem eigenen späteren Schritt umgesetzt und geprüft.
- Der native Medienzugriff ist absichtlich noch nicht implementiert.
- Der App-Start lädt keine Galerieinhalte.
- Der Web-App-Endpunkt ist zentral in `app/build.gradle.kts` als `WEB_APP_URL` hinterlegt und kann dort angepasst werden, falls sich die GitHub-Pages-Adresse ändert.

## Noch nicht als produktionsfertig betrachten

Dies ist zunächst das Android-Grundgerüst. Vor einer Installation auf deinem S23 müssen Gradle-Synchronisierung, APK-Build, WebView-Start, Offline-Verhalten, Dateiauswahl/Backup-Import und der Bridge-Handshake auf einem realen Gerät geprüft werden.

## APK ohne lokale Installation bauen

Für diesen Branch ist ein Cloud-Build über GitHub Actions eingerichtet. Android Studio und das Android SDK müssen auf dem eigenen PC nicht installiert werden.

1. Im GitHub-Repository den Branch `feature/android-gallery-shell` öffnen.
2. Den Reiter **Actions** öffnen.
3. Den Workflow **Android APK (Debug)** auswählen.
4. Den neuesten erfolgreichen Lauf öffnen.
5. Unter **Artifacts** die Datei `bergtouren-debug-apk` herunterladen. Der Workflow lädt die APK als einzelne Datei und nicht als ZIP hoch.
6. Die APK auf dem Android-Gerät öffnen und die Installation bestätigen.

Der Workflow wird bei Änderungen an `android/**` auf diesem Branch automatisch gestartet. Er kann außerdem über **Run workflow** manuell gestartet werden. Das Artefakt bleibt 14 Tage verfügbar.

### Hinweis zur Debug-Version

Die Debug-APK ist nur für die ersten Geräte- und Funktionsprüfungen gedacht. Für spätere regelmäßige Updates wird ein eigener, dauerhaft geschützter Signaturschlüssel eingerichtet. Debug-Builds aus getrennten Cloud-Läufen können unterschiedliche Debug-Signaturen besitzen und lassen sich dann nicht als Update übereinander installieren; gegebenenfalls muss die vorherige Testversion deinstalliert werden.

### Wenn der Build fehlschlägt

Die APK wird nur bei erfolgreichem Build veröffentlicht. Bei einem Fehler im Workflow-Lauf zuerst den Abschnitt **Build debug APK** öffnen; dort steht die konkrete Gradle- oder Compilerfehlermeldung. Ein fehlgeschlagener Build ist kein Anlass, die PWA auf `main` zu ändern.
