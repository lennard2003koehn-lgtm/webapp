# Haushaltsbudget-PWA – Architektur & Implementierungsplan

> Stand: 02.11.2026 · Status: **Entwurf, wartet auf Freigabe** – es wurde noch kein App-Code geschrieben.
> Anforderungen: [`00-anforderungen.md`](./00-anforderungen.md)

---

## 0. Kurzfassung

| Thema | Entscheidung |
|---|---|
| App-Typ | Reine Client-App (PWA), kein eigenes Backend |
| Stack | React 18 + TypeScript + Vite + Tailwind CSS |
| Daten | IndexedDB über Dexie.js, alle Beträge als **Integer-Cent** |
| OCR | **Tesseract.js** (lokal im Browser, kostenlos) + eigener Bon-Parser für deutsche Händler |
| OCR-Fallback | iOS-Kurzbefehl mit Apples eigener Texterkennung → Text an die App übergeben; zusätzlich Korrektur-Ansicht |
| Push | Web Push funktioniert auf dem iPhone (ab iOS 16.4, nur als Home-Bildschirm-App). Für **zeitgesteuerte** Pushes braucht man einen kleinen Server → Vorschlag: Cloudflare Worker (Gratis-Tarif). Stufe 1 kommt ohne Server aus. |
| Hosting | Cloudflare Pages oder GitHub Pages (kostenlos, HTTPS) |
| Laufende Kosten | **0 €** |
| Tests | Vitest + fake-indexeddb |

---

## 1. Technische Architektur

### 1.1 Grundidee: „Local-first“

```
┌──────────────────────── iPhone (Safari / Home-Bildschirm-App) ─────────────────────────┐
│                                                                                        │
│  ┌─────────────┐   ┌──────────────────────┐   ┌──────────────────────────────────────┐ │
│  │  UI-Schicht │──▶│  Domain-Schicht      │──▶│  Daten-Schicht                       │ │
│  │  React +    │   │  (reines TypeScript) │   │  Dexie.js → IndexedDB                │ │
│  │  Tailwind   │◀──│  - Geld (Cent)       │◀──│  - Tabellen (siehe Schema)           │ │
│  │             │   │  - Budget-Rechner    │   │  - Repositories (CRUD + Transaktion) │ │
│  │  Hooks:     │   │  - Wiederkehrend     │   └──────────────────────────────────────┘ │
│  │  useLive-   │   │  - Rücklagen         │                                            │
│  │  Query()    │   │  - Sparen            │   ┌──────────────────────────────────────┐ │
│  └─────────────┘   │  - Monatsabschluss   │   │  Web Worker                          │ │
│                    │  - Kategorisierung   │   │  Tesseract.js (OCR, WASM)            │ │
│                    │  - Bon-Parser        │◀──│  Bild-Vorverarbeitung (Canvas)       │ │
│                    └──────────────────────┘   └──────────────────────────────────────┘ │
│                                                                                        │
│  Service Worker (Workbox via vite-plugin-pwa): Offline-Cache, Installierbarkeit, Push  │
└────────────────────────────────────────────────────────────────────────────────────────┘
            │ nur statische Dateien laden                    │ optional (Phase 11b)
            ▼                                                ▼
   Cloudflare Pages / GitHub Pages                 Cloudflare Worker (Gratis)
   (Hosting, HTTPS)                                Cron + Web-Push-Versand
```

**Warum kein Backend?** Du willst keine Registrierung, keine Cloud-DB und keine Kosten.
Alles, was die App rechnet, passiert auf dem iPhone. Der Server liefert nur einmal die
Dateien aus – danach läuft die App sogar offline.

### 1.2 Die drei Schichten – und warum diese Trennung wichtig ist

1. **Domain-Schicht (`src/domain/`)** – reines TypeScript ohne React und ohne Datenbank.
   Hier stehen alle Rechenregeln: „Wie viel ist noch verfügbar?“, „Wann ist die nächste
   Fälligkeit?“, „Wie verteile ich 1 € Rabatt auf 3 Produkte?“.
   *Erklärung für dich als Junior:* Diese Funktionen bekommen Daten rein und geben ein
   Ergebnis raus („pure functions“). Dadurch sind sie **trivial testbar** – genau dort,
   wo Fehler am teuersten wären (Geld!).
2. **Daten-Schicht (`src/db/`)** – Dexie-Schema, Migrationen, Repositories.
   Schreibvorgänge, die mehrere Tabellen betreffen (z. B. Bon + Positionen speichern),
   laufen in **einer Dexie-Transaktion**: entweder alles oder nichts.
3. **UI-Schicht (`src/features/`, `src/components/`)** – React-Komponenten.
   Mit `useLiveQuery` (dexie-react-hooks) aktualisiert sich die Oberfläche automatisch,
   sobald sich Daten ändern. Du musst also nach dem Korrigieren eines Bons **nichts manuell
   neu berechnen** – das Dashboard rechnet aus den gespeicherten Daten neu.

### 1.3 Kernprinzip: Nichts Abgeleitetes speichern

„Verbrauchtes Budget“, „Restbudget“, „Sparpotenzial“ werden **nie gespeichert**, sondern
immer aus den Buchungen berechnet. Das ist der wichtigste Schutz gegen doppelte
Abbuchungen und inkonsistente Zahlen: Wenn du eine Bon-Position änderst, ändert sich
genau ein Datensatz, und alle Summen stimmen automatisch wieder.

