import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { siteHooks } from '@/config/siteHooks'
import { resolveInitialLocale } from '@/locale'
import { i18n, readStoredLocale, setLocale } from '@/plugins/i18n'

import quasarPlugin from '@/plugins/quasar'
import '@/assets/scss/styles.scss'
import customPlugin from '@/plugins/custom'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(quasarPlugin)
app.use(router)
app.use(customPlugin)

// 要等 Quasar 裝好再切語系，Quasar 語言包才設得進去
setLocale(
  resolveInitialLocale({
    storedLocale: readStoredLocale(),
    browserLanguages: navigator.languages,
  })
)

// 站別的啟動工作（例如已登入就補拉授權狀態）；在 app 的 context 內執行，函式裡才能用 store 與 useRouter
app.runWithContext(() => siteHooks.runSiteStartup())

app.mount('#app')
