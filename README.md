# Pixelmap-Template – Streamerin-Seite „Pixelpixie“

Die Website ist eine kleine Pixel-Art-Welt, die von oben nach unten aufgebaut ist. Beim Scrollen
fährt die Map ganz normal mit, und die Figur läuft auf einem Weg, der hin und her schwenkt, zur
nächsten Station. Dort öffnet sich der Inhalt. Die Figur hat ein eigenes Tempo: Wer schneller
scrollt, lässt sie oben aus dem Bild fallen („Pixie läuft hinterher …“), danach läuft sie wieder ins Bild.

Astro + TypeScript, kein UI-Framework, etwa 3 kB JavaScript (gzip).

## Start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # statische Seite in dist/ inkl. sitemap-index.xml und robots.txt
npm run preview    # Build lokal ansehen
npm run assets     # Platzhalter-Grafiken neu erzeugen (nach Änderungen am Weg/an Stationen)
```

Vor dem Livegang: Domain in `astro.config.mjs` (`site`), Kanal-Links und E-Mail in
`src/data/stations.ts` (`SOCIALS`, `SITE`), Impressum und Datenschutz eintragen.

## Aufbau

```
src/data/stations.ts   Name, Kanäle, Weg (PATH), Stationen und Texte  ← hier wird gepflegt
src/data/map.ts        Map-Größe, Gebäude-Größen, Tempo der Figur, Scroll-Verhalten
src/lib/path.ts        Pfad-Mathe: Länge → Punkt
src/scripts/map.ts     Scroll → Ziel → Figur → Kamera → Inhalt
src/pages/index.astro  Die Map (Ebenen, Gebäude, Figur, Stationen als <section>)
src/pages/kontakt.astro  Kooperationsanfrage (Unterseite)
src/pages/links.astro  Linkseite für die Bio (Daten: src/data/links.ts)
src/components/        Kopfzeile mit Burger-Menü, Footer, Station
src/styles/global.css  Farben & Schrift als CSS-Variablen, Boxen, Buttons, Kopfzeile
src/styles/map.css     Map-Modus (nur auf der Startseite geladen)
scripts/generate-assets.mjs  Erzeugt alle Platzhalter-Grafiken
ASSETS.md              Größen und Raster aller Grafiken
```

## So funktioniert es

1. **Kamera = Scroll:** Die Map ist so hoch wie die Seite und scrollt nativ mit (inkl. Schwung am Handy).
   Ist der Bildschirm schmaler als die Map, folgt die Kamera waagerecht weich dem Weg.
2. **Scroll → Ziel:** Jede Station hat eine Scroll-Position (Station auf Höhe `SCROLL.focus` im Bild).
   Dazwischen wandert das Ziel am Weg entlang. Um jede Station gibt es eine Halte-Zone (`SCROLL.hold`).
3. **Ziel → Figur:** Pro Frame läuft die Figur höchstens `HERO.speed × Zeit` Richtung Ziel, immer auf
   dem Weg. Ist sie weit zurück, sprintet sie (bis `HERO.sprintMax`-fach), damit Sprünge über die
   Navigation nicht ewig dauern. Ist sie außerhalb des Bildes, zeigt ein Hinweis am Rand, wo sie ist.
4. **Inhalt:** Stehen Figur und Ziel auf einer Station, hüpft das Gebäude kurz und das Inhaltsfenster
   öffnet sich (Desktop: neben dem Gebäude, Handy: als Leiste unten). Die Adresse wechselt auf `/#station`.
5. **Freies Scrollen:** Die Seite scrollt nie von selbst. Wer zwischen zwei Stationen aufhört, sieht
   die Figur dort stehen. Optional: `SCROLL.snap: true` – dann rastet die Seite nach dem Scrollen an
   der nächsten Station ein (fühlt sich bei einer mitscrollenden Map eher wie ein Springen an).
6. **Ende des Wegs:** Ganz unten über dem Footer steht eine Tür (`EXIT` in `src/data/stations.ts`).
   Die Figur läuft hin, die Tür geht auf. Kein Inhaltsfenster, kein Navigationspunkt.
7. **Ruhe:** Steht alles still, läuft keine Animationsschleife mehr.

Barrierefreiheit und Fallbacks:
- Alle Inhalte stehen als normales, semantisches HTML im Dokument (SEO, Screenreader).
- **Ohne JavaScript** zeigt die Seite alle Inhalte untereinander, die Navigation ist ausgeklappt.
- **`prefers-reduced-motion`:** Die Figur springt direkt zur Station, keine Lauf- und Hüpfanimation.
- **Tastatur:** Die Navigation führt zu den Stationen. Fokus in einem Inhaltsfenster (Tab) setzt die
  Figur sofort dorthin. Das Burger-Menü schließt mit Esc.
