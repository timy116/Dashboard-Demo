import { defineConfig } from 'vite'
import { viteExternalsPlugin } from 'vite-plugin-externals'

export default defineConfig({
  base: '/',
  plugins: [
    viteExternalsPlugin({
      echarts: 'echarts',
    })
  ]
  })
