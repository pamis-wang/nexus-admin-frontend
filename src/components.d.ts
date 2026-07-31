export {}
declare module 'vue' {
  export interface GlobalComponents {
    // 在這裡加入全局組件給 ESLint 識別
    XIcon: typeof import('@/components/XIcon.vue').default
    XTable: typeof import('@/components/XTable.vue').default
    XBreadcrumb: typeof import('@/components/XBreadcrumb.vue').default
    XLoadingState: typeof import('@/components/XLoadingState.vue').default
  }
}
