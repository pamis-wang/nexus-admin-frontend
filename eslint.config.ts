import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginVueI18n from '@intlify/eslint-plugin-vue-i18n'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  // 全站介面已改用 vue-i18n，禁止在模板寫死使用者看得到的文字，避免新程式碼又漏翻譯。
  // 只開 no-raw-text 一條：外掛的 recommended 還會開 key 存在性檢查，需要另設語系目錄；
  // key 是否存在已由 src/__tests__/locale/index.spec.ts 把關。
  // src/pages/Development/ 是開發者展示頁，刻意不翻譯，所以排除。
  {
    name: 'app/vue-i18n-no-raw-text',
    files: ['src/**/*.vue'],
    ignores: ['src/pages/Development/**'],
    plugins: {
      '@intlify/vue-i18n': pluginVueI18n,
    },
    rules: {
      '@intlify/vue-i18n/no-raw-text': [
        'error',
        {
          // 外掛預設只檢查文字節點、不檢查任何屬性；補上會顯示給使用者的文字屬性，擋住 label="姓名" 這類寫法
          attributes: {
            '/.+/': [
              'label',
              'title',
              'placeholder',
              'hint',
              'caption',
              'tooltip',
              'message',
              'aria-label',
              'error-message',
              'active-text',
              'inactive-text',
              'no-data-label',
              'no-results-label',
              'loading-label',
              'rows-per-page-label',
              'prefix',
              'suffix',
            ],
          },
          // 完全不含任何文字（\p{L}）的內容不需翻譯：空字串、必填星號、✓ ✗、冒號、括號、~、$、錯誤碼 403 等
          ignorePattern: '^[^\\p{L}]*$',
          // 不隨語系改變的固定字樣：幣別符號
          ignoreText: ['NT$'],
        },
      ],
    },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/__tests__/**/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting
)
