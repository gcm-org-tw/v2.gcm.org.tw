import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://gcm.org.tw',
  output: 'static',
  // 網址保留鐵則：舊站（WordPress）所有網址皆以 / 結尾，且為目錄式。
  // 這兩項一改，1,300+ 條既有網址全斷，勿動。
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
});
