import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://claracora.github.io',
  base: '/magicrule-backup',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  vite: { server: { watch: { ignored: ['**/.cache/**'] } } },
});
