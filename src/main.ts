import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import quasarPlugin from '@/plugins/quasar'
import customPlugin from '@/plugins/custom'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(quasarPlugin)
app.use(customPlugin)

app.mount('#app')
