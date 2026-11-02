# Haushaltsbudget-App – Originale Anforderungen

> Dies ist die ursprüngliche Aufgabenstellung aus dem Chat vom 02.11.2026,
> unverändert übernommen, damit sie jederzeit (z. B. am PC zuhause über GitHub)
> nachgelesen werden kann. Architektur und Plan: siehe
> [`01-architektur-und-plan.md`](./01-architektur-und-plan.md).

---

Du bist ein erfahrener Senior Full-Stack-Entwickler
mit Spezialisierung auf Progressive Web Apps,
React, TypeScript, mobile Benutzeroberflächen
und intelligente Dokumentenerkennung.

Ich bin Junior Developer und möchte mit dir
eine vollständige Haushaltsbudget-App entwickeln.

WICHTIG:
Die Anwendung wird ausschließlich privat von
mir verwendet. Eine Veröffentlichung oder
kommerzielle Nutzung ist nicht geplant.

Entwickle eine moderne, zuverlässige und
möglichst vollständig kostenlose Anwendung.

Arbeite strukturiert, erkläre wichtige
technische Entscheidungen und implementiere
alle Funktionen schrittweise.

## 1. PROJEKTZIEL

Entwickle eine Progressive Web App (PWA), die
mir hilft, meine monatlichen Einnahmen,
Ausgaben, Budgets und Ersparnisse zu verwalten.

Die Besonderheit:

Ich möchte meine Einkäufe durch Fotografieren
von Kassenbons automatisch erfassen.

Die App soll einzelne Produkte erkennen,
automatisch kategorisieren und die jeweiligen
Beträge von meinen Budgets abziehen.

Eine Bankanbindung ist ausdrücklich NICHT
gewünscht.

Die Anwendung soll möglichst wenig manuelle
Arbeit erfordern.

## 2. TECHNISCHE ANFORDERUNGEN

Bevorzugter Technologie-Stack:

- React
- TypeScript
- Vite
- Tailwind CSS
- IndexedDB für lokale Datenspeicherung
- Dexie.js als IndexedDB-Abstraktion
- PWA mit Web App Manifest
- Service Worker für Installation und Caching
- Geeignete kostenlose OCR-Technologie
- Keine kostenpflichtigen APIs ohne Zustimmung

Die App soll auf einem iPhone funktionieren
und über Safari zum Home-Bildschirm
hinzugefügt werden können.

Die Benutzeroberfläche wird ausschließlich
für Smartphones optimiert.

Eine Desktop-Oberfläche ist nicht erforderlich.

Internetverbindung darf vorausgesetzt werden.

WICHTIG:
Die App muss nach Möglichkeit ohne laufende
Kosten betrieben werden können.

Falls Funktionen wie Push-Benachrichtigungen
einen externen Dienst benötigen, prüfe
kostenlose Lösungen.

Erkläre Einschränkungen transparent.

## 3. DESIGN UND BENUTZEROBERFLÄCHE

Designrichtung:

70 % moderne Banking-App
30 % motivierende Spar-App

Standarddesign: DARK MODE

Farben:
- Dunkler Anthrazit-Hintergrund
- Moderne Karten
- Weiße und dezente graue Schrift
- Grün für positive Budgetentwicklung
- Orange für Warnungen
- Rot für Budgetüberschreitungen

Zusätzlich:
- Optionaler Light Mode
- Moderne Animationen
- Fortschrittsbalken
- Fortschrittsringe
- Übersichtliche Diagramme
- Große Touch-Flächen
- Bedienung mit einer Hand

Navigation am unteren Bildschirmrand.

Vorgeschlagene Hauptbereiche:

1. Dashboard
2. Budgets
3. Kassenbons / Ausgaben
4. Sparen
5. Einstellungen

Ein zentraler Plus-Button ermöglicht:

- Kassenbon fotografieren
- Ausgabe manuell erfassen
- Einnahme hinzufügen

## 4. EINNAHMEN UND GESAMTBUDGET

Ich möchte mein monatliches Einkommen
selbst eingeben können.

Beispiel:

Monatliches Einkommen: 1.200 €

Dieses Einkommen wird auf verschiedene
Budgetkategorien verteilt.

Das Dashboard zeigt:

- Monatliches Gesamteinkommen
- Bereits verplantes Geld
- Noch nicht verplantes Geld
- Tatsächliche Ausgaben
- Reservierte Beträge
- Verfügbares Restbudget
- Fest eingeplante Sparbeträge
- Zusätzliches Sparpotenzial

WICHTIG:

Unterscheide konsequent zwischen:

1. Einkommen
2. Budgetzuweisungen
3. Tatsächlichen Ausgaben
4. Reservierten Rücklagen
5. Tatsächlich zurückgelegtem Geld

