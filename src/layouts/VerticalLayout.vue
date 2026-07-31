<template>
  <q-layout view="lHr LpR lFr">
    <q-header>
      <base-topbar @toggle-left-drawer="toggleLeftDrawer" />
    </q-header>

    <q-drawer
      v-model="isVerticalMenuOpen"
      v-bind:mini="miniModeState && !miniExpandState"
      v-bind:mini-to-overlay="miniModeState"
      v-bind:width="300"
      v-bind:breakpoint="100"
      v-on:mouseenter="expandMiniMenu"
      v-on:mouseleave="expandMiniMenu"
      bordered
    >
      <vertical-menu v-model:miniModeState="miniModeState" v-model:miniExpandState="miniExpandState"></vertical-menu>
    </q-drawer>

    <!-- 設定面板 -->
    <q-dialog v-model="layoutStore.isSettingPanelOpen" position="right" maximized no-shake>
      <setting-panel></setting-panel>
    </q-dialog>

    <q-page-container style="height: 100vh">
      <q-scroll-area class="fit">
        <q-page class="q-pl-xs q-pr-sm">
          <router-view></router-view>
        </q-page>
      </q-scroll-area>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useLayoutStore } from '@/stores/useLayout'
import BaseTopbar from '@/layouts/BaseTopbar.vue'
import VerticalMenu from '@/layouts/VerticalMenu.vue'
import SettingPanel from '@/layouts/SettingPanel.vue'

const $q = useQuasar()
const layoutStore = useLayoutStore()
const isVerticalMenuOpen = ref(true)
/** 是否啟用 mini（icon-only）收合能力 */
const miniModeState = ref(false)
/** 目前是否呈現展開狀態（顯示文字） */
const miniExpandState = ref(true)

// Sidebar Size 設定與螢幕寬度共同決定側邊欄的初始收合狀態
watch(
  () => [layoutStore.layoutConfig.sidebarSize, $q.screen.lt.md] as const,
  ([sidebarSize, isSmallScreen]) => {
    if (isSmallScreen) {
      miniModeState.value = true
      miniExpandState.value = false
      return
    }
    miniModeState.value = sidebarSize !== 'default'
    miniExpandState.value = sidebarSize === 'default'
  },
  { immediate: true },
)

/** 點擊選單按鈕：僅在有啟用 mini 能力時手動切換展開/收合 */
function toggleLeftDrawer() {
  if (!miniModeState.value) return
  miniExpandState.value = !miniExpandState.value
}

/** 滑鼠移入/移出：僅「滑鼠移入展開」模式需要此行為，常駐收合模式維持 icon-only */
function expandMiniMenu() {
  if (layoutStore.layoutConfig.sidebarSize !== 'sm-hover') return
  if (miniModeState.value) {
    miniExpandState.value = !miniExpandState.value
  }
}
</script>