Einzige Ausnahme: der **Monatsabschluss** speichert einen eingefrorenen Schnappschuss
(Historie soll sich nicht ändern, wenn du später Kategorien umbenennst).

### 1.4 Das Geldmodell (die 5 Begriffe sauber getrennt)

| Begriff | Was es ist | Wo gespeichert | Zählt als Ausgabe? |
|---|---|---|---|
| **Einkommen** | Geld, das reinkommt | `incomes` | – |
| **Budgetzuweisung** | Plan: „300 € für Lebensmittel“ | `monthPlans.allocations` | Nein |
| **Ausgabe** | Tatsächlich bezahlt (manuell, Bon-Position, bestätigte Fixkosten) | `expenses` | **Ja** |
| **Rücklage (reserviert)** | Monatlicher Anteil seltener Zahlungen (90 €/Quartal → 30 €/Monat) | berechnet aus `recurring` + `reserveMovements` | Nein |
| **Zurückgelegt** | Vom Nutzer bestätigt in einen Spartopf überwiesen | `savingsMovements` (confirmed) | Nein (eigene Kategorie „Sparen“) |

**Formeln für den aktuellen Monat** (alles in Cent):

```
Einkommen               I  = Σ incomes des Monats
Verplant                P  = Σ Kategorie-Budgets + Festes Sparen + Rücklagen-Zuführung
Nicht verplant          U  = I − P
Ausgaben                A  = Σ expenses des Monats, die NICHT aus Rücklage finanziert sind
Reserviert              R  = Σ monatliche Rücklagen-Zuführungen
Festes Sparen           F  = geplanter Sparbetrag
Verfügbar               V  = I − A − R − F
Rest je Kategorie       = Budget − Ausgaben der Kategorie
Pro Tag verfügbar       = Rest ÷ verbleibende Tage (inkl. heute), auf Cent abgerundet
Sparpotenzial (Ende)    = Σ max(0, Rest je Kategorie) + max(0, U)
```

### 1.5 Rücklagen ohne Doppelbelastung – konkret

Beispiel Versicherung 90 €/Quartal, fällig 01.01.:

1. Okt, Nov, Dez: je **30 € reserviert** → reduziert „Verfügbar“, ist aber **keine Ausgabe**.
   Rücklagenstand nach Dezember: 90 €.
2. 01.01.: Fälligkeit erscheint → du tippst „Bezahlt“ → es entsteht eine Ausgabe über 90 €
   mit `fundedByReserve = true` und eine Rücklagen-Bewegung −90 €.
3. Im Januar wird die 90-€-Ausgabe zwar **angezeigt**, aber **nicht** von „Verfügbar“
   abgezogen, weil sie aus der Rücklage bezahlt wurde. → Keine Doppelbelastung.
4. Ist die Rücklage zu klein (z. B. App erst im Dezember eingerichtet), wird nur der
   Fehlbetrag aus dem laufenden Monat belastet und klar angezeigt („60 € aus laufendem
   Budget, da Rücklage nur 30 € beträgt“).
5. Weicht der Betrag ab (Versicherung kostet plötzlich 95 €), werden die 5 € Differenz
   aus dem laufenden Monat genommen; die künftige Zuführung passt sich an.

Monatliche Fixkosten (Miete 400 €) haben **keine** Rücklage – sie sind einfach eine
geplante Ausgabe der Kategorie „Wohnen“, die erst nach Bestätigung zählt.

### 1.6 Wöchentliche Budgets

Eine Kategorie kann `period: 'weekly'` haben (z. B. 70 €/Woche, ISO-Woche Mo–So).
- Fortschritt/Warnungen beziehen sich auf die **laufende Woche**.
- Für die Monatsplanung wird ein Monatsäquivalent gerechnet:
  `wochenbudget × Tage im Monat ÷ 7` (auf Cent gerundet), damit „Verplant“ stimmt.

---

## 2. Projektstruktur

> **Hinweis:** Im Repository liegt aktuell eine kleine Express-ToDo-App (`server.js`, `views/`).
> Vorschlag: Die Budget-App kommt in einen eigenen Ordner **`budget-app/`**, damit nichts
> kaputtgeht. (Alternativ kann sie die ToDo-App ersetzen – siehe offene Fragen.)

