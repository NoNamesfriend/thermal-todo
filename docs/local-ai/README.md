# Lokale KI: Messung auf Unraid

Gemessen am 23./24. Oktober 2026 auf dem tatsächlichen Unraid-Server. Die laufende Thermal-ToDo-Anwendung auf Unraid wurde dafür nicht umgestellt. Die danach im Repository eingebaute lokale Erkennung ist noch nicht veröffentlicht. Der Test lief direkt per SSH mit temporären Containern; der normale Releaseweg über GitHub Container Registry bleibt bestehen.

## Julia 1 für die Symbolauswahl

**Julia 1 eignet sich im getesteten Zustand nicht als direkter Ersatz für die bisherige Symbolauswahl.** Es erkennt 33 von 60 eindeutigen deutschen Aufgaben richtig (55 %). Das ist ein kleiner, handgeschriebener Testsatz und keine allgemeine Modellbewertung. Die Kategorien und ihre deutschen Beschreibungen entsprechen unverändert `service/icons.js`; die feste Klassifikationsfrage lautet `Which category best describes this task?`. Es gab kein Nachtrainieren oder Anpassen anhand der Ergebnisse.

| Messwert | Ergebnis auf Unraid |
| --- | ---: |
| Eindeutige Aufgaben richtig | 33 / 60 |
| Zusätzliche mehrdeutige Aufgaben | 5, separat erfasst |
| Laden einschließlich Python-/Torch-Imports | 9,55 s |
| Erster Aufruf nach dem Laden | 0,52 s |
| Prozessstart bis erstes Ergebnis | 10,07 s |
| Weitere Aufrufe: Median / p95 / Maximum | 0,151 / 0,182 / 0,233 s |
| Prozess-RAM nach den Aufrufen | 942,6 MiB |
| Beobachtete RSS-Spitze, Abtastung alle 10 ms | 948,9 MiB |
| CPU-Verbrauch über 3 s Leerlauf | 0,02 CPU-s |

Ein konkreter Fehler: `Milch einkaufen` erhält `work` mit einer ausgegebenen Wahrscheinlichkeit von etwa 82 %. Auch deshalb wäre ein automatischer Fallback allein anhand der Modellwahrscheinlichkeit unzuverlässig. Bei ständig geladenem Modell ist die Rechenzeit kurz; Laden bei Bedarf verfehlt bereits ohne Spracherkennung die Fünf-Sekunden-Grenze. Ein dauerhaft belegtes knappes GiB lässt sich durch dieses Ergebnis nicht rechtfertigen.

Die gleiche unveränderte Klassifikation lieferte unter Windows und Docker Desktop ebenfalls 33/60. Die dortigen Ladezeiten und RAM-Werte sind Zusatzmessungen und werden nicht auf Unraid übertragen. Rohdaten: [Unraid](julia-unraid-2threads.json), [Windows](julia-windows-2threads.json), [Docker Desktop](julia-linux-2threads.json).

## Lokale Spracherkennung

**Lokale Erkennung ist innerhalb des Zeitbudgets machbar.** `whisper.cpp base Q5_1` benötigt im getesteten Betrieb bei Bedarf höchstens **3,18 s**, einschließlich Containerstart, Modellladen und Audiobereinigung. Dabei sind kurzzeitig höchstens **335 MiB Container-RAM einschließlich Dateicache** gemessen. Nach jeder Erkennung endet der Container; es bleibt kein Modellprozess im RAM.

Das unquantisierte `base` erkennt die drei echten Sprachbeispiele besser und benötigt geladen nur etwa 256 MiB Prozess-RAM. Deshalb verwendet die anschließende Integration das unquantisierte `base`; Q5 bleibt ein getesteter Vergleichskandidat. Der Kaltstart des unquantisierten `base` wurde am 24. Oktober zusätzlich auf Unraid gemessen: höchstens **3,47 s** einschließlich Start und Audiobereinigung, maximal **428 MiB Container-RAM einschließlich Cache**. Die neun Messfälle stehen in [whisper-base-cold-unraid.json](whisper-base-cold-unraid.json), die [Rohdaten](whisper-base-cold-raw.tar.gz) sind gesichert. Die RAM-Ersparnis von Q5 gegenüber `base` beträgt beim geladenen Prozess etwa 85 MiB und ist bei Betrieb nur während einer Aufnahme weniger entscheidend.

| Modell | Geladen: Median / Maximum nach Aufnahmeende | Prozess-RSS nach den echten Aufnahmen | Strenge Wortfehler auf 3 echten Aufnahmen, je 2 Läufe |
| --- | ---: | ---: | ---: |
| tiny | 1,16 / 1,76 s | 167 MiB | 32 / 108 Wörter (29,6 %) |
| base | 2,33 / 2,67 s | 256 MiB | 12 / 108 Wörter (11,1 %) |
| base Q5_1 | 2,07 / 2,29 s | 171 MiB | 22 / 108 Wörter (20,4 %) |
| small Q5_1 | 6,77 / 7,31 s | 361 MiB | 6 / 108 Wörter (5,6 %) |

