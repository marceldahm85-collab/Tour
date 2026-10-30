# Bergtouren – Android-Grundgerüst

Dieses Android-Modul ist eine separate native Hülle für die vorhandene Bergtouren-PWA. Es wird auf dem Branch `feature/android-gallery-shell` entwickelt und verändert die bestehende PWA auf `main` nicht.

## Technischer Stand

- Android Activity mit eingebettetem WebView; die bestehende GitHub-Pages-App wird unter HTTPS geladen.
- Sichere native Nachrichten-Schnittstelle über AndroidX WebKit `WebViewCompat.addWebMessageListener`, auf den exakten HTTPS-Ursprung und den Hauptframe beschränkt.
- Fotozugriff wird erst nach einer ausdrücklichen Aktion in der Tourdetailansicht angefragt. Android 14 und neuer: vollständiger und eingeschränkter Fotozugriff werden unterschieden.
- Die Galerie wird pro gespeicherter Tour-Etappe anhand des lokalen Tourdatums abgefragt. Es gibt keinen Galerie-Scan beim App-Start.
- Vorschaubilder werden bei Bedarf verkleinert und erst geladen, wenn die jeweilige Kachel in die Nähe des sichtbaren Bereichs kommt.
- Gespeichert werden nur MediaStore-URIs und leichte Metadaten. Die Originalfotos bleiben in Samsung Galerie/Kamera und werden weder kopiert noch verändert.
- Bereits zugeordnete Fotos bleiben auch bei später nicht mehr verfügbaren Referenzen in der Auswahl sichtbar und können entfernt werden.
- Die bestehende einzelne Tour-Titelbildfunktion bleibt unverändert.
- Gerätegebundene Galerie-URIs werden nicht in JSON-Sicherungen exportiert; nach einem Gerätewechsel müssen Fotos neu zugeordnet werden.
- Ohne native Android-Bridge wird die Galerieoberfläche in der normalen Browser-PWA nicht aktiviert.
- Die Datei-Auswahl für JSON-Import und -Export bleibt verfügbar.

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

- Die Android-WebView besitzt einen eigenen Web-Speicher und greift nicht auf den IndexedDB-Speicher von Chrome zu. Der einmalige JSON-Import wurde auf dem Galaxy S23 erfolgreich durchgeführt.
- Die Galerie-URIs sind an das jeweilige Android-Gerät und dessen MediaStore gebunden. Sie sind keine portablen Bilddateien und werden deshalb nicht mit der JSON-Sicherung übertragen.
- Wird ein Foto gelöscht, verschoben, ersetzt oder der Galerie-Zugriff entzogen, kann eine gespeicherte Referenz unbrauchbar werden. Die App zeigt dann keine Vorschau an; die Zuordnung kann entfernt und das Foto bei Bedarf neu gesucht werden.
- Der Web-App-Endpunkt ist zentral in `app/build.gradle.kts` als `WEB_APP_URL` hinterlegt.

## Noch nicht als produktionsfertig betrachten

Der Android-Shell-Start und der JSON-Import sind auf dem Galaxy S23 bereits geprüft. Der Galerie-Code wurde erfolgreich im Cloud-Build kompiliert und der JavaScript-Syntaxcheck ist erfolgreich. Die neue Galerieoberfläche, Berechtigungsdialoge, Fotoabfrage und Thumbnail-Anzeige müssen jetzt noch auf dem S23 praktisch getestet werden.

## APK ohne lokale Installation bauen

Der Cloud-Build läuft über GitHub Actions; Android Studio und das Android SDK müssen auf dem PC nicht installiert werden.

1. Im GitHub-Repository den Branch `feature/android-gallery-shell` öffnen.
2. Den Reiter **Actions** öffnen.
3. Den Workflow **Android APK (Debug)** auswählen.
4. Den neuesten erfolgreichen Lauf öffnen.
5. Unter **Artifacts** die einzelne Datei `bergtouren-gallerytest.apk` herunterladen. Sie wird direkt als APK und nicht als ZIP bereitgestellt.
6. Die APK auf dem Android-Gerät öffnen und die Installation bestätigen.

Die Galerie-Test-App verwendet die eigene Paketkennung `at.marcel.bergtouren.gallerytest` und den App-Namen **Bergtouren Fototest**. Sie kann deshalb parallel zur zuvor installierten Android-Shell installiert werden. Der lokale Web-Speicher ist dadurch ebenfalls getrennt: Die Tourdaten müssen einmalig erneut aus einer JSON-Sicherung importiert werden. Die bisherige App und ihre Daten bitte bis zum erfolgreichen Abschluss der Tests nicht deinstallieren.

Der Workflow wird bei Änderungen an `android/**` oder der Workflow-Datei auf dem Branch gestartet. Er kann außerdem über **Run workflow** manuell gestartet werden. Das Artefakt bleibt 14 Tage verfügbar.

### Hinweis zur Debug-Version

Die Debug-APK ist nur für die ersten Geräte- und Funktionsprüfungen gedacht. Für spätere regelmäßige Updates wird ein eigener, dauerhaft geschützter Signaturschlüssel eingerichtet. Debug-Builds aus getrennten Cloud-Läufen können unterschiedliche Debug-Signaturen besitzen und lassen sich dann nicht als Update übereinander installieren; gegebenenfalls muss die vorherige Testversion deinstalliert werden.

### Wenn der Build fehlschlägt

Die APK wird nur bei erfolgreichem Build veröffentlicht. Bei einem Fehler im Workflow-Lauf zuerst den Abschnitt **Build debug APK** öffnen; dort steht die konkrete Gradle- oder Compilerfehlermeldung. Ein fehlgeschlagener Build ist kein Anlass, die PWA auf `main` zu ändern.