```
budget-app/
├── index.html
├── package.json
├── vite.config.ts            # inkl. vite-plugin-pwa (Manifest + Service Worker)
├── tailwind.config.ts        # Designtokens (Farben, Radien, Abstände)
├── tsconfig.json
├── public/
│   ├── icons/                # App-Icons inkl. apple-touch-icon 180×180
│   └── tesseract/            # deu.traineddata (lokal ausgeliefert, nicht vom CDN)
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx           # Router + Layout
    │   ├── routes.tsx
    │   └── providers/        # Theme, Toasts
    ├── components/           # Wiederverwendbare UI-Bausteine
    │   ├── ui/               # Button, Card, Sheet, Input, MoneyInput, Toggle …
    │   ├── charts/           # ProgressRing, ProgressBar, MiniBarChart (eigenes SVG)
    │   └── layout/           # BottomNav, FabMenu (Plus-Button), PageHeader
    ├── features/             # Je Bereich ein Ordner (Seiten + Komponenten + Hooks)
    │   ├── dashboard/
    │   ├── budgets/
    │   ├── expenses/         # manuelle Ausgaben + Liste
    │   ├── receipts/         # Scanner, Bon-Detail, Korrektur
    │   ├── recurring/        # Fixkosten, Fälligkeiten, Rücklagen
    │   ├── savings/          # Spartöpfe, Sparziele
    │   ├── month-closing/
    │   ├── notifications/
    │   └── settings/         # inkl. Backup/Import, Produktregeln
    ├── domain/               # Reine Logik, 100 % testbar
    │   ├── money.ts          # Cent-Arithmetik, Parsen "8,99", Formatieren "8,99 €"
    │   ├── dates.ts          # Monatsschlüssel "2026-11", Wochen, Resttage
    │   ├── budget.ts         # Formeln aus 1.4
    │   ├── recurring.ts      # Fälligkeiten erzeugen, Status bestimmen
    │   ├── reserves.ts       # Rücklagen-Logik aus 1.5
    │   ├── savings.ts
    │   ├── monthClosing.ts
    │   ├── categorize/       # Regeln, Wörterbuch, Normalisierung
    │   └── receipt/
    │       ├── parser.ts         # Text → strukturierter Bon
    │       ├── merchants/        # rewe.ts, edeka.ts, lidl.ts, aldi.ts, kaufland.ts, dm.ts, rossmann.ts
    │       ├── validate.ts       # Summenprüfung
    │       └── fingerprint.ts    # Duplikaterkennung
    ├── db/
    │   ├── schema.ts         # Dexie-Klasse + Versionen/Migrationen
    │   ├── repositories/     # expenses.ts, receipts.ts, …
    │   ├── seed.ts           # Standardkategorien + Basis-Produktwörterbuch
    │   └── backup.ts         # Export/Import + Validierung (zod)
    ├── workers/
    │   └── ocr.worker.ts     # Tesseract + Bildvorverarbeitung
    ├── sw/                   # eigener Service-Worker-Code (Push-Handler)
    └── test/                 # Testhilfen, Beispiel-Bons (Text-Fixtures)
```

### Abhängigkeiten (bewusst wenige)

| Paket | Wozu | Warum nötig |
|---|---|---|
| react, react-dom | UI | gesetzt |
| react-router-dom | Navigation zwischen Ansichten | Standard, gut dokumentiert |
| dexie, dexie-react-hooks | IndexedDB | gesetzt; Live-Queries sparen viel Code |
| tesseract.js | OCR | einzige ernsthafte kostenlose Browser-OCR |
| zod | Import-Validierung | Backup-Dateien sicher prüfen |
| vite-plugin-pwa | Manifest + Service Worker | erspart fehleranfälligen SW-Handcode |
| tailwindcss | Styling | gesetzt |
| **Dev:** vitest, fake-indexeddb, @testing-library/react | Tests | |

**Bewusst NICHT:** Chart-Bibliothek (Ringe/Balken als eigenes SVG, ~100 Zeilen),
State-Management-Lib (Dexie + React-State reichen), Datums-Lib (wenige eigene Funktionen,
die wir testen), Geld-Lib (Integer-Cent reicht).

---

## 3. Datenbankschema (Dexie / IndexedDB)

### Gemeinsame Felder (für spätere Cloud-Synchronisierung)

Jeder Datensatz hat:

```ts
id: string          // UUID (crypto.randomUUID) – nicht Auto-Increment, damit Geräte nicht kollidieren
createdAt: string   // ISO-Zeitstempel
updatedAt: string   // für "letzte Änderung gewinnt" beim Sync
deletedAt?: string  // Soft-Delete ("Tombstone"), damit Löschungen synchronisierbar sind
```

Alle Beträge: `…Cents: number` (Ganzzahl). Alle Daten: `YYYY-MM-DD` (lokale Zeit),
Monate: `monthKey: 'YYYY-MM'`.

### Tabellen

```ts
settings            // genau ein Datensatz (id = 'app')
  defaultIncomeCents, currency: 'EUR', theme: 'dark'|'light'|'system',
  warningThresholds: [50, 80, 100], defaultSavingsPotId, fallbackCategoryId,
  fixedSavingsCents, fixedSavingsPotId, lastBackupAt, notificationPrefs, schemaVersion

categories          // &id, name, sortOrder, archived
  name, icon (Emoji), color, period: 'monthly'|'weekly',
  defaultBudgetCents, warningThresholds?: number[] (überschreibt global),
  isFixedCostCategory?: boolean, archived

monthPlans          // &id, &monthKey
  monthKey, incomeCents, fixedSavingsCents,
  allocations: { categoryId, budgetCents }[]   // Kopie der Standardbudgets bei Monatsstart
  // → Standardbudgets ändern verändert NICHT vergangene Monate

incomes             // &id, monthKey, date
  monthKey, date, amountCents, description

expenses            // &id, monthKey, date, categoryId, receiptId, occurrenceId, [monthKey+categoryId]
  monthKey, date, amountCents, categoryId, description,
  source: 'manual'|'receipt'|'recurring',
  receiptId?, occurrenceId?,
  fundedByReserveCents: number   // 0 bei normalen Ausgaben
  // Bon-spezifisch:
  rawText?, quantity?, unitPriceCents?, discountCents?,
  categorySource?: 'user-rule'|'dictionary'|'heuristic'|'fallback'|'manual',
  confidence?: number, needsReview?: boolean

receipts            // &id, date, merchant, &fingerprint
  merchant, merchantId?, date, time?, totalCents, itemsSumCents,
  status: 'ok'|'mismatch'|'needs-review',
  depositCents, depositReturnCents, couponCents,
  ocrText, ocrConfidence, imageId?, fingerprint

receiptImages       // &id  (getrennt, damit Listen-Abfragen keine Bilder laden)
  blob (JPEG, Graustufen, max. 1200 px Breite, ~80–200 KB)

recurring           // &id, nextDueDate, active
  name, amountCents, categoryId,
  interval: 'weekly'|'monthly'|'quarterly'|'halfyearly'|'yearly',
  anchorDate, endDate?, useReserve (Standard: true ab vierteljährlich), active

occurrences         // &id, recurringId, dueDate, status, [recurringId+dueDate]
  recurringId, dueDate, amountCents (überschreibbar),
  status: 'planned'|'paid'|'skipped',       // "fällig"/"überfällig" wird aus dem Datum berechnet
  paidAt?, expenseId?

reserveMovements    // &id, recurringId, monthKey
  recurringId, monthKey, amountCents (+Zuführung / −Verwendung), occurrenceId?

savingsPots         // &id
  name, icon, targetCents?, isDefault, isProtected, sortOrder, archived

savingsMovements    // &id, potId, monthKey
  potId, monthKey, date, amountCents (+Einzahlung / −Entnahme),
  type: 'fixed'|'extra'|'manual'|'withdrawal',
  status: 'suggested'|'confirmed'   // nur 'confirmed' zählt als "tatsächlich zurückgelegt"

productRules        // &id, &normalizedKey, categoryId
  normalizedKey (z. B. "kreatin"), matchType: 'exact'|'contains'|'prefix',
  categoryId, source: 'user'|'builtin', hits, lastUsedAt

monthClosings       // &id, &monthKey
  monthKey, closedAt, snapshot: { Einnahmen, Ausgaben, je Kategorie Budget/Ist, Sparpotenzial, gespart }

notificationLog     // &id, &dedupeKey
  dedupeKey (z. B. "budget:lebensmittel:2026-11:80"), sentAt
```

