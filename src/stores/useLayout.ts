/** 用於集中管理佈局狀態 */
import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { Dark } from 'quasar'
import type { LayoutConfig } from '@/types/layout'

/** 點擊頂部欄按鈕時的色彩方案循環順序：亮色 → 暗色 → 跟隨系統 → 亮色 */
const NEXT_COLOR_SCHEME: Record<LayoutConfig['colorScheme'], LayoutConfig['colorScheme']> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

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

  /** 目前是否實際處於暗色：colorScheme 為 'system' 時由作業系統偏好決定，故不可只看設定值 */
  const isDarkActive = computed(() => Dark.isActive)

  /** 下一個色彩方案：供頂部欄按鈕的說明文字使用 */
  const nextColorScheme = computed(() => NEXT_COLOR_SCHEME[layoutConfig.value.colorScheme])

  // 暗色生效時亮色選單對比不足，自動改為暗色選單（含 'system' 下作業系統偏好變動）
  watch(isDarkActive, (isDark) => {
    if (isDark && layoutConfig.value.menuColor === 'light') {
      layoutConfig.value.menuColor = 'dark'
    }
  })

  /** 套用色彩方案到 Quasar：'system' 對應 Quasar 的 'auto'，會跟隨作業系統偏好自動更新 */
  function applyColorScheme(value: LayoutConfig['colorScheme']) {
    Dark.set(value === 'system' ? 'auto' : value === 'dark')
  }

  /** 初始化色彩方案：把儲存的設定套用到 Quasar */
  function initColorScheme() {
    applyColorScheme(layoutConfig.value.colorScheme)
  }

  /** 重置設定 */
  async function resetConfig() {
    layoutConfig.value = { ...initLayoutConfig }
    applyColorScheme(layoutConfig.value.colorScheme)
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

    // 直接同步到 Quasar，選單顏色由 isDarkActive 的 watch 負責調整
    applyColorScheme(value)
  }

  /** 依序切換色彩方案：亮色 → 暗色 → 跟隨系統 → 亮色 */
  async function cycleColorScheme() {
    await setColorScheme(nextColorScheme.value)
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
    isDarkActive,
    nextColorScheme,

    // 方法
    initColorScheme,
    resetConfig,
    toggleSettingPanel,
    setLayout,
    setColorScheme,
    cycleColorScheme,
    setTopbarColor,
    setMenuColor,
    setSidebarSize,
    getTopbarColorClass,
    getMenuColorClass,
  }
})
