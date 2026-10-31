# Bergtouren – Android-App

Die Android-App ist eine native Hülle um dieselbe, zentral veröffentlichte Bergtouren-PWA. Die Oberfläche und die Editor-Funktionen werden unter der HTTPS-Adresse aus `WEB_APP_URL` geladen; native Android-Funktionen (unter anderem die Gerätegalerie) werden über eine auf den App-Ursprung beschränkte WebView-Bridge bereitgestellt.

## Aktueller Stand

- Die App lädt die PWA unter `https://marceldahm85-collab.github.io/Tour/`.
- Das Android-Launcher-Symbol verwendet dieselbe PNG-Grafik wie das PWA-Manifest (`icons/icon-512_neu.png`).
- Der Android-Anzeigename ist **Bergtouren**.
- Die Hauptansicht bleibt im Hochformat; der native Videoplayer darf sich bei Bedarf drehen.
- Die WebView aktiviert JavaScript und DOM-Speicher, erlaubt aber keine lokalen `file://`-Zugriffe. Ausgewählte Dateien werden über Android-Content-URIs gelesen.
- Der Theme-Editor unterstützt die gleichen Akzent-, Radius-, Schrift-, Verlaufs- und Haptik-Einstellungen wie die PWA. Die Android-App besitzt dafür die normale Vibrationsberechtigung.
- Hintergrundmotive und selbst ausgewählte Hintergrundbilder werden lokal in IndexedDB gespeichert. Eigene Bilder werden vor dem Speichern auf maximal 1920 Pixel und höchstens 15 MB optimiert.
- Die Galerie-Funktion liest Fotos und Videos nach ausdrücklicher Freigabe aus Android MediaStore. Originalmedien bleiben an ihrem bisherigen Speicherort.

## Daten und Editor-Einstellungen zwischen PWA und APK

Chrome-PWA und Android-WebView verwenden getrennte lokale Speicherbereiche. Einstellungen oder Daten werden deshalb nicht automatisch zwischen beiden Installationen geteilt.

Die JSON-Sicherung über **Sicherung → Daten herunterladen** enthält jetzt:
- gespeicherte und geplante Touren,
- die aktuelle vereinheitlichte Theme-Editor-Konfiguration (Akzentfarben, Radius, Schrift, Schriftgröße, Verlauf und Haptik),
- die Hintergrundbild-Auswahl samt Bildposition und Zoom,
- ein selbst ausgewähltes Hintergrundbild als optimierte Bilddatei.

Für die Übernahme des bestehenden PWA-Zustands:
1. In der PWA eine neue JSON-Sicherung erstellen, nachdem die aktuelle Pages-Version veröffentlicht wurde.
2. Diese JSON-Datei in der Android-App über **Sicherung → Daten importieren** auswählen.
3. Danach sind die übertragenen Tour-, Theme- und Hintergrundbild-Einstellungen in der APK verfügbar.

Gerätegebundene Galerie-URIs werden absichtlich nicht in JSON-Sicherungen übertragen. Die Fotos und Videos bleiben mit der lokalen Android-Galerie verknüpft und müssen bei einem Gerätewechsel neu zugeordnet werden.

## Android-Build

Der zentrale Workflow liegt unter `.github/workflows/android-debug-apk.yml` und baut ausschließlich von `main`. Er prüft den vorhandenen Signaturschlüssel, die JavaScript-Syntax der Android-Galerie- und Hintergrundbildmodule und erstellt die Debug-APK.

- APK-Artefakt: `bergtouren-gallerytest.apk`
- Debug-Paketkennung: `at.marcel.bergtouren.gallerytest`
- Anzeigename: `Bergtouren`
- Der etablierte Signaturschlüssel wird über den Main-Branch-Cache wiederverwendet. Bei einem Cache-Miss wird kein neuer Schlüssel erzeugt.
- Die APK ist ein Update der bisherigen Galerie-Test-App. Sie nicht deinstallieren, solange vorhandene lokale Tourdaten erhalten bleiben sollen.

## Build-Umgebung

- Android Gradle Plugin 9.5.0
- Gradle Wrapper 9.6.0
- JDK 17
- Android SDK Platform 36
- AndroidX WebKit 1.18.0

Das Android-Projekt liegt im Verzeichnis `android/`.
