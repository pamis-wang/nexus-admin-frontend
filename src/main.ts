import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import quasarPlugin from '@/plugins/quasar'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(quasarPlugin)

app.mount('#app')