**Warum `receiptImages` getrennt?** Bilder sind groß. Wenn die Ausgabenliste geladen wird,
sollen nicht 200 Bilder mitgeladen werden.

**Warum Status „fällig/überfällig“ nicht speichern?** Er hängt vom heutigen Datum ab.
Gespeichert wird nur, was du entschieden hast (bezahlt / übersprungen); der Rest wird
berechnet: `dueDate > heute → Geplant`, `= heute → Fällig`, `< heute → Überfällig`.

**Duplikaterkennung Bon (`fingerprint`):** Hash aus Händler + Datum + Uhrzeit + Gesamtbetrag
(+ Bon-/Transaktionsnummer, falls erkannt). Bei Treffer: Warnung „Dieser Bon wurde am …
bereits erfasst“ mit Optionen *Abbrechen* / *Trotzdem speichern*. Zusätzlich weiche Prüfung:
gleicher Händler + gleicher Tag + gleiche Summe ohne Uhrzeit → Hinweis.

---

## 4. Hauptansichten

**Bottom-Navigation (5 Plätze):** Dashboard · Budgets · **[ + ]** · Ausgaben · Sparen
→ Der Plus-Button sitzt in der Mitte, groß, mit dem Daumen erreichbar.
→ Einstellungen über ein Zahnrad oben rechts im Dashboard (sonst wären es 6 Tabs –
   auf dem iPhone zu eng). *Falls du Einstellungen lieber als eigenen Tab willst, sag Bescheid.*

| # | Ansicht | Inhalt |
|---|---|---|
| 1 | **Dashboard** | Großer Ring „Verfügbar diesen Monat“, Einkommen / Ausgaben / Reserviert / Gespart als Karten, „pro Tag noch X €“, Kategorien mit Balken (grün/orange/rot), nächste Fälligkeiten (mit „Bezahlt“-Button), Sparfortschritt, letzte Einkäufe, Hinweis-Banner (z. B. „Bon prüfen“, „Backup älter als 14 Tage“) |
| 2 | **Plus-Menü** (Bottom-Sheet) | 📷 Kassenbon fotografieren (oberster, größter Button) · ✍️ Ausgabe erfassen · 💶 Einnahme hinzufügen |
| 3 | **Scanner** | Kamera/Foto wählen → Fortschritt („Text wird erkannt… 60 %“) → automatisch gebucht → Ergebnisseite |
| 4 | **Bon-Detail** | Foto, Händler, Datum, Positionen mit Kategorie-Chips, Summenprüfung (✅ / ⚠️ Differenz 0,49 €), markierte unsichere Positionen, Bearbeiten/Löschen, „Rohtext anzeigen“ |
| 5 | **Ausgaben-Liste** | Alle Ausgaben & Bons des Monats, Filter nach Kategorie, Monatswechsel per Wischen |
| 6 | **Manuelle Ausgabe** | Großes Betragsfeld (Ziffernblock), Kategorie-Raster, Datum (Standard heute), Beschreibung – in < 5 Sekunden erledigt |
| 7 | **Budgets** | Einkommen & Verteilung („Noch 120 € nicht verplant“), Kategorien mit Ring/Balken, Kategorie anlegen/bearbeiten, Fixkosten & Rücklagen-Übersicht |
| 8 | **Fixkosten / Fälligkeiten** | Liste wiederkehrender Zahlungen, Status-Badges (Geplant/Fällig/Bezahlt/Überfällig), Aktionen *Bezahlt* · *Noch nicht* · *Betrag ändern* |
| 9 | **Sparen** | Spartöpfe mit Fortschrittsringen, Notgroschen mit 🔒, „Zum Sparen verfügbar“ vs. „Zurückgelegt“, Bestätigen-Dialog, Entnahme mit bewusster Bestätigung, Verlauf je Monat |
| 10 | **Monatsabschluss** | Erscheint am Monatsanfang für den Vormonat: Auswertung + „Sparpotenzial verteilen“ |
| 11 | **Einstellungen** | Einkommen, Theme, Warnschwellen, Benachrichtigungen, Produktregeln (ansehen/bearbeiten/löschen), Backup exportieren/importieren, Speicherstatus, Hinweise zur Datensicherheit |

