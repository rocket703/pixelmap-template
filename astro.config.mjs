import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Eigene Domain eintragen – daraus entstehen Canonicals, OG-URLs, Sitemap und robots.txt.
  // Für Vorschau-Builds (GitHub Pages) setzt der Workflow SITE_URL und BASE_PATH automatisch.
  site: process.env.SITE_URL || 'https://www.example.com',
  // Unterordner, falls die Seite nicht im Hauptverzeichnis liegt (z. B. '/pixelmap-template')
  base: process.env.BASE_PATH || '/',
  output: 'static',
  // Saubere Adressen ohne Schrägstrich am Ende (/kontakt statt /kontakt/)
  trailingSlash: 'never',
  build: { format: 'file' },
  compressHTML: true,
  integrations: [
    sitemap({
      // Rechtliche Seiten stehen auf noindex und gehören nicht in die Sitemap
      filter: (page) => !/\/(impressum|datenschutz)$/.test(page),
    }),
  ],
});
