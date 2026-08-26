// package.json 的 engines 只在 npm install / npm ci 時驗證，
// 此腳本補上執行期（dev / build）的檢查，判斷範圍與 engines 保持一致。
// 由 package.json 的 predev / prebuild 自動執行。
import { readFileSync } from 'node:fs'

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// 只處理 ^x.y.z 形式（目前為 ^24.16.0，等同 >=24.16.0 <25.0.0）
const [requiredMajor, requiredMinor] = engines.node.replace(/^\^/, '').split('.').map(Number)
const [major, minor] = process.versions.node.split('.').map(Number)

if (major !== requiredMajor || minor < requiredMinor) {
  console.error(`\n✖ 此專案需要 Node.js ${engines.node}，目前為 v${process.versions.node}`)
  console.error(`  請執行： nvm use ${requiredMajor}.${requiredMinor}.0\n`)
  process.exit(1)
}