- **Handy:** Navigation als Burger-Menü (ab 1000 px Breite abwärts), Twitch-Button bleibt sichtbar.

## Zwei Maps: Desktop und Handy

Bis 700 px Bildschirmbreite (`MOBILE_QUERY` in `src/data/layouts.ts`) zeigt die Seite eine eigene,
schmale Handy-Map: Alle Gebäude stehen mittig untereinander, man scrollt nur gerade nach unten.
Zwischen zwei Gebäuden schwenkt der Weg zur Seite aus dem Bild (die Figur läuft mit hinaus und
kommt weiter unten wieder herein). Die Kamera bewegt sich dort nicht seitlich.

- Die Handy-Map wird **automatisch** aus der Reihenfolge der Stationen berechnet – eine neue Station
  erscheint dort von selbst. Zu welcher Seite der Weg nach jeder Station ausschwenkt, steht in
  `SIDES`, Abstände und Breite in `M` (beides `src/data/layouts.ts`).
- Der Browser lädt per `<picture>` nur die Ebenen der passenden Map. Dreht man das Handy über die
  Grenze, wechselt die Map, die Figur bleibt an ihrer Station.
- Der Hundeplatz liegt auf beiden Maps zwischen Start und erster Station (`parkAt(...)`).

## Stationen ändern oder ergänzen

Alles steht in `src/data/stations.ts`:

```ts
{
  id: 'streamplan',            // Anker: /#streamplan
  nav: 'Streamplan',           // Name in Navigation und auf dem Schild über dem Gebäude
  title: 'Streamplan',
  kicker: 'Wann bin ich live?',
  text: '…',
  bullets: ['Mo 19–23 Uhr · Cozy Montag', '…'],
  links: [{ href: SOCIALS.twitch.href, label: 'Auf Twitch folgen' }],  // externe Links: neuer Tab
  waypoint: 10,                // Index in PATH, an dem die Figur hält
  panel: 'right',              // Inhaltsfenster links/rechts vom Gebäude (Desktop)
  face: 'up',                  // Blickrichtung beim Stehen (up = zum Gebäude)
  building: 'tower',           // Grafik aus public/assets/buildings/
}
```

**Neue Station hinzufügen:**
1. Vor dem letzten Wegpunkt (Tür) Wegpunkte ergänzen und `EXIT.waypoint` anpassen. Der Weg muss **nach unten** führen (`y` nie kleiner als
   beim vorigen Punkt), `x` darf hin und her. Waagerecht/senkrecht sieht mit 4 Laufrichtungen am besten aus.
2. Station in `STATIONS` eintragen; `waypoint` zeigt auf einen waagerechten Wegabschnitt, über dem
   Platz für das Gebäude ist.
3. `npm run assets` – zeichnet beide Maps (Weg, Deko, Höhe) neu und **prüft**, dass der Weg nur nach unten
   führt und kein Gebäude auf dem Weg oder einem anderen Gebäude steht (sonst klare Fehlermeldung).

Die **Reihenfolge** im Array ist die Reihenfolge beim Scrollen; die `waypoint`-Indizes müssen aufsteigen.
Für eine Unterseite eine Datei in `src/pages/` anlegen (z. B. `kontakt.astro` kopieren). Mit
`station="id"` im `SubPage`-Layout führt „Zurück zur Map“ genau zu dieser Station.

## Hundeplatz (Easter Egg)

Zwischen Start und „Über mich“ liegt ein kleiner Platz mit Körbchen, Futter- und Wassernapf und
einem Ententeich. Dort lebt Mochi, die Französische Bulldogge, als NPC: Sie schläft im Körbchen, frisst und
trinkt, läuft herum und jagt die Entenküken (die flüchten in den Teich). Ein Klick auf den Hund
öffnet eine kleine Vorstellung.

- Texte, Name, Tempo und die Lage des Platzes: `src/data/npc.ts` (`DOG`, `PARK`).
  Nach Änderungen an `PARK` `npm run assets` ausführen (zeichnet Teich, Körbchen und Näpfe und
  hält den Platz frei von Bäumen). Der Platz darf nicht dort liegen, wo eine Infokarte aufgeht,
  sonst ist der Hund verdeckt.
- Verhalten: `src/scripts/npc.ts`. Gewichtung der Aktionen in `dogLoop()`.
- **Rechenlast:** Es gibt keine eigene Animationsschleife. Laufen ist ein CSS-Übergang (Grafikkarte),
  JavaScript entscheidet nur alle paar Sekunden. Ist der Platz außer Sicht oder der Tab im
  Hintergrund, pausiert alles (gemessen: ~0 ms Rechenzeit). Bei `prefers-reduced-motion` schläft
  der Hund einfach im Körbchen.

