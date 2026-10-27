/**
 * Linkseite /links („Link in Bio“ für Instagram, TikTok & Co.).
 * Reihenfolge = Reihenfolge der Buttons. Externe Links öffnen in einem neuen Tab.
 */
import { SOCIALS } from './stations';

export type LinkIcon = 'twitch' | 'discord' | 'youtube' | 'tiktok' | 'world' | 'mail';

export interface BioLink {
  href: string;
  label: string;
  /** Zweite Zeile im Button */
  sub?: string;
  icon: LinkIcon;
  /** Hervorgehobener Button (Markenfarbe) */
  featured?: boolean;
}

export const LINKS_PAGE = {
  title: 'Links',
  greeting: 'Na, verlaufen? Hier findest du alle meine Kanäle.',
  /**
   * Profilbild, z. B. '/assets/avatar.jpg' (quadratisch, mind. 320 × 320 px).
   * Leer = die Pixel-Figur von der Map.
   */
  avatar: '',
};

export const LINKS: BioLink[] = [
  { ...SOCIALS.twitch, sub: 'Live: Mo, Mi, Fr & So', icon: 'twitch', featured: true },
  { ...SOCIALS.discord, sub: 'Community-Server · kostenlos beitreten', icon: 'discord' },
  { ...SOCIALS.youtube, sub: 'Highlights & ganze Streams', icon: 'youtube' },
  { ...SOCIALS.tiktok, sub: 'Clips & Shorts', icon: 'tiktok' },
  { href: '/', label: 'Pixelwelt entdecken', sub: 'Meine Website zum Durchlaufen', icon: 'world' },
  { href: '/kontakt', label: 'Business & Kooperationen', icon: 'mail' },
];
