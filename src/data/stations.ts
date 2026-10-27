/**
 * Weg, Stationen und Texte der Map – die zentrale Datei zum Pflegen der Inhalte.
 *
 * PATH:     Wegpunkte in Map-Pixeln, von oben nach unten. Die Figur läuft immer exakt auf dieser Linie.
 *           y darf nie kleiner werden (der Weg führt immer nach unten), x darf beliebig hin und her.
 *           Waagerechte/senkrechte Abschnitte sehen mit 4 Laufrichtungen am besten aus.
 * STATIONS: Reihenfolge = Scroll-Reihenfolge. `waypoint` ist der Index in PATH,
 *           an dem die Figur für diese Station stehen bleibt. Das Gebäude steht direkt darüber.
 */
import type { Point } from '../lib/path';

export type Side = 'left' | 'right';
export type Facing = 'down' | 'left' | 'right' | 'up';
/** Gebäude-Grafik in public/assets/buildings/<typ>.png, Größen in src/data/map.ts (BUILDINGS) */
export type BuildingType = 'studio' | 'house' | 'tower' | 'arcade' | 'cinema' | 'tavern' | 'post' | 'door';

export interface Link {
  href: string;
  label: string;
}

export interface Station {
  /** Anker und Kennung, z. B. /#streamplan */
  id: string;
  /** Kurzname für Navigation und Schild auf der Map */
  nav: string;
  title: string;
  kicker?: string;
  text: string;
  bullets?: string[];
  /** Buttons im Inhaltsfenster (externe Links öffnen in neuem Tab) */
  links?: Link[];
  /** Index des Wegpunkts in PATH */
  waypoint: number;
  /** Seite, auf der das Inhaltsfenster neben der Figur erscheint (Desktop) */
  panel: Side;
  /** Blickrichtung der Figur, wenn sie an der Station steht */
  face?: Facing;
  building: BuildingType;
  /** Liste wird durch den Streamplan aus PocketBase ersetzt (falls eingerichtet) */
  schedule?: boolean;
}

export const SOCIALS = {
  twitch: { label: 'Twitch', href: 'https://www.twitch.tv/pixelpixie' },
  discord: { label: 'Discord', href: 'https://discord.gg/pixelpixie' },
  tiktok: { label: 'TikTok', href: 'https://www.tiktok.com/@pixelpixie' },
  youtube: { label: 'YouTube', href: 'https://www.youtube.com/@pixelpixie' },
} as const;

export const SITE = {
  name: 'Pixelpixie',
  /** Name der Figur in Hinweisen („Pixie läuft hinterher …“) */
  hero: 'Pixie',
  tagline: 'Streamerin & Gamerin',
  description:
    'Pixelpixie streamt Cozy Games, Koop-Chaos und Horror-Nächte auf Twitch. Streamplan, Clips, Discord-Community und Kontakt für Kooperationen.',
  email: 'business@example.com',
};

export const PATH: Point[] = [
  { x: 116, y: 150 }, //  0 Start
  { x: 316, y: 150 }, //  1
  { x: 316, y: 236 }, //  2
  { x: 196, y: 236 }, //  3
  { x: 196, y: 372 }, //  4
  { x: 356, y: 372 }, //  5 Über mich
  { x: 428, y: 372 }, //  6
  { x: 428, y: 476 }, //  7
  { x: 300, y: 476 }, //  8
  { x: 300, y: 566 }, //  9
  { x: 146, y: 566 }, // 10 Streamplan
  { x: 68, y: 566 }, //  11
  { x: 68, y: 700 }, //  12
  { x: 236, y: 700 }, // 13 Games & Setup
  { x: 404, y: 700 }, // 14
  { x: 404, y: 790 }, // 15
  { x: 340, y: 790 }, // 16
  { x: 340, y: 868 }, // 17
  { x: 212, y: 868 }, // 18 Clips
  { x: 96, y: 868 }, //  19
  { x: 96, y: 980 }, //  20
  { x: 250, y: 980 }, // 21
  { x: 250, y: 1046 }, // 22
  { x: 342, y: 1046 }, // 23 Community
  { x: 420, y: 1046 }, // 24
  { x: 420, y: 1160 }, // 25
  { x: 180, y: 1160 }, // 26 Kontakt
  { x: 64, y: 1160 }, //  27
  { x: 64, y: 1290 }, //  28
  { x: 300, y: 1290 }, // 29
  { x: 300, y: 1460 }, // 30
  { x: 240, y: 1460 }, // 31 Tür am Ende des Wegs
];