---

## 5. Kassenbon-Erkennung (das Herzstück)

### 5.1 Ablauf

```
Foto (iPhone-Kamera über <input type="file" accept="image/*" capture="environment">)
  ↓
Vorverarbeitung (Canvas, im Worker):
  verkleinern/ggf. hochskalieren auf ~1500–2000 px Höhe je Bonsegment · Graustufen ·
  Kontrast/Normalisierung · adaptiver Schwellwert (Binarisierung) · leichte Schräglagen-Korrektur
  ↓
Tesseract.js (Sprache "deu", PSM 4/6 = Textblock-Modus, Zeichen-Whitelist optional)
  ↓
Rohtext + Konfidenz je Zeile
  ↓
Parser:
  1. Händler erkennen (Schlüsselwörter/Fuzzy-Match: "REWE", "EDEKA", "LIDL", "ALDI SÜD/NORD",
     "KAUFLAND", "dm-drogerie markt", "ROSSMANN")
  2. Händler-Profil wählen (jede Kette hat eigenes Layout, z. B. Preis + Steuerkennzeichen "A"/"B")
  3. Zeilen klassifizieren: Artikel · Menge ("2 Stk x 1,29") · Rabatt (negativ) · Pfand ·
     Pfandrückgabe · Gutschein · Storno · Zwischensumme · SUMME · MwSt-Tabelle · Zahlart · Müll
  4. Datum/Uhrzeit (TT.MM.JJ / TT.MM.JJJJ), ggf. Bon-Nr.
  5. Rabatte der vorherigen Position zuordnen; Pfand als eigene Position (Kategorie Lebensmittel
     oder eigene "Pfand"-Regel), Stornos heben Position auf
  ↓
Validierung: Σ Positionen == SUMME?
  ✅ gleich → Status ok
  ⚠️ Differenz → Status "mismatch", sichtbar markiert, Differenz als Hinweis
  ↓
Kategorisierung je Position (siehe 6)
  ↓
Duplikatprüfung (fingerprint)
  ↓
Speichern in EINER Transaktion: receipt + receiptImage + expenses
  ↓
Ergebnisseite: "REWE · 40,95 € · 5 Positionen · 1 prüfen"
```

Mehrwertsteuer-Zeilen werden **erkannt und ignoriert** (sie sind schon im Preis enthalten –
würde man sie mitzählen, wäre das eine Doppelbuchung).

### 5.2 Bewertung der OCR-Möglichkeiten

| Option | Kosten | Genauigkeit auf Thermobons | iPhone | Bewertung |
|---|---|---|---|---|
| **Tesseract.js (v5/v6, WASM)** | 0 € | mittel; stark abhängig von Fotoqualität & Vorverarbeitung. Zahlen meist gut, Produktkürzel oft fehlerhaft | ✅ läuft in Safari; ca. 3–10 s pro Bon; Sprachdatei `deu` 2–15 MB (einmalig, wird gecacht) | **Hauptlösung** |
| Scribe.js / andere Tesseract-Wrapper | 0 € | ähnlich bis leicht besser | ✅, aber größer | Alternative, falls Tesseract enttäuscht |
| PaddleOCR / ONNX Runtime Web | 0 € | besser bei schwierigen Fotos | ⚠️ große Modelle, hoher RAM-Verbrauch → auf iOS Absturzrisiko | später evaluierbar, nicht als Start |
| **Apple Live Text / Vision über iOS-Kurzbefehl** | 0 € | **sehr gut** (Apples On-Device-Erkennung) | ✅ eingebaut ab iOS 15 | **Bester kostenloser Fallback** (siehe 5.3) |
| Google Cloud Vision | 1.000 Bilder/Monat frei, danach kostenpflichtig, **Kreditkarte nötig** | sehr gut | ✅ | nur nach deiner Zustimmung |
| KI-Vision-APIs (z. B. Claude, GPT) | ca. 0,5–3 Cent pro Bon | exzellent (versteht auch Kürzel & Rabatte) | ✅ | optionales Upgrade **nur mit deiner Zustimmung** |
| Spezialdienste (Mindee, Veryfi, Taggun) | kleine Gratis-Kontingente, sonst Abo | sehr gut | ✅ | nicht empfohlen (Abo-Fallen, Datenschutz) |

**Ehrliche Einschätzung:** Mit Tesseract.js wirst du bei einem gut fotografierten, glatten
Bon die **Summe und die meisten Preise** zuverlässig bekommen. **Produktnamen** werden
häufiger fehlerhaft sein („HAEHNCHENBR.FIL“ → „HAEHNCHENBR,FlL“). Deshalb setzen wir auf:
Fuzzy-Matching gegen ein Produktwörterbuch, die Summenprüfung als Kontrolle und eine
schnelle Korrekturansicht. Rechne realistisch damit, dass anfangs **jeder 2.–3. Bon eine
kleine Korrektur** braucht; mit wachsenden persönlichen Regeln wird es besser.