Die Laufzeiten der Tabelle umfassen alle gesprochenen Testfälle; Stille ist vom Median ausgenommen. RAM bezeichnet den Serverprozess nach der letzten Messreihe, **keinen vollständigen Containerhöchstwert**. Die Container-Spitzen dieser letzten Messreihe einschließlich freigebbarem Dateicache lagen bei rund 484 / 592 / 452 / 707 MiB in derselben Modellreihenfolge. Die anfängliche synthetische tiny-Reihe erreichte wegen zusätzlich zugerechnetem Dateicache etwa 747 MiB. Ein festes RAM-Limit allein aus dem Prozess-RSS wäre deshalb falsch bemessen.

| Betrieb bei Bedarf | Neue Container pro Aufnahme | Längste Messung | Höchster gemessener Container-RAM |
| --- | ---: | ---: | ---: |
| tiny | 9 | 2,21 s | 379 MiB |
| base Q5_1 | 9 | 3,18 s | 335 MiB |
| base | 9 | 3,47 s | 428 MiB |

Dieser zusätzliche Test enthält kurze Aufgaben, die knapp zehn Sekunden lange Aufgabe, die verrauschte Aufnahme, Stille und die drei echten Aufnahmen. Stille erzeugt bei allen Modellen einen leeren Text und beim Betrieb bei Bedarf gar keinen Modellaufruf. Die größte Q5-Startmessung lässt etwa 1,8 s Reserve bis zur Fünf-Sekunden-Grenze; zusätzliche Serverlast kann diese Reserve aufbrauchen.

`small Q5_1` liefert hier die saubersten Texte, ist mit zwei CPU-Threads aber zu langsam. `tiny` ist schnell, macht bei den echten Aufnahmen deutlich mehr Wortfehler. Bei `base` und Q5 sind Namen und einzelne Wörter weiterhin zu kontrollieren: Beispielsweise wird `Anna wegen` zu `anerwegen`, Q5 macht aus `Wildtiere dienten` teilweise `Wild hier redienten`. Die kleine Stichprobe rechtfertigt noch keinen automatischen Wechsel ohne Test mit dem tatsächlich verwendeten Mikrofon.

**Umgesetzte Architektur:** Das Anwendungsimage enthält das gepinnte whisper.cpp-Binary und das geprüfte base-Modell. Whisper läuft als lokal gestarteter Prozess für genau eine Aufnahme und endet danach; maximal eine Erkennung gleichzeitig, zwei CPU-Threads, begrenzte Eingabelänge und klarer Fehlerzustand bei Überschreitung. Über den Einstellungsdialog wird pro Browser zwischen lokaler Erkennung und OpenAI Whisper gewählt; OpenAI ist nur mit serverseitig hinterlegtem API-Key verfügbar. Auch eine vorübergehend nicht verfügbare gespeicherte Auswahl löst keinen stillen Wechsel zu OpenAI aus. Dafür ist weder ein dauerhaft laufender Python-/LLM-Server noch eine dauerhafte Reservierung von 3 GiB erforderlich. Die Gewichte liegen auf dem Datenträger; der Betrieb selbst benötigt keine Inferenz-API. Julia sollte zunächst nicht eingebaut werden. Für die Symbolauswahl bleibt der bisherige Anbieter aktiv, bis ein eigener, geprüfter Klassifikator oder eine ausreichend gute Alternative vorliegt.

Alle [Messwerte und Transkripte](whisper-unraid-summary.json) sowie die [unveränderten Unraid-Rohdaten](unraid-raw-results.tar.gz) sind abgelegt. Die temporären Testcontainer wurden automatisch entfernt. Das eigens angelegte Benchmark-Verzeichnis auf Unraid wurde nach gesicherter Ausgabe der Rohdaten entfernt; rund 3,77 GiB RAM waren anschließend laut `MemAvailable` verfügbar. Heruntergeladene Docker-Basisimages bleiben im Imagecache auf dem Datenträger; sie reservieren keinen Modell-RAM. Der produktive Dienst und sein veröffentlichtes Image wurden nicht geändert. Die Integration ist im lokalen Repository umgesetzt.

## Testbedingungen und Aussagegrenzen

