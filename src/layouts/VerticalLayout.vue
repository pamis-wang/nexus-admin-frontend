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
      <vertical-menu v-bind:mini-mode-state="miniModeState" v-bind:mini-expand-state="miniExpandState"></vertical-menu>
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
/** 是否啟用 mini（icon-only）收合能力：常駐收合設定或小螢幕時皆啟用 */
const miniModeState = ref(false)
/** 目前是否呈現展開狀態（顯示文字），mini 能力關閉時視為恆展開 */
const miniExpandState = ref(true)

// Sidebar Size 設定與螢幕寬度共同決定側邊欄的收合能力，並在切換時重置展開狀態
watch(
  () => [layoutStore.layoutConfig.sidebarSize, $q.screen.lt.md] as const,
  ([sidebarSize, isSmallScreen]) => {
    miniModeState.value = isSmallScreen || sidebarSize === 'sm-hover'
    miniExpandState.value = !miniModeState.value
  },
  { immediate: true },
)

/** 點擊選單按鈕：小螢幕時僅暫時展開/收合；桌面時在「常駐展開」與「常駐收合」設定間切換 */
function toggleLeftDrawer() {
  if ($q.screen.lt.md) {
    miniExpandState.value = !miniExpandState.value
    return
  }
  layoutStore.setSidebarSize(layoutStore.layoutConfig.sidebarSize === 'default' ? 'sm-hover' : 'default')
}

/** 滑鼠移入/移出：僅有啟用 mini 能力時才需要 hover 展開 */
function expandMiniMenu() {
  if (miniModeState.value) {
    miniExpandState.value = !miniExpandState.value
  }
}
</script>