### 5.3 Fallback-Strategie (mehrstufig)

1. **Bessere Fotos:** Hinweise im Scanner („flach hinlegen, dunkler Untergrund, ganzer Bon
   im Bild“); lange Bons in 2 Fotos aufnehmen, die App setzt sie zusammen.
2. **Apple-Texterkennung per Kurzbefehl (empfohlen, kostenlos):** Ein iOS-Kurzbefehl
   „Bon scannen“ macht das Foto, nutzt *„Text aus Bild extrahieren“* (Apple Vision, sehr
   genau) und öffnet die App mit dem Text (über die Zwischenablage oder einen URL-Parameter).
   Unser Parser verarbeitet diesen Text genau wie Tesseract-Text. Ich liefere eine
   Schritt-für-Schritt-Anleitung zum Einrichten.
3. **Text einfügen:** Alternativ Live Text in der Kamera/Fotos-App → „Alles kopieren“ →
   in der App „Bontext einfügen“.
4. **Korrekturansicht:** Unsichere Positionen markiert, Differenz zur Summe sichtbar,
   Ausgleichsposition „Nicht erkannt: 0,49 €“ mit einem Tipp einer Kategorie zuordnen.
5. **Notfall:** Nur Gesamtbetrag + Hauptkategorie übernehmen (eine Buchung).
6. **(Optional, kostenpflichtig, nur nach Zustimmung):** KI-Vision-API pro Bon.

---

## 6. Intelligente Produktkategorisierung

Reihenfolge (wie gewünscht):

1. **Persönliche Nutzerregel** (`productRules`, `source='user'`) – z. B. „kreatin → Lebensmittel“.
   Entsteht automatisch, wenn du eine Kategorie einer Bon-Position änderst
   (mit Rückfrage-Toast: „Künftig ‚Kreatin‘ immer als Lebensmittel? ✓“ – standardmäßig *ja*).
2. **Bekannte Produktzuordnung** (`source='builtin'`) – mitgeliefertes Wörterbuch mit
   ein paar hundert typischen Begriffen und Kürzeln deutscher Bons
   (z. B. `MILCH`, `H-MILCH`, `BIO`, `HAEHN`, `SHAMP`, `ZAHNP`, `IBU`, `PARACET`, `KLOPAP`).
   Persönliche Startregeln aus deinen Anforderungen sind dabei:
   Proteinpulver / Kreatin / Nahrungsergänzung → Lebensmittel.
3. **Automatische Klassifizierung (Heuristik):** Normalisieren (Großschreibung,
   ä→AE, Ziffern/Mengen/Gewichte entfernen), Wortstämme & Teilstrings,
   Fuzzy-Ähnlichkeit (Levenshtein / Trigramme) gegen Regeln, plus schwacher Händler-Hinweis
   (bei dm/Rossmann eher Drogerie – **nur als Zusatzsignal**, nicht als Hauptregel).
4. **Fallback-Kategorie** (einstellbar, Standard: „Sonstiges“) + `needsReview = true`.

Jede Zuordnung speichert `categorySource` und `confidence`. Unter einem Schwellwert
(z. B. 0,7) wird die Position **markiert** (orange Punkt) und erscheint im Dashboard-Banner
„3 Positionen prüfen“.

Kein „echtes“ Machine Learning nötig: Für einen einzelnen Nutzer ist eine wachsende
Regel-Datenbank **zuverlässiger, erklärbar und testbar**.

---

## 7. Benachrichtigungen auf dem iPhone – was geht wirklich?

**Fakten:**
- Web Push für PWAs gibt es auf iOS **ab 16.4** – aber **nur**, wenn die App über
  „Zum Home-Bildschirm“ installiert wurde, und die Erlaubnis muss per Tipp auf einen Button
  angefragt werden.
- Safari kennt **keine** zeitgesteuerten lokalen Benachrichtigungen (keine Notification
  Triggers, kein Periodic Background Sync). Eine PWA kann also **nicht selbst** um 9 Uhr
  aufwachen und „Versicherung fällig“ melden.
- Für **zeitgesteuerte** Pushes muss ein Server die Nachricht über Apples Push-Dienst
  senden. Apples Push-Dienst selbst ist **kostenlos**, kein Apple-Developer-Account nötig
  (Web Push nutzt VAPID-Schlüssel).

**Plan in zwei Stufen:**

| Stufe | Wie | Kosten | Was funktioniert |
|---|---|---|---|
| **11a – ohne Server** | Beim Öffnen der App + direkt nach Buchungen: In-App-Banner und System-Benachrichtigung über den Service Worker | 0 € | „80 % Lebensmittel verbraucht“ (sofort nach dem Bon), „Versicherung heute fällig“ (wenn du die App öffnest), Monatsabschluss-Hinweis |
| **11b – mit Gratis-Server** | **Cloudflare Worker** (Gratis-Tarif: 100.000 Anfragen/Tag, Cron-Trigger inklusive) + Workers KV zum Speichern der Push-Anmeldung und eines **minimalen Terminplans** | 0 € | Echte Push-Nachrichten zur Uhrzeit, auch wenn die App geschlossen ist: Fälligkeiten, tägliche/wöchentliche Budget-Zusammenfassung |

**Datenschutz bei 11b:** Der Worker kennt nur das, was er senden soll – z. B.
`{ datum: "2027-01-01", text: "Deine Versicherung über 90 € ist heute fällig." }`.
Die App schickt diesen Terminplan bei Änderungen. Keine Kontodaten, keine Bons.
„120 € für Lebensmittel und 18 Tage“ kann nur so aktuell sein wie der letzte Abgleich
(wird bei jeder Buchung aktualisiert).