- Ziel-CPU: AMD Ryzen 5 PRO 4650G, 6 Kerne / 12 Threads. Die Container hatten jeweils zwei CPU-Kerne als Rechenzeitlimit und die Modelle zwei Threads. Keine GPU, keine veröffentlichten Ports, Inferenzcontainer ohne Netzwerk.
- Julia: Container-RAM-Limit 1280 MiB. Whisper: 1024 MiB. Der Kernel meldet keine Unterstützung für ein zusätzliches Swap-Limit; daraus wird keine Garantie eines harten Gesamtlimits einschließlich Swap abgeleitet.
- Der Nutzer nennt 16 GiB physischen RAM. Linux meldet etwa 11,49 GiB nutzbaren RAM, im gesicherten Ausgangssnapshot etwa 3,87 GiB verfügbar. Die Ursache dieser Differenz wurde nicht untersucht.
- Julia: FP32-Safetensors, PyTorch-CPU-Backend, strikte Kodierung ohne stilles Abschneiden, maximal 1024 Tokens. Eine Aufgabe pro Aufruf; p95 verwendet den Index `floor(n × 0,95)` im nullbasiert sortierten Testsatz. Gewichte und Revisionen stehen in [models.json](models.json).
- Sprache: neun synthetische deutsche SAPI-Aufnahmen zwischen 2,54 und 10 Sekunden, zusätzlich ein Beispiel mit weißem Rauschen und drei Sekunden Stille. Drei echte vorgelesene deutsche Aufnahmen aus [Google FLEURS](https://huggingface.co/datasets/google/fleurs), `de_de/test`, ergänzen die Prüfung (7,14–9,9 s, CC BY 4.0). IDs, Referenztexte und Audio-Prüfsummen stehen in `scripts/local-ai/human-speech.de.json`.
- Browserähnliche Eingabe: WebM/Opus, mono, 48 kHz. Die gleiche Stilleentfernung und Lautheitsanpassung wie im Dienst ist enthalten; für Whisper wird anschließend PCM-WAV mit 16 kHz erzeugt. Sprache fest auf Deutsch, Beam-Size und Best-of jeweils 1. Andere Decoder-Einstellungen können Qualität und Laufzeit ändern.
- Die Laufzeit beginnt vor FFmpeg und endet nach der Erkennung; Docker-Exec-Aufwand ist enthalten. Browser-Upload, Proxy, Antwortdarstellung und Symbolauswahl sind nicht enthalten. Ein kompletter UI-Durchlauf ist damit noch nicht nachgewiesen.
- Zwei Durchläufe je Aufnahme und Modell. Dies ist ein Machbarkeitstest unter der beobachteten Serverlast, keine Zusage für gleichzeitige Jobs oder starke Last anderer Dienste. Für den Produktbetrieb wäre eine Warteschlange mit höchstens einer parallelen Erkennung sinnvoll.
- Wortfehlerrate: Kleinschreibung, Satzzeichen entfernt, sonst keine Korrektur von Zahlen oder Wortformen. Der dritte FLEURS-Referenztext enthält am Ende ein `.x`; dieses Quellartefakt bleibt im Rohtext und in der strengen Wortzählung sichtbar. Die wenigen Beispiele erlauben keine allgemeine Genauigkeitsangabe für frei gesprochene Aufgaben, Dialekte oder andere Mikrofone.
- „Kaltstart“ bedeutet neuer Prozess beziehungsweise neuer Container. Der Linux-Dateicache wurde nicht geleert. Dieser Cache kann RAM verwenden, ist aber freigebbar und keine dauerhafte Modellreservierung.

## Integration und Icon-Modellwahl am 24. Oktober 2026

Im vollständigen Docker-Image wurde die lokale HTTP-Route zusätzlich auf Docker Desktop geprüft: sieben unterschiedliche Aufnahmen einschließlich Stille, maximal 2,95 s unter den dortigen Testbedingungen. Zwei gleichzeitige Anfragen ergaben wie vorgesehen einen Erfolg und einmal HTTP 429. Anschließend waren kein Whisper-Prozess und keine temporären Audioordner mehr vorhanden. Das ist ein Integrationstest auf dem Ryzen 7 3700X; die separate Kaltstartmessung auf Unraid bleibt der Beleg für die Zielhardware. Ergebnisse: [integration-docker-desktop.json](integration-docker-desktop.json).

Der Einstellungsdialog wurde auf Desktop und bei 390 Pixeln geprüft: lokale Erkennung ohne Key, deaktivierte OpenAI-Option ohne Key, Anbieterwechsel mit Platzhalter-Key, Speichern über Neuladen hinweg, Escape und Fokus zurück zur Einstellungsschaltfläche. Dabei wurde kein OpenAI-Aufruf ausgeführt. Die 16 Anwendungstests bestehen, einschließlich Zeitlimit, Single-Flight-Sperre und Dateibereinigung. Die Modellgewichte werden beim Image-Build anhand SHA-256 geprüft. Lokale `.env`-Dateien werden im Docker-Kontext auch in Unterordnern ausgeschlossen; der Service kopiert außerdem ausdrücklich nur seine JavaScript-Quelldateien. Das behebt einen beim lokalen Build tatsächlich gefundenen Einschluss von `service/.env`. Kein Testimage wurde veröffentlicht.

Inzwischen sind GPT-4.1 mini, GPT-6 Luna mit `reasoning_effort: none` und Jev (TypeSafe) auswählbar. Die [erste Live-Vergleichsmessung und Einrichtung](icon-providers.md) ergänzt die ursprüngliche Auswahlbewertung. Die offizielle Dokumentation beschreibt es für fokussierte Aufgaben mit hohem Volumen und unterstützt Structured Outputs. Die erste Live-Messung zeigt dieselbe Trefferquote für beide OpenAI-Modelle und eine höhere Latenz bei Luna. Die Stichprobe erlaubt keine allgemeine Qualitätsaussage.

| Modell | Standard-Input / 1 Mio. Tokens | Standard-Output / 1 Mio. Tokens |
| --- | ---: | ---: |
| [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) | 0,40 USD | 1,60 USD |
| [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) | 0,10 USD | 0,50 USD |

Preise aus der offiziellen Modelldokumentation, Stand 24. Oktober 2026; ohne Cache-, Batch-, Regional- oder Fast-Zuschläge. Der anschließende [Live-Vergleich aller drei Anbieter](icon-providers.md) belegt den Zugriff mit den bereitgestellten API-Konten. Auf Nutzerwunsch ist Jev bei gesetztem TypeSafe-Token der Standard für Icons; lokales Whisper base ist der Standard für Spracheingaben im Docker-Image. Die Auswahl kann im Einstellungsdialog geändert werden.

## Wiederholung der Messung

Testwerkzeuge liegen unter `scripts/local-ai/`; sie ändern keinen Anbieter im Produktivdienst. Die Modellquellen sind [Julia 1](https://huggingface.co/SupersonicLabs/Julia-1) und [whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp). Verwende die Revisionen und SHA-256-Werte aus `models.json`, keine veränderlichen `main`-Downloads für Vergleichsmessungen.

Für Julia benötigt die isolierte Python-3.12-Umgebung `torch==2.14.1+cpu` aus dem offiziellen CPU-Wheel-Index sowie `transformers==5.0.0`, `safetensors==0.8.0`, `numpy==2.3.5` und `psutil==7.2.2`. Alternativ baut `scripts/local-ai/Dockerfile.julia` diese Testumgebung. Lade den offiziellen Modellordner einschließlich seiner Python-Dateien, Konfigurationen und Safetensors-Gewichte in einen separaten Cache. Dann:

```bash
python scripts/local-ai/benchmark_julia.py \
  --model .cache/local-ai/Julia-1 \
  --output docs/local-ai/julia-unraid-2threads.json --threads 2
```

Für Whisper muss ein separates Testverzeichnis die Ordner `audio/` und `whisper-models/` enthalten. Darin liegen die WebM-Dateien mit den IDs der Sprach-Manifeste sowie `ggml-tiny.bin`, `ggml-base.bin`, `ggml-base-q5_1.bin` und `ggml-small-q5_1.bin`. Unter Windows erstellt `make-speech-fixtures.ps1` mit Microsoft Hedda Desktop und FFmpeg die synthetischen Aufnahmen. Die echten Aufnahmen müssen passend zu den gespeicherten FLEURS-IDs und Audio-Prüfsummen geladen und als WebM/Opus konvertiert werden.

Auf dem Linux-Testhost das in `models.json` gepinnte Docker-Image vorher laden, beide Shell-Skripte mit LF-Zeilenenden übertragen und anschließend ausführen:

```bash
bash scripts/local-ai/benchmark_whisper.sh /absoluter/pfad/zum/testverzeichnis
BENCHMARK_FIXTURES='human-1 human-2 human-3' \
  bash scripts/local-ai/benchmark_whisper.sh /absoluter/pfad/zum/testverzeichnis
bash scripts/local-ai/benchmark_whisper_cold.sh /absoluter/pfad/zum/testverzeichnis
BENCHMARK_FIXTURES='human-1 human-2 human-3' \
  bash scripts/local-ai/benchmark_whisper_cold.sh /absoluter/pfad/zum/testverzeichnis
python scripts/local-ai/analyze_whisper.py \
  --results /absoluter/pfad/zum/testverzeichnis --output whisper-summary.json
```

Die Skripte verweigern den Start, wenn ihr benannter Testcontainer bereits existiert, und entfernen ihre Container am Ende. Für einen neuen vollständigen Messlauf ein frisches Ergebnisverzeichnis verwenden: Die CSV-Dateien werden absichtlich ergänzt, damit zusätzliche Aufnahmen derselben Messung erhalten bleiben. Das Testverzeichnis mit Modellen und Audiodateien nach dem Sichern der Ergebnisse gezielt entfernen; kein globales Docker-Prune verwenden.
