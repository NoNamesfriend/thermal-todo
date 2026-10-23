# Icon-Vergleich am 24. Oktober 2026

Die Integration bietet GPT-4.1 mini, GPT-6 Luna, Jev (TypeSafe) und ausgeschaltete Icon-Erkennung. Die Auswahl wird pro Browser gespeichert. Die lokale Spracherkennung bleibt davon unabhängig.

## Live-Messung

Alle drei Anbieter wurden mit denselben 65 unveränderten synthetischen deutschen Aufgaben geprüft: 60 eindeutige und fünf mehrdeutige Fälle. Es gab einen Durchlauf pro Modell und keine Optimierung anhand der Ergebnisse. Die Zeiten umfassen den API-Aufruf einschließlich Netzwerk; Import- und Dateischreibzeiten sind nicht enthalten. Jev wurde nach Bereitstellung des Tokens separat ausgeführt, nicht zeitgleich mit den OpenAI-Läufen. Kleine Stichprobe, keine allgemeine Qualitätsaussage.

| Modell | Eindeutige richtig | Mehrdeutige akzeptiert | Median | p95 | Geschätzter Standardpreis des Durchlaufs |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-4.1 mini | 59/60 | 5/5 | 0,52 s | 1,03 s | 0,0083 USD |
| GPT-6 Luna | 59/60 | 5/5 | 0,95 s | 1,38 s | 0,0023 USD |
| Jev 1.14.0 (TypeSafe) | 56/60 | 5/5 | 0,16 s | 0,22 s | nicht bestimmt |

Alle 195 Anfragen waren erfolgreich; kein Timeout, Authentifizierungsfehler oder anderer API-Fehler. TypeSafe beantwortete den Jev-Lauf mit `jev-1.14.0`. Gemeldete Nutzung für die 65 Jev-Anfragen: 43.154 Input-Tokens und 10.339 Output-Tokens. Aus diesen Nutzungszahlen allein wird kein Rechnungsbetrag abgeleitet; der konkrete TypeSafe-Tarif wurde nicht geprüft. Der Token wurde weder ausgegeben noch in den Ergebnissen gespeichert.

**Einordnung:** GPT-4.1 mini liefert in diesem Testsatz bei gleicher Trefferquote niedrigere Latenz als Luna. Luna hat günstigere Standard-Tokenpreise. Jev ist am schnellsten: rund ein Drittel der Medianlatenz von GPT-4.1 mini, bei drei zusätzlich abweichenden eindeutigen Zuordnungen. Für eine höhere Übereinstimmung mit den vorgegebenen Soll-Labels bleibt GPT-4.1 mini die Empfehlung aus diesem Test; Jev eignet sich als bewusst gewählte schnellere Option.

**Getroffene Entscheidung:** Auf Nutzerwunsch ist Jev der Standard für die Icon-Erkennung, sobald `JEV_API_KEY` gesetzt ist; auch bei gleichzeitig vorhandenem OpenAI-Key. Lokales Whisper base ist im Docker-Image der Standard für Spracheingaben. Gespeicherte Browser-Auswahlen bleiben erhalten. Ohne Jev-Token wird bei vorhandenem OpenAI-Key GPT-4.1 mini voreingestellt, andernfalls ist die Icon-Erkennung aus. Fehlgeschlagene Anfragen wechseln weiterhin nicht den Anbieter.

## Abweichungen von den erwarteten Labels

| Aufgabe | Erwartet | GPT-4.1 mini | GPT-6 Luna | Jev |
| --- | --- | --- | --- | --- |
| Die Aufgabenliste für morgen ordnen | checklist | checklist | checklist | priority |
| Den Tagesablauf organisieren | checklist | checklist | checklist | calendar |
| Die Software auf die neue Version aktualisieren | code | maintenance | code | maintenance |
| Das später noch klären | other | other | checklist | checklist |

Einige Abweichungen sind fachlich plausible Alternativen: Ein Software-Update kann auch als Wartung verstanden werden, die Organisation des Tagesablaufs auch als Kalenderaufgabe. Die bestehenden Soll-Labels wurden für den Vergleich trotzdem unverändert beibehalten. Die vier Jev-Abweichungen umfassen die beiden verschiedenen Abweichungen der OpenAI-Modelle und zwei zusätzliche Fälle.

[Gesammelte Rohdaten, Modellversionen und Tokenzahlen](icon-comparison.json), [separater Jev-Lauf](icon-comparison-jev.json). Die OpenAI-Kosten sind Rechenwerte aus den gemeldeten Input-/Output-Tokens und den [GPT-4.1-mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)- und [GPT-6-Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)-Standardpreisen; keine Abrechnungsbestätigung und ohne Cache-, Regional- oder Tier-Anpassungen.

## Einrichtung

Für Vergleichstests `JEV_API_KEY=...` in `D:\Development\thermal-todo\.env` eintragen. Diese Datei wird weder eingecheckt noch ins Docker-Image kopiert. `OPENAI_API_KEY` wird für beide GPT-Modelle verwendet. Bei doppelten Werten hat `service/.env` Vorrang vor der Root-Datei; bestehende Prozessvariablen haben Vorrang vor beiden.

Auf Unraid die Container-Umgebungsvariable `JEV_API_KEY` setzen und die Änderung anwenden. Compose leitet denselben Wert aus seiner `.env` weiter. Optional kann `JEV_MODEL` auf eine in TypeSafe verfügbare Version gesetzt werden; Standard ist `jev-latest`. Der Token gehört nur in die Laufzeitkonfiguration.

Verwendeter Jev-Vertrag: [TypeSafe OpenAPI](https://api.typesafe.ai/openapi.json), `POST /v1/systemone`, Bearer-Authentifizierung, eine `choice`-Frage mit den vorhandenen 20 Kategorien. Ohne erfolgreichen Key-/Guthaben-/Modellzugriff meldet die App einen Fehler und wechselt nicht automatisch zu einem anderen Anbieter.

## Validierung und Stand

23 automatisierte Tests bestanden beim Einbau. Docker-Build sowie Dialog auf Desktop und bei 390 Pixeln waren geprüft. Anschließend wurden alle drei Anbieter live mit demselben Testsatz geprüft; die Zuordnung der Jev-Testfälle zu den unveränderten OpenAI-Baselines wurde nochmals verifiziert. Der Vergleich selbst führte keinen Registry-Push und keinen produktiven Rollout aus. Der anschließende Push mit den gewählten Standards startet den regulären GitHub-Workflow für das vollständige Docker-Image.
