import type { APIRoute } from 'astro';

// Vorschau-Builds (PUBLIC_NOINDEX=true) sperren Suchmaschinen komplett aus
const preview = import.meta.env.PUBLIC_NOINDEX === 'true';

export const GET: APIRoute = ({ site }) =>
  new Response(preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site)}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