Vermeide doppelte Abbuchungen.

Eine Budgetzuweisung ist noch keine Ausgabe.

## 5. INDIVIDUELLE BUDGETKATEGORIEN

Der Nutzer kann eigene Kategorien erstellen.

Beispiele:

- Lebensmittel
- Drogerie
- Gesundheit
- Mobilität
- Freizeit
- Kleidung
- Wohnen
- Versicherungen
- Abonnements
- Sparen
- Sonstiges

Jede Kategorie besitzt:

- Namen
- Optionales Symbol
- Individuelles Budget
- Verbrauchtes Budget
- Verbleibendes Budget
- Fortschrittsanzeige

Monatliche Budgets sind Standard.

Optional sollen auch wöchentliche
Budgets möglich sein.

Die App zeigt zusätzlich:

Wie viel Geld pro verbleibendem Tag
durchschnittlich noch verfügbar ist.

Budgetwarnungen bei:

- 50 %
- 80 %
- 100 %

Die Schwellenwerte sollen anpassbar sein.

## 6. KASSENBON-SCANNER

DIESE FUNKTION IST BESONDERS WICHTIG.

Der Nutzer fotografiert einen Papierkassenbon
mit der iPhone-Kamera.

Die App soll anschließend automatisch:

1. Das Bild verarbeiten
2. Den Händler erkennen
3. Das Einkaufsdatum erkennen
4. Einzelne Produkte erkennen
5. Einzelpreise erkennen
6. Den Gesamtbetrag erkennen
7. Produkte kategorisieren
8. Budgets aktualisieren
9. Den Einkauf speichern

Beispiel:

REWE-Einkauf:

Hähnchen: 8,99 € → Lebensmittel
Reis: 2,49 € → Lebensmittel
Kreatin: 19,99 € → Lebensmittel
Shampoo: 3,49 € → Drogerie
Schmerztabletten: 5,99 € → Gesundheit

Die entsprechenden Kategorien werden
automatisch belastet.

WICHTIG:

Die Erkennung muss auf deutschen
Kassenbons funktionieren.

Berücksichtige:

- REWE
- EDEKA
- Lidl
- Aldi
- Kaufland
- dm
- Rossmann

Typische Produktabkürzungen müssen
möglichst zuverlässig erkannt werden.

Berücksichtige auch:

- Rabatte
- Pfand
- Mehrwertsteuerzeilen
- Mehrfachmengen
- Gutscheine
- Stornierungen
- Unleserliche Positionen

Prüfe, ob die Summe der erkannten Positionen
mit dem Gesamtbetrag übereinstimmt.

Verhindere doppelte Erfassung desselben Bons.

Nutze zunächst eine kostenlose OCR-Lösung.

Untersuche beispielsweise Tesseract.js
und andere geeignete lokale Lösungen.

Keine kostenpflichtigen KI-APIs ohne
meine ausdrückliche Zustimmung.

Wenn die Erkennung unzuverlässig ist,
implementiere einen sinnvollen Fallback.

## 7. INTELLIGENTE PRODUKTKATEGORISIERUNG

Produkte sollen automatisch passenden
Budgetkategorien zugeordnet werden.

WICHTIG:

Die Zuordnung erfolgt anhand des Produkts,
nicht ausschließlich anhand des Geschäfts.

Beispielsweise können bei REWE sowohl
Lebensmittel als auch Drogerieartikel
gekauft werden.

Persönliche Kategorisierungsregeln:

- Proteinpulver → Lebensmittel
- Kreatin → Lebensmittel
- Nahrungsergänzungsmittel → Lebensmittel

Die App soll aus Korrekturen lernen.

Beispiel:

Wenn ich Kreatin einmal von Gesundheit
zu Lebensmittel verschiebe, soll die App
diese Entscheidung für zukünftige
Einkäufe berücksichtigen.

Implementiere dafür eine lokale Datenbank
mit persönlichen Produktregeln.

Priorität:

1. Persönliche Nutzerregel
2. Bekannte Produktzuordnung
3. Automatische Klassifizierung
4. Fallback-Kategorie

Bei unsicherer Zuordnung soll die App
den Eintrag markieren.

## 8. AUTOMATISCHE VERBUCHUNG

Nach erfolgreicher Kassenbon-Erkennung
werden die Ausgaben automatisch verbucht.

Eine vorherige Bestätigung ist
grundsätzlich nicht erforderlich.

Allerdings muss der Nutzer jederzeit:

- Einkäufe öffnen
- Produkte bearbeiten
- Kategorien ändern
- Beträge korrigieren
- Einkäufe löschen

können.

Bei Änderungen müssen sämtliche
betroffenen Budgets automatisch
neu berechnet werden.

Speichere den Originalbeleg lokal,
möglichst speicheroptimiert.

