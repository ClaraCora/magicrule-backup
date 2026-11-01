import { loadCatalog } from '../lib/data';
export async function GET() {
  const catalog = await loadCatalog();
  const urls = ['', 'about/', 'updates/', ...catalog.rules.map(rule => `rules/${encodeURIComponent(rule.id)}/`)];
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(url => `<url><loc>https://claracora.github.io/magicrule-backup/${url}</loc></url>`).join('') + '</urlset>', { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
