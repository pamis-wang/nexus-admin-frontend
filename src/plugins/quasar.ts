import type { App } from 'vue'
import { Quasar, Dialog, Loading, LoadingBar, Notify } from 'quasar'
// Quasar 內建元件（下拉箭頭、分頁、展開、清除鈕）預設用 Material Icons；
// 圖示字型只載 mdi-v7，內建圖示也要換成同一套，否則會顯示成英文字
import iconSet from 'quasar/icon-set/mdi-v7'

// 字型與圖示：規範只用 Material Design Icons（mdi- 前綴）
import '@quasar/extras/roboto-font-latin-ext/roboto-font-latin-ext.css'
import '@quasar/extras/mdi-v7/mdi-v7.css'

// Import Quasar css
import 'quasar/src/css/index.sass'

export default {
  install: (app: App) => {
    app.use(Quasar, {
      plugins: { Dialog, Loading, LoadingBar, Notify }, // import Quasar plugins and add here
      iconSet,

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
