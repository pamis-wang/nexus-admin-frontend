import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // 預設的 forks 每個測試檔各開一個 node 程序，Windows 開程序成本高；
      // threads 共用同一個程序，省掉這段開銷。代價是測試內不能用 process.chdir() 與原生模組
      pool: 'threads',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