Bei unklaren oder widersprüchlichen
Beträgen soll die App den Fehler sichtbar
machen und eine Korrektur ermöglichen.

## 9. MANUELLE AUSGABEN

Nicht jeder Einkauf besitzt einen Beleg.

Deshalb muss es eine schnelle manuelle
Erfassung geben.

Benötigte Felder:

- Betrag
- Kategorie
- Datum
- Optionale Beschreibung

Beispiel:

15 € Lebensmittel
Beschreibung: Wochenmarkt

Die Ausgabe wird sofort im Dashboard
und im entsprechenden Budget berücksichtigt.

## 10. WIEDERKEHRENDE AUSGABEN

Unterstütze folgende Zahlungsintervalle:

- Wöchentlich
- Monatlich
- Vierteljährlich
- Halbjährlich
- Jährlich

Beispiele:

Miete: 400 € monatlich
Handyvertrag: 20 € monatlich
Versicherung: 90 € vierteljährlich

Der Nutzer trägt diese Ausgaben einmal ein.

Die App erstellt automatisch zukünftige
Fälligkeiten.

WICHTIG:

Wiederkehrende Ausgaben dürfen NICHT
automatisch als bezahlt markiert werden.

Ich möchte jede Abbuchung bestätigen.

Mögliche Zustände:

- Geplant
- Fällig
- Bezahlt
- Überfällig

Bei Fälligkeit soll eine Benachrichtigung
erscheinen.

Beispiel:

"Deine Versicherung über 90 €
ist heute fällig."

Aktionen:

- Als bezahlt bestätigen
- Noch nicht bezahlt
- Betrag bearbeiten

Erst nach Bestätigung wird die Ausgabe
als tatsächlich bezahlt verbucht.

## 11. RÜCKLAGEN FÜR SELTENE ZAHLUNGEN

Vierteljährliche und jährliche Ausgaben
sollen monatlich berücksichtigt werden.

Beispiel:

Versicherung: 90 € pro Quartal

Die App reserviert rechnerisch
monatlich 30 €.

Diese 30 € sind nicht frei verfügbar.

Sie zählen aber noch nicht als
tatsächlich bezahlte Ausgabe.

Bei der späteren Zahlung muss die
gebildete Rücklage korrekt verwendet
werden.

Keine doppelte Belastung des Budgets.

## 12. SPARFUNKTION

Die App soll aktives Sparen unterstützen.

Es gibt zwei Arten:

A) FESTES SPAREN

Beispiel:

Jeden Monat 50 € sparen.

Dieser Betrag wird direkt bei der
monatlichen Budgetplanung berücksichtigt.

B) ZUSÄTZLICHES SPAREN

Nicht verbrauchtes Budget wird am
Monatsende als Sparpotenzial erfasst.

Beispiel:

Lebensmittelbudget: 300 €
Tatsächlich ausgegeben: 240 €

Zusätzliches Sparpotenzial: 60 €

Die App soll unterscheiden zwischen:

- Zum Sparen verfügbar
- Tatsächlich zurückgelegt

Der Nutzer kann bestätigen, dass er
das Geld wirklich zurückgelegt hat.

## 13. SPARTÖPFE UND SPARZIELE

Implementiere einen zentralen Spartopf.

Standardmäßig dient dieser als Notgroschen.

Zusätzlich sollen individuelle
Sparziele möglich sein.

Beispiele:

- Notgroschen
- Urlaub
- Auto
- Größere Anschaffungen

Der Nutzer kann entscheiden, welchem
Spartopf zusätzliches Geld zugeordnet wird.

Ohne Auswahl wird der allgemeine
Spartopf vorgeschlagen.

Der Notgroschen soll als geschütztes
Sparziel gekennzeichnet werden können.

Eine Entnahme soll weiterhin möglich
sein, aber bewusst bestätigt werden müssen.

Zeige:

- Sparziel
- Bereits gesparter Betrag
- Noch fehlender Betrag
- Fortschrittsring
- Monatliche Entwicklung

## 14. MONATSABSCHLUSS

Am Monatsende soll die App eine
übersichtliche Auswertung erstellen.

Anzeigen:

- Gesamteinnahmen
- Gesamtausgaben
- Budgetüberschreitungen
- Nicht verbrauchte Budgets
- Fest eingeplante Sparbeträge
- Zusätzliches Sparpotenzial
- Tatsächlich gesparte Beträge

Nicht verbrauchte Budgets werden nicht
automatisch dem nächsten Monatsbudget
hinzugefügt.

Stattdessen werden sie als
Sparpotenzial ausgewiesen.

Der neue Monat startet wieder mit
den festgelegten Standardbudgets.

Achte darauf, dass unbestätigte
Ausgaben und reservierte Rücklagen
nicht versehentlich als Ersparnis gelten.