export const STATIONS: Station[] = [
  {
    id: 'start',
    nav: 'Start',
    title: 'Hey, ich bin Pixie!',
    kicker: SITE.tagline,
    text: 'Cozy Games, Koop-Chaos und ab und zu ein Horror-Abend. Scroll los, meine Figur zeigt dir mein kleines Pixelreich.',
    links: [{ href: SOCIALS.twitch.href, label: 'Zum Twitch-Kanal' }],
    waypoint: 0,
    panel: 'right',
    face: 'down',
    building: 'studio',
  },
  {
    id: 'ueber-mich',
    nav: 'Über mich',
    title: 'Über mich',
    kicker: 'Wer streamt hier?',
    text: 'Seit 2019 sitze ich fast jeden Abend vor der Kamera. Am liebsten spiele ich Indie-Perlen und Koop-Games mit meinem Chat.',
    bullets: ['Cozy, Indie & Roguelikes', 'Streams auf Deutsch', 'Chat first: Fragen sind immer willkommen'],
    waypoint: 5,
    panel: 'left',
    face: 'up',
    building: 'house',
  },
  {
    id: 'streamplan',
    nav: 'Streamplan',
    title: 'Streamplan',
    kicker: 'Wann bin ich live?',
    text: 'Änderungen und Sonder-Streams kündige ich zuerst auf Discord an.',
    bullets: ['Mo 19–23 Uhr · Cozy Montag', 'Mi 19–23 Uhr · Koop mit der Community', 'Fr 20–01 Uhr · Horror Night', 'So 15–19 Uhr · Just Chatting & Indies'],
    links: [{ href: SOCIALS.twitch.href, label: 'Auf Twitch folgen' }],
    waypoint: 10,
    panel: 'right',
    face: 'up',
    building: 'tower',
    schedule: true,
  },
  {
    id: 'games',
    nav: 'Games',
    title: 'Games & Setup',
    kicker: 'Was läuft gerade?',
    text: 'Aktuell im Rotationsplan: Farming-Sims, Dungeon-Crawler und alles, was zu viert im Chaos endet.',
    bullets: ['Lieblingsgenre: Roguelikes', 'Wunschspiele gern per Kanalpunkte', 'Setup: PC, Facecam, Stream Deck'],
    waypoint: 13,
    panel: 'right',
    face: 'up',
    building: 'arcade',
  },
  {
    id: 'clips',
    nav: 'Clips',
    title: 'Clips & Highlights',
    kicker: 'Verpasst?',
    text: 'Die besten Fails und Clutch-Momente gibt es als Shorts auf TikTok und als Highlights auf YouTube.',
    links: [
      { href: SOCIALS.tiktok.href, label: 'TikTok' },
      { href: SOCIALS.youtube.href, label: 'YouTube' },
    ],
    waypoint: 18,
    panel: 'right',
    face: 'up',
    building: 'cinema',
  },
  {
    id: 'community',
    nav: 'Community',
    title: 'Community & Discord',
    kicker: 'Komm in die Taverne',
    text: 'Im Discord planen wir Koop-Runden, teilen Fanart und quatschen auch dann, wenn ich offline bin.',
    bullets: ['Monatliche Game-Nights', 'Fanart- und Clip-Channel', 'Freundliche Mods, klare Regeln'],
    links: [{ href: SOCIALS.discord.href, label: 'Discord beitreten' }],
    waypoint: 23,
    panel: 'left',
    face: 'up',
    building: 'tavern',
  },
  {
    id: 'kontakt',
    nav: 'Kontakt',
    title: 'Kontakt & Kooperationen',
    kicker: 'Business',
    text: 'Brand-Deals, Events oder eine Collab? Schreib mir, ich melde mich innerhalb von ein paar Tagen.',
    bullets: [SITE.email, 'Mediakit auf Anfrage'],
    links: [{ href: '/kontakt', label: 'Anfrage senden' }],
    waypoint: 26,
    panel: 'right',
    face: 'up',
    building: 'post',
  },
];

/**
 * Tür am Ende des Wegs, direkt über dem Footer. Die Figur läuft hin, wenn man ganz nach unten
 * scrollt, und die Tür geht auf. Kein Inhaltsfenster, kein Eintrag in der Navigation.
 */
export const EXIT: Pick<Station, 'id' | 'nav' | 'waypoint' | 'face' | 'building'> = {
  id: 'ausgang',
  nav: 'Bis bald!',
  waypoint: 31,
  face: 'up',
  building: 'door',
};
