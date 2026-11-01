export function GET() {
  return new Response('User-agent: *\nAllow: /\nSitemap: https://claracora.github.io/magicrule-backup/sitemap.xml\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