## 15. BENACHRICHTIGUNGEN

Unterstütze nach Möglichkeit
Push-Benachrichtigungen auf dem iPhone.

Beispiele:

"Du hast 80 % deines
Lebensmittelbudgets verbraucht."

"Deine Versicherung ist heute fällig."

"Du hast noch 120 € für Lebensmittel
und 18 Tage bis Monatsende."

"Du hast diesen Monat 60 €
zusätzliches Sparpotenzial erreicht."

Prüfe die technischen Voraussetzungen
für iOS-PWA-Push-Benachrichtigungen.

Falls ein kostenloser Push-Dienst
erforderlich ist, schlage eine Lösung vor.

Implementiere keine kostenpflichtigen
Dienste ohne Rückfrage.

## 16. DASHBOARD

Das Dashboard ist die wichtigste Ansicht.

Zeige:

1. Monatliches Einkommen
2. Tatsächliche Gesamtausgaben
3. Noch verfügbares Geld
4. Reservierte Rücklagen
5. Budgetfortschritt
6. Kategorien
7. Nächste fällige Zahlungen
8. Sparfortschritt
9. Letzte Einkäufe

Verwende moderne Karten und
übersichtliche Fortschrittsanzeigen.

Der Kassenbon-Scanner muss besonders
schnell erreichbar sein.

## 17. DATENSPEICHERUNG

Alle Daten werden zunächst lokal
auf meinem iPhone gespeichert.

Verwende IndexedDB.

Keine Benutzerregistrierung.

Keine Cloud-Datenbank.

Keine Bankverbindung.

Implementiere eine Backup-Funktion:

- Vollständiger Datenexport
- Vollständiger Datenimport
- Wiederherstellung aller Budgets
- Wiederherstellung aller Transaktionen
- Wiederherstellung der Sparziele
- Wiederherstellung persönlicher Produktregeln

Prüfe importierte Dateien auf Gültigkeit.

Erkläre, dass lokale Browserdaten
verloren gehen können.

Plane die Datenstruktur so, dass
später eine Cloud-Synchronisierung
ergänzt werden könnte.

## 18. QUALITÄT UND ZUVERLÄSSIGKEIT

Besonders wichtig ist die korrekte
Berechnung sämtlicher Geldbeträge.

Verwende für Geldbeträge Integer-Cent
oder eine andere präzise Dezimallösung.

Vermeide Floating-Point-Rundungsfehler.

Implementiere Tests für:

- Budgetberechnung
- Wiederkehrende Ausgaben
- Vierteljährliche Rücklagen
- Monatswechsel
- Sparbeträge
- Kassenbon-Korrekturen
- Doppelte Belege
- Budgetüberschreitungen
- Datenexport und Datenimport

## 19. ENTWICKLUNGSABLAUF

Arbeite in folgenden Phasen:

- PHASE 1: Projektstruktur und technische Architektur
- PHASE 2: Designsystem und mobile Navigation
- PHASE 3: Lokale Datenbank
- PHASE 4: Einnahmen und Budgetverwaltung
- PHASE 5: Dashboard
- PHASE 6: Manuelle Ausgaben
- PHASE 7: Wiederkehrende Zahlungen und Rücklagen
- PHASE 8: Sparfunktionen
- PHASE 9: Kassenbon-Erkennung
- PHASE 10: Intelligente Produktkategorisierung
- PHASE 11: Benachrichtigungen
- PHASE 12: Backup und Wiederherstellung
- PHASE 13: Tests und Fehlerbehebung
- PHASE 14: PWA-Installation auf dem iPhone

WICHTIG:

Arbeite schrittweise.

Teste abgeschlossene Funktionen.

Vermeide unnötige Abhängigkeiten.

Halte die Architektur verständlich.

Erkläre mir als Junior Developer
wichtige Entscheidungen.

## 20. DEINE ERSTE AUFGABE

Beginne NICHT sofort mit der vollständigen
Implementierung.

Erstelle zunächst:

1. Eine technische Architektur
2. Eine sinnvolle Projektstruktur
3. Ein Datenbankschema
4. Eine Übersicht aller Hauptansichten
5. Einen konkreten Entwicklungsplan
6. Eine Einschätzung möglicher Kosten
7. Eine Bewertung der OCR-Möglichkeiten
8. Eine Liste technischer Risiken

Prüfe insbesondere:

- iPhone-Kompatibilität
- Kostenlose Kassenbon-Erkennung
- Lokale Datenspeicherung
- Push-Benachrichtigungen
- Datenverlust und Backups

Stelle mir anschließend die Architektur
und deinen Implementierungsplan vor.

Warte auf meine Freigabe, bevor du
mit der Programmierung beginnst.
