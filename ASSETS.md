# Assets – Größen & Raster

Alle Grafiken sind Pixel-Art in **Originalauflösung**. Die Seite skaliert sie per CSS ganzzahlig
(×2 … ×6) mit `image-rendering: pixelated`. Also nie vorskaliert exportieren.

Die aktuellen Dateien sind selbst erzeugte Platzhalter aus `scripts/generate-assets.mjs`
(`npm run assets`), keine fremden Grafiken. Eigene Dateien mit **gleichem Namen und gleicher Größe**
ersetzen sie 1:1. Danach `npm run assets` nicht mehr ausführen, sonst werden sie überschrieben
(oder die eigenen Dateien vorher sichern).

## Map-Ebenen – `public/assets/map/`

| Datei | Größe | Inhalt | Transparenz |
|---|---|---|---|
| `ground.png` | 480 × 1520 px | Boden: Wiese, Pflasterweg, Speicherpunkte, Lichtkegel | nein (deckend) |
| `objects.png` | 480 × 1520 px | Alles, **hinter** dem die Figur läuft: Baumstämme, Steine, Kristalle, Laternenpfähle, Schatten | ja |
| `canopy.png` | 480 × 1520 px | Alles, was die Figur **verdeckt**: Baumkronen, Laternenköpfe | ja |

- Raster: **16 × 16 px Kacheln** (30 Kacheln breit). Die Breite ist fest (`MAP.width` in
  `src/data/map.ts`), die **Höhe wächst mit dem Weg**: Tür am Ende + 48 px, auf 16 gerundet.
  Kommt eine Station dazu, wird die Map höher – die aktuelle Höhe gibt `npm run assets` aus.
- Alle drei Ebenen müssen deckungsgleich sein (gleiche Größe, Ursprung oben links).
- Der Weg in `ground.png` muss zum `PATH` in `src/data/stations.ts` passen. Die Figur läuft exakt
  auf diesen Koordinaten (Map-Pixel, Wegbreite 20 px). In Aseprite/Tiled die Koordinaten ablesen
  und dort eintragen. Der Weg führt von oben nach unten: `y` darf von Punkt zu Punkt nie kleiner werden.

## Gebäude – `public/assets/buildings/`

Ein PNG pro Gebäude-Typ, transparent, Schatten am Fuß mitgezeichnet. Das Gebäude steht mittig über
dem Wegpunkt seiner Station, die Unterkante 13 px über der Wegmitte (`BUILDING_GAP`).

| Datei | Größe | Station |
|---|---|---|
| `studio.png` | 72 × 64 px | Start (Stream-Studio) |
| `house.png` | 64 × 60 px | Über mich |
| `tower.png` | 48 × 84 px | Streamplan (Uhrturm) |
| `arcade.png` | 84 × 60 px | Games & Setup |
| `cinema.png` | 80 × 64 px | Clips & Highlights |
| `tavern.png` | 76 × 62 px | Community |
| `post.png` | 64 × 58 px | Kontakt |
| `door.png` | 96 × 56 px | Tür am Ende des Wegs: **2 Frames à 48 × 56 px** nebeneinander, links zu, rechts offen |

- Andere Größe: Eintrag in `BUILDINGS` (`src/data/map.ts`) anpassen.
- Neuer Typ: Typ in `BuildingType` (`src/data/stations.ts`) und `BUILDINGS` ergänzen, Grafik ablegen.
  Für einen Platzhalter zusätzlich eine Zeichenfunktion in `BUILD` im Generator.
- Mehrere Frames: `frames: 2` in `BUILDINGS`, Frames nebeneinander. Frame 2 wird gezeigt, solange
  die Figur davor steht.
- Tür unten mittig zeichnen – dort steht die Figur und schaut auf das Gebäude.

## Figur – `public/assets/sprites/hero.png`

| Größe | Raster |
|---|---|
| 64 × 96 px | 4 Spalten × 4 Zeilen, Frame **16 × 24 px** |

```
         Frame 0   Frame 1   Frame 2   Frame 3
Zeile 0  unten:   Stand     Schritt   Stand     Schritt
Zeile 1  links:   …
Zeile 2  rechts:  …
Zeile 3  oben:    …
```

- **Frame 0 jeder Zeile ist zugleich die Idle-Pose** (Stillstand).
- Fußpunkt: Pixel **(8, 22)** im Frame steht auf dem Weg (`HERO.anchorX/anchorY`).
- Andere Framegröße oder mehr Frames: `HERO.frameW`, `frameH`, `frames` in `src/data/map.ts`.
  Das Sheet muss dann `frameW × frames` breit und `frameH × 4` hoch sein.

## Hund & Entenküken – `public/assets/sprites/`

| Datei | Größe | Raster |
|---|---|---|
| `dog.png` | 64 × 60 px | 4 Spalten × 5 Zeilen, Frame **16 × 12 px**: laufen rechts, laufen links, fressen rechts, fressen links, schlafen |
| `duck.png` | 32 × 32 px | 4 Spalten × 4 Zeilen, Frame **8 × 8 px**: laufen rechts, laufen links, schwimmen rechts, schwimmen links |

- Fußpunkt Hund **(8, 11)**, Ente **(4, 7)** – dieser Pixel steht auf dem Boden (`NPC_SPRITES` in `src/data/npc.ts`).
- Jede Zeile hat 4 Frames, die als Schleife abgespielt werden. Frame 0 der Laufzeilen ist zugleich das Stehen.
- Körbchen, Näpfe und Teich sind in `objects.png` bzw. `ground.png` eingezeichnet (Lage aus `PARK`).

## Vorschaubild – `public/assets/og.png`

1200 × 630 px, wird beim Teilen (Discord, WhatsApp, X …) angezeigt. Kann durch ein eigenes Bild
gleicher Größe ersetzt werden (darf auch Foto/Logo sein).

## Tipps für den Export

- PNG, 8 Bit indiziert oder RGBA. Keine Interpolation, kein Farbprofil nötig.
- Indizierte PNGs (≤ 256 Farben) sind am kleinsten. Die Platzhalter liegen bei 0,3–75 kB.
