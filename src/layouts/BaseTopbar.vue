<template>
  <q-toolbar v-bind:class="layoutStore.getTopbarColorClass()">
    <!-- 左側區域：根據佈局模式顯示不同內容 -->
    <!-- Vertical Layout: 顯示選單按鈕 -->
    <q-btn v-if="layoutStore.layoutConfig.layout === 'vertical'" dense flat round icon="menu" @click="$emit('toggleLeftDrawer')" />

    <!-- Horizontal Layout: 顯示品牌標誌 -->
    <div v-if="layoutStore.layoutConfig.layout === 'horizontal'" class="flex items-center q-mr-md">
      <img :src="logoLockupSrc" alt="logo" style="height: 24px; width: auto" />
    </div>

    <q-toolbar-title></q-toolbar-title>

    <!-- 色彩方案切換：點擊依序切換亮色／暗色／跟隨系統，與主題設定面板的「色彩方案」同一設定 -->
    <q-btn dense flat round v-bind:icon="currentColorScheme.icon" class="q-mr-sm" @click="layoutStore.cycleColorScheme()">
      <q-tooltip>{{ colorSchemeTooltip }}</q-tooltip>
    </q-btn>

    <q-btn dense flat round icon="mdi-cog-outline" class="q-mr-sm" @click="layoutStore.toggleSettingPanel()" />

    <q-btn-dropdown flat dense no-caps dropdown-icon="none" class="q-px-none q-py-none">
      <template v-slot:label>
        <div class="row items-center no-wrap q-gutter-x-sm">
          <q-avatar>
            <q-icon name="person" color="white" size="sm" class="bg-primary rounded-borders" />
          </q-avatar>
          <div>{{ displayName }}</div>
        </div>
      </template>

      <q-list>
        <q-item clickable v-close-popup v-bind:disable="isLoggingOut" @click="handleLogout">
          <q-item-section>
            <q-item-label class="flex items-center">
              <q-icon name="logout" size="xs" class="q-mr-sm" />
              登出
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
  </q-toolbar>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useLayoutStore } from '@/stores/useLayout'
import { useUserStore } from '@/stores/useUser'
import { useAuthentication } from '@/composables/useAuthentication'
import logoLockupBlue from '@/assets/images/nexus-lockup-blue.svg'
import logoLockupWhite from '@/assets/images/nexus-lockup-white.svg'
import type { LayoutConfig } from '@/types/layout'

defineEmits<{
  toggleLeftDrawer: []
}>()

/** 各色彩方案的圖示與名稱 */
const COLOR_SCHEMES: Record<LayoutConfig['colorScheme'], ColorSchemeDisplay> = {
  light: { icon: 'mdi-weather-sunny', label: '亮色主題' },
  dark: { icon: 'mdi-weather-night', label: '暗色主題' },
  system: { icon: 'mdi-monitor', label: '跟隨系統' },
}

const layoutStore = useLayoutStore()
const { userProfile } = storeToRefs(useUserStore())
const { isLoggingOut, logout } = useAuthentication()

// 頂部欄背景是亮色時用藍色版標誌，暗色／品牌色背景用白色版以維持對比
const logoLockupSrc = computed(() => (layoutStore.layoutConfig.topbarColor === 'light' ? logoLockupBlue : logoLockupWhite))
const displayName = computed(() => userProfile.value?.fullName ?? userProfile.value?.account ?? '')
// 按鈕顯示「目前選擇」的方案，故 system 顯示螢幕圖示而非實際生效的亮／暗
const currentColorScheme = computed(() => COLOR_SCHEMES[layoutStore.layoutConfig.colorScheme])
// 三段循環光看圖示不易理解，tooltip 同時說明目前方案與下一次點擊的結果
const colorSchemeTooltip = computed(() => `色彩方案：${currentColorScheme.value.label}（點擊改為${COLOR_SCHEMES[layoutStore.nextColorScheme].label}）`)

interface ColorSchemeDisplay {
  icon: string
  label: string
}

onMounted(() => {
  layoutStore.initColorScheme()
})

async function handleLogout() {
  await logout()
}
</script>
