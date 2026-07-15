import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const apiOrigin = process.env.A3S_CODE_API_ORIGIN ?? 'http://127.0.0.1:29653';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  html: {
    title: 'A3S Code',
    favicon: './public/logo.png',
    meta: {
      description: 'A3S Code in your browser',
      'theme-color': '#f7f8fb',
    },
  },
  output: {
    cleanDistPath: true,
    distPath: {
      root: 'dist/workspace',
    },
    assetPrefix: '/',
  },
  server: {
    port: Number(process.env.A3S_CODE_WEB_DEV_PORT ?? 3000),
    proxy: {
      '/api': {
        target: apiOrigin,
        changeOrigin: true,
      },
    },
  },
});