Brauchst du dafür: einen kostenlosen Cloudflare-Account. Ich frage vor Phase 11b nochmal.

---

## 8. Datenspeicherung, Datenverlust & Backups

**Was du wissen musst (transparent):**
- IndexedDB-Daten liegen **nur auf deinem iPhone, nur in dieser App**.
- **Löschst du die App vom Home-Bildschirm, sind die Daten weg.** Ebenso bei
  „Verlauf und Websitedaten löschen“ und u. U. bei einem neuen iPhone ohne Backup.
- Safari löscht Daten normaler Websites nach 7 Tagen ohne Nutzung – **installierte
  Home-Bildschirm-Apps sind davon ausgenommen**. Wir fordern zusätzlich
  `navigator.storage.persist()` an (dauerhafter Speicher).
- Ob die PWA-Daten im iCloud-Geräte-Backup landen, ist nicht zuverlässig dokumentiert →
  **nicht darauf verlassen.**
- Safari-Daten (normaler Tab) und Home-Bildschirm-App haben **getrennte Speicher**.
  Immer die installierte App benutzen.

**Gegenmaßnahmen:**
- **Export** als `.json` (alle Tabellen; Bilder optional als Base64 – Schalter „inkl. Belegfotos“).
  Speichern über das iOS-Teilen-Menü → „In Dateien sichern“ (iCloud Drive) oder AirDrop.
- **Import** mit Prüfung: Format-Kennung, Schema-Version, zod-Validierung jedes Datensatzes,
  Referenzprüfung (existiert die Kategorie?), Cent-Beträge ganzzahlig. Vorschau
  („412 Ausgaben, 9 Kategorien, 3 Spartöpfe – ersetzen?“), vor dem Import automatischer
  Sicherungs-Export, Import in **einer** Transaktion.
- **Backup-Erinnerung:** Banner, wenn das letzte Backup älter als 14 Tage ist.
- **Speichersparen:** Belegfotos als JPEG, Graustufen, max. ~1200 px breit, Qualität ~0,6
  → ca. 80–200 KB/Bon (≈ 20 MB/Jahr bei 2 Bons/Woche). Option „Fotos nach X Monaten löschen“.

---

## 9. Konkreter Entwicklungsplan

Jede Phase endet mit: lauffähiger App, Tests grün, Commit + Push, kurze Erklärung für dich.

| Phase | Inhalt | Ergebnis / Tests |
|---|---|---|
| **1** | Vite + React + TS + Tailwind aufsetzen, Ordnerstruktur, ESLint, Vitest, `money.ts` & `dates.ts` | Tests: Cent-Parsen („8,99“, „1.200,00“, „-0,50“), Rundung, Monatsgrenzen |
| **2** | Designsystem (Farb-Tokens Dark/Light), Card, Button, Sheet, ProgressRing/-Bar, BottomNav, Plus-Menü, Safe-Area (Notch/Home-Indicator) | Klickbarer Prototyp mit Platzhaltern |
| **3** | Dexie-Schema, Repositories, Seed (Standardkategorien, Spartopf „Notgroschen“), `navigator.storage.persist()` | Tests mit fake-indexeddb |
| **4** | Einkommen, Kategorien CRUD, Monatsplan, „verplant / nicht verplant“, Wochenbudgets | Tests: Budgetberechnung, Monatswechsel (neuer Plan aus Standardwerten) |
| **5** | Dashboard mit echten Daten, pro-Tag-Wert, Warnfarben | Tests: Formeln aus 1.4, Überschreitung |
| **6** | Manuelle Ausgabe (schnell!), Ausgabenliste, Bearbeiten/Löschen | Tests: Ausgabe wirkt sofort auf Budget |
| **7** | Wiederkehrende Zahlungen, Fälligkeiten, Status, Bestätigen-Flow, Rücklagen | Tests: Intervalle (inkl. 31. → Monatsende, Schaltjahr), Rücklage 90 €/Quartal, keine Doppelbelastung, Unterdeckung |
| **8** | Spartöpfe, festes Sparen, Sparpotenzial, Bestätigung, geschützter Notgroschen, Monatsabschluss | Tests: Sparpotenzial ohne Rücklagen/unbestätigte Posten, Abschluss-Snapshot |
| **9** | OCR-Worker, Bildvorverarbeitung, Parser + Händlerprofile, Summenprüfung, Duplikate, Bon-Detail & Korrektur, Text-einfügen-Fallback | Tests mit Text-Fixtures je Händler (Rabatt, Pfand, Menge, Storno, Gutschein), Duplikat |
| **10** | Produktregeln, Wörterbuch, Fuzzy-Matching, Lernen aus Korrekturen, Regel-Verwaltung | Tests: Priorität 1–4, Kreatin-Beispiel, Korrektur → Neuberechnung |
| **11** | 11a In-App/SW-Benachrichtigungen · 11b (nach Rückfrage) Cloudflare Worker + Web Push | Tests: Schwellen-Logik + Deduplizierung |
| **12** | Export/Import, Validierung, Vorschau, Backup-Erinnerung | Tests: Export → Import → identische Daten; kaputte Dateien abgelehnt |
| **13** | Gesamttest, Randfälle, Performance auf dem iPhone, Bugfixes | Testabdeckung Domain ≥ 90 % |
| **14** | Hosting (Cloudflare/GitHub Pages), Icons, Splash, Installationsanleitung, Kurzbefehl-Anleitung | App auf deinem iPhone installiert |

