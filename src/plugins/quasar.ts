import type { App } from 'vue'
import { Quasar, Dialog, Loading, LoadingBar, Notify } from 'quasar'

// Import icon libraries
import '@quasar/extras/roboto-font-latin-ext/roboto-font-latin-ext.css'
import '@quasar/extras/material-icons/material-icons.css'
import '@quasar/extras/material-icons-outlined/material-icons-outlined.css'
import '@quasar/extras/material-icons-round/material-icons-round.css'
import '@quasar/extras/material-icons-sharp/material-icons-sharp.css'
import '@quasar/extras/material-symbols-outlined/material-symbols-outlined.css'
import '@quasar/extras/material-symbols-rounded/material-symbols-rounded.css'
import '@quasar/extras/material-symbols-sharp/material-symbols-sharp.css'
import '@quasar/extras/mdi-v7/mdi-v7.css'
import '@quasar/extras/fontawesome-v7/fontawesome-v7.css'
import '@quasar/extras/ionicons-v4/ionicons-v4.css'
import '@quasar/extras/eva-icons/eva-icons.css'
import '@quasar/extras/themify/themify.css'
import '@quasar/extras/line-awesome/line-awesome.css'
import '@quasar/extras/bootstrap-icons/bootstrap-icons.css'

// Import Quasar css
import 'quasar/src/css/index.sass'

export default {
  install: (app: App) => {
    app.use(Quasar, {
      plugins: { Dialog, Loading, LoadingBar, Notify }, // import Quasar plugins and add here

      config: {
        loading: {
          delay: 500,
        } /* look at QuasarConfOptions from the API card */,
        loadingBar: {
          position: 'bottom',
        } /* look at QuasarConfOptions from the API card */,
        notify: {
          color: 'primary',
        } /* look at QuasarConfOptions from the API card */,
        dark: false,
      },
    })
  },
}
