<template>
  <q-layout view="hHr LpR fFr">
    <!-- 頂部欄包含 Logo 和水平選單 -->
    <q-header>
      <!-- 第一行：Logo 和用戶選單 -->
      <base-topbar></base-topbar>

      <!-- 第二行：水平導航選單 -->
      <horizontal-menu></horizontal-menu>
    </q-header>

    <!-- 設定面板 -->
    <q-dialog v-model="layoutStore.isSettingPanelOpen" position="right" maximized no-shake>
      <setting-panel></setting-panel>
    </q-dialog>

    <!-- 主要內容區域 -->
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
import { useLayoutStore } from '@/stores/useLayout'
import HorizontalMenu from '@/layouts/HorizontalMenu.vue'
import SettingPanel from '@/layouts/SettingPanel.vue'
import BaseTopbar from '@/layouts/BaseTopbar.vue'

const layoutStore = useLayoutStore()
</script>
