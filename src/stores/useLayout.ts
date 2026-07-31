/** 用於集中管理佈局狀態 */
import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { useQuasar } from 'quasar'
import type { LayoutConfig } from '@/types/layout'

export const useLayoutStore = defineStore('layout', () => {
  /** 設定面板開關狀態 */
  const isSettingPanelOpen = ref(false)

  /** 初始化佈局設定 */
  const initLayoutConfig = reactive<LayoutConfig>({
    layout: 'vertical',
    colorScheme: 'light',
    topbarColor: 'light',
    menuColor: 'light',
    sidebarSize: 'default',
  })

  /** 宣告佈局設定 */
  const layoutConfig = useStorage<LayoutConfig>('layoutConfig', initLayoutConfig)

  /** Quasar 實例 */
  let $q: ReturnType<typeof useQuasar> | null = null

  /** 初始化 Quasar 實例 */
  function initQuasar(quasarInstance: ReturnType<typeof useQuasar>) {
    $q = quasarInstance
    // 設定初始暗色模式狀態
    $q.dark.set(layoutConfig.value.colorScheme === 'dark')
  }

  /** 重置設定 */
  async function resetConfig() {
    layoutConfig.value = { ...initLayoutConfig }
  }

  /** 切換設定面板 */
  async function toggleSettingPanel() {
    isSettingPanelOpen.value = !isSettingPanelOpen.value
  }

  /** 設定佈局 */
  async function setLayout(value: LayoutConfig['layout']) {
    layoutConfig.value.layout = value
  }

  /** 設定色彩方案 */
  async function setColorScheme(value: LayoutConfig['colorScheme']) {
    layoutConfig.value.colorScheme = value

    // 暗色主題下不允許亮色選單，自動調整
    if (value === 'dark' && layoutConfig.value.menuColor === 'light') {
      layoutConfig.value.menuColor = 'dark'
    }

    // 直接同步到 Quasar
    if ($q) {
      $q.dark.set(value === 'dark')
    }
  }

  /** 設定頂部欄顏色 */
  async function setTopbarColor(value: LayoutConfig['topbarColor']) {
    layoutConfig.value.topbarColor = value
  }

  /** 設定選單顏色 */
  async function setMenuColor(value: LayoutConfig['menuColor']) {
    layoutConfig.value.menuColor = value
  }

  /** 設定側邊選單尺寸 */
  async function setSidebarSize(value: LayoutConfig['sidebarSize']) {
    layoutConfig.value.sidebarSize = value
  }

  /** 根據頂部欄顏色設定返回對應的 CSS 類別 */
  function getTopbarColorClass() {
    switch (layoutConfig.value.topbarColor) {
      case 'light':
        return 'bg-grey-1 text-dark'
      case 'dark':
        return 'bg-grey-9 text-white'
      case 'brand':
      default:
        return 'bg-primary text-white'
    }
  }

  /** 根據選單顏色設定返回對應的 CSS 類別 */
  function getMenuColorClass() {
    switch (layoutConfig.value.menuColor) {
      case 'light':
        return 'bg-grey-1 text-dark'
      case 'dark':
        return 'bg-grey-9 text-white'
      case 'brand':
      default:
        return 'bg-primary text-white'
    }
  }

  return {
    // 狀態
    isSettingPanelOpen,
    layoutConfig,

    // 方法
    initQuasar,
    resetConfig,
    toggleSettingPanel,
    setLayout,
    setColorScheme,
    setTopbarColor,
    setMenuColor,
    setSidebarSize,
    getTopbarColorClass,
    getMenuColorClass,
  }
})
