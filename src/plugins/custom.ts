import type { App } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XTable from '@/components/XTable.vue'
import XBreadcrumb from '@/components/XBreadcrumb.vue'
import XLoadingState from '@/components/XLoadingState.vue'
import XSwitch from '@/components/XSwitch.vue'
import XPageHeader from '@/components/XPageHeader.vue'
import XSectionHeaderBar from '@/components/XSectionHeaderBar.vue'

/** 全域註冊組件 */
export default {
  install(app: App) {
    app.component('x-icon', XIcon)
    app.component('x-table', XTable)
    app.component('x-breadcrumb', XBreadcrumb)
    app.component('x-loading-state', XLoadingState)
    app.component('x-switch', XSwitch)
    app.component('x-page-header', XPageHeader)
    app.component('x-section-header-bar', XSectionHeaderBar)
  },
}