**Empfohlene Reihenfolge-Abweichung (zur Diskussion):** Einen **OCR-Prototyp** (nur
Tesseract + Rohtext-Anzeige) schon nach Phase 2 kurz auf deinem iPhone testen. So wissen
wir früh, wie gut die Erkennung bei *deinen* Bons ist, bevor viel darauf aufbaut.

---

## 10. Kosten

| Posten | Kosten |
|---|---|
| Hosting (Cloudflare Pages oder GitHub Pages) | 0 € |
| Domain | 0 € (Subdomain `*.pages.dev` / `*.github.io`) |
| OCR (Tesseract.js, Apple-Kurzbefehl) | 0 € |
| Datenbank (lokal) | 0 € |
| Web Push über Apple | 0 € |
| Cloudflare Worker für zeitgesteuerte Pushes (optional) | 0 € im Gratis-Tarif (für einen Nutzer weit unter den Limits) |
| Apple Developer Account | nicht nötig |
| **Summe laufend** | **0 €** |
| *Optional:* KI-Vision für Bons (nur nach Zustimmung) | ca. 0,5–3 ct pro Bon → bei 10 Bons/Monat < 0,30 €/Monat |

Hinweis Hosting: GitHub Pages ist für **private** Repositories nur mit kostenpflichtigem
GitHub-Plan verfügbar. Cloudflare Pages funktioniert auch mit privaten Repos kostenlos →
deshalb meine Empfehlung.

---

## 11. Technische Risiken

| # | Risiko | Wahrscheinlichkeit | Auswirkung | Gegenmaßnahme |
|---|---|---|---|---|
| 1 | OCR-Qualität auf Thermobons (verblasst, geknickt, schräg) | hoch | hoch | Vorverarbeitung, Summenprüfung, Wörterbuch + Fuzzy, Apple-Kurzbefehl-Fallback, schnelle Korrektur, früher Prototyp-Test |
| 2 | Händler ändern Bon-Layouts / unbekannte Händler | mittel | mittel | generischer Parser als Basis, Händlerprofile nur als Verfeinerung |
| 3 | Datenverlust (App gelöscht, Speicher geleert) | mittel | sehr hoch | `storage.persist()`, Export/Import, Backup-Erinnerung, klare Hinweise |
| 4 | iOS-Speicher-/RAM-Limits bei OCR (Absturz bei großen Bildern) | mittel | mittel | Bild verkleinern, OCR im Web Worker, Worker nach Gebrauch beenden |
| 5 | Push nur als installierte App; keine lokalen Zeit-Benachrichtigungen | sicher | mittel | Stufe 11a ohne Server, 11b mit Cloudflare Worker |
| 6 | Service-Worker-Updates (alte Version bleibt hängen) | mittel | niedrig | „Neue Version verfügbar – neu laden“-Hinweis |
| 7 | Rundungsfehler bei Rabattverteilung / Rücklagen (90 € / 3, aber 100 € / 3?) | mittel | hoch | Integer-Cent, Verteilung nach „größtem Rest“ (33,34 + 33,33 + 33,33), Tests |
| 8 | Datumslogik (Monatsende 31., Schaltjahr, Zeitzonen/Sommerzeit) | mittel | mittel | Daten als `YYYY-MM-DD` ohne Uhrzeit, eigene getestete Datumsfunktionen |
| 9 | Doppelte Buchungen (Bon zweimal, Fixkosten doppelt bestätigt) | mittel | hoch | Fingerprint, eindeutiger Index `[recurringId+dueDate]`, Bestätigung idempotent |
| 10 | Schema-Änderungen später (Migrationen) | sicher | mittel | Dexie-Versionen mit Upgrade-Funktionen, Backup vor Migration |
| 11 | Kamera-Zugriff in iOS-PWA | niedrig | mittel | `<input type="file" capture>` statt `getUserMedia` – robusteste Variante auf iOS |
| 12 | Tesseract-Sprachdatei vom CDN nicht erreichbar | niedrig | mittel | Sprachdatei selbst mit ausliefern und im Service Worker cachen |

---

## 12. Offene Fragen an dich (vor dem Start)

1. **Ordner:** Budget-App in `budget-app/` neben der bestehenden ToDo-App – oder soll sie die
   ToDo-App ersetzen?
2. **Hosting:** Ist das Repository privat? Dann empfehle ich Cloudflare Pages
   (kostenloser Account nötig). Alternativ GitHub Pages bei öffentlichem Repo.
3. **Navigation:** Einstellungen über Zahnrad (mein Vorschlag) oder als eigener 6. Tab?
4. **Früher OCR-Test:** Einverstanden, nach Phase 2 einen OCR-Prototyp auf deinem iPhone zu testen?
5. **Push Stufe 11b:** Grundsätzlich okay, später einen kostenlosen Cloudflare-Account
   dafür zu nutzen?
6. **Einkommen:** Immer gleich (1.200 € als Standard je Monat) oder schwankend / mehrere Quellen?
7. **Kategorie „Sparen“:** Festes Sparen läuft über Spartöpfe, nicht als Ausgabe-Kategorie –
   einverstanden? (Sonst würde Sparen fälschlich als „Ausgabe“ zählen.)

Sobald du freigibst (gern mit Antworten auf die Fragen), starte ich mit **Phase 1**.
