import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    vueDevTools(),
    // @quasar/plugin-vite options list:
    // https://github.com/quasarframework/quasar/blob/dev/vite-plugin/index.d.ts
    quasar({
      sassVariables: fileURLToPath(new URL('./src/assets/scss/quasar.variables.scss', import.meta.url)),
    }),
  ],
  // 各站固定自己的開發埠號，同時開發多個前端時不互搶；被佔用時直接失敗，不要自動換到別的埠
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // vue-i18n 的功能旗標：不設定的話瀏覽器 console 會出現警告，也無法在建置時移除用不到的程式碼
  define: {
    __VUE_I18N_FULL_INSTALL__: true, // 保留 $t 等全域屬性
    __VUE_I18N_LEGACY_API__: false, // 本專案只用 Composition API，移除 Legacy API
    __INTLIFY_PROD_DEVTOOLS__: false, // 正式環境不開 devtools
    __INTLIFY_DROP_MESSAGE_COMPILER__: false, // 語系檔是執行期編譯的 JSON，要保留訊息編譯器
  },
  // 拆分 vendor 套件，使各 chunk 低於 500 kB 門檻
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-vue', test: /[/]node_modules[/](vue|vue-router)[/]/ },
            { name: 'vendor-quasar', test: /[/]node_modules[/](quasar|@quasar[/]extras)[/]/ },
          ],
        },
      },
    },
  },
})