## Linkseite `/links` (Link in Bio)

Eine schlanke Seite mit allen Kanälen als große Buttons, gedacht für die Bio bei Instagram und
TikTok (`https://deine-domain.de/links`). Ohne Map und ohne Spiel-Code, lädt daher auch im
In-App-Browser sofort. Am Handy öffnet der Teilen-Button das native Teilen-Menü, am Desktop
kopiert er den Link.

Gepflegt wird sie in `src/data/links.ts`:
- `LINKS` – Buttons in Reihenfolge (`label`, `sub` = zweite Zeile, `icon`, `featured` = in Markenfarbe)
- `LINKS_PAGE.greeting` – Spruch unter dem Namen
- `LINKS_PAGE.avatar` – Pfad zu einem Profilfoto (z. B. `/assets/avatar.jpg`, quadratisch);
  leer = die Pixel-Figur vor ihrem Studio

Die Kanal-Adressen kommen aus `SOCIALS` in `src/data/stations.ts`, also nur an einer Stelle ändern.
Symbole sind selbst gezeichnete Pixel-Icons in `src/components/PixelIcon.astro`.

## Vorschau auf GitHub Pages

Bei jedem Push auf `main` baut `.github/workflows/pages.yml` die Seite und veröffentlicht sie auf
GitHub Pages (`https://<benutzer>.github.io/<repo>/`). Adresse und Unterordner setzt der Workflow
automatisch (`SITE_URL`, `BASE_PATH`); Suchmaschinen werden für die Vorschau ausgesperrt
(`PUBLIC_NOINDEX=true` → `noindex` und `robots.txt` mit `Disallow: /`).

- Einmalig: im Repo unter *Settings → Pages → Source* „GitHub Actions“ wählen.
- Pages aus einem **privaten** Repo braucht ein kostenpflichtiges GitHub-Konto (Pro/Team).
  Die veröffentlichte Seite selbst ist dann trotzdem für jeden mit dem Link erreichbar.
- Interne Links und Grafiken laufen deshalb über `url()` aus `src/lib/url.ts`, das den Unterordner
  davorsetzt. Bei neuen Links/Bildern mit Pfad `/…` immer `url('/…')` verwenden.
- Lokal testen wie auf Pages:
  `SITE_URL=https://<benutzer>.github.io BASE_PATH=/<repo> npm run build && npx astro preview`

## Grafik austauschen

Siehe [ASSETS.md](ASSETS.md). Kurz: eigene PNGs mit gleichem Namen und gleicher Größe nach
`public/assets/…` legen. Gebäude-Größen stehen in `BUILDINGS` (`src/data/map.ts`).

## Figurtempo und Scroll-Gefühl einstellen

In `src/data/map.ts`:

| Wert | Wirkung |
|---|---|
| `HERO.speed` (120) | Grundtempo in Map-Pixeln/s. Kleiner = Figur fällt beim schnellen Scrollen weiter zurück |
| `HERO.sprintFrom` (160) | Ab diesem Rückstand (Map-Pixel) beginnt der Sprint |
| `HERO.sprintMax` (4) | Höchstens so viel schneller beim Aufholen; `1` = nie sprinten |
| `SCROLL.hold` (0.4) | Wie lange die Figur beim Scrollen an einer Station stehen bleibt |
| `SCROLL.snap` (false) | Nach dem Scrollen an der nächsten Station einrasten |
| `SCROLL.magnet` (true) | Handy: in der Nähe einer Station die letzten Pixel sanft nachrücken, damit das Haus ganz zu sehen ist |
| `SCROLL.focus` | Desktop: auf welcher Bildhöhe die Station steht (0 = oben, 1 = unten) |
| `SCROLL.focusMobile` | Handy: Station steht automatisch so, dass das Gebäude unter die Kopfzeile passt – höchstens auf dieser Höhe |
| `MAP.zoom` | Zoomstufen; `viewSpan` = gewünschte Map-Pixel pro kürzerer Bildschirmseite |

Die Laufanimation der Beine passt sich automatisch an Tempo und Sprint an.

## Farben und Schrift

Alle Farben und Schriften stehen als CSS-Variablen am Anfang von `src/styles/global.css`.
Für eigene Markenfarben reicht es, `--brand`, `--brand-dark`, `--accent` und `--accent-2` zu ändern.
Die Pixel-Grafiken haben ihre Farben in der Palette `C` im Generator.
