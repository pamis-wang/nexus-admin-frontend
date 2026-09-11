<template>
  <q-toolbar v-bind:class="layoutStore.getTopbarColorClass()">
    <!-- 左側區域：根據佈局模式顯示不同內容 -->
    <!-- Vertical Layout: 顯示選單按鈕 -->
    <q-btn v-if="layoutStore.layoutConfig.layout === 'vertical'" dense flat round icon="mdi-menu" @click="$emit('toggleLeftDrawer')" />

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
            <q-icon name="mdi-account" color="white" size="sm" class="bg-primary rounded-borders" />
          </q-avatar>
          <div>{{ displayName }}</div>
        </div>
      </template>

      <q-list style="min-width: 240px">
        <!-- 生效角色：權限依這些角色判斷，切換後選單與可進入的頁面會跟著變 -->
        <q-item-label header class="q-pb-none">生效角色</q-item-label>
        <div class="q-px-md q-pb-sm text-caption text-grey-7">{{ roleModeHint }}</div>

        <q-item v-if="assignedRoles.length === 0" dense>
          <q-item-section class="text-caption text-grey-6">未指派任何角色，登入後沒有權限</q-item-section>
        </q-item>

        <q-item
          v-for="role in assignedRoles"
          :key="role.id"
          dense
          :clickable="canSwitchRoles"
          :disable="isSwitchingActiveRoles"
          @click="handleRoleClick(role.id)"
        >
          <q-item-section avatar class="q-pr-none" style="min-width: 32px">
            <q-icon :name="isRoleActive(role.id) ? 'mdi-check-circle' : 'mdi-circle-outline'" :color="isRoleActive(role.id) ? 'primary' : 'grey-5'" size="xs" />
          </q-item-section>
          <q-item-section>{{ role.name }}</q-item-section>
        </q-item>

        <q-separator class="q-my-xs" />

        <q-item clickable v-close-popup v-bind:disable="isLoggingOut" @click="handleLogout">
          <q-item-section>
            <q-item-label class="flex items-center">
              <q-icon name="mdi-logout" size="xs" class="q-mr-sm" />
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
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLayoutStore } from '@/stores/useLayout'
import { useUserStore } from '@/stores/useUser'
import { useAuthentication } from '@/composables/useAuthentication'
import { useNotify } from '@/composables/useNotify'
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

const route = useRoute()
const router = useRouter()
const layoutStore = useLayoutStore()
const userStore = useUserStore()
const notify = useNotify()
const { userProfile, assignedRoles, activeRoles, permissionMode } = storeToRefs(userStore)
const { isLoggingOut, isSwitchingActiveRoles, logout, switchActiveRoles } = useAuthentication()

// 頂部欄背景是亮色時用藍色版標誌，暗色／品牌色背景用白色版以維持對比
const logoLockupSrc = computed(() => (layoutStore.layoutConfig.topbarColor === 'light' ? logoLockupBlue : logoLockupWhite))
const displayName = computed(() => userProfile.value?.fullName ?? userProfile.value?.account ?? '')
// 按鈕顯示「目前選擇」的方案，故 system 顯示螢幕圖示而非實際生效的亮／暗
const currentColorScheme = computed(() => COLOR_SCHEMES[layoutStore.layoutConfig.colorScheme])
// 三段循環光看圖示不易理解，tooltip 同時說明目前方案與下一次點擊的結果
const colorSchemeTooltip = computed(() => `色彩方案：${currentColorScheme.value.label}（點擊改為${COLOR_SCHEMES[layoutStore.nextColorScheme].label}）`)
/** 聯集模式可同時生效多個角色；unknown 是後端設定有誤的值，一律當成較嚴的稽核模式 */
const isUnionMode = computed(() => permissionMode.value === 'union')
/** 只被指派一個角色時沒有東西可切 */
const canSwitchRoles = computed(() => assignedRoles.value.length > 1)
const roleModeHint = computed(() => {
  if (assignedRoles.value.length === 0) {
    return ''
  }
  if (!canSwitchRoles.value) {
    return '你只被指派了一個角色'
  }
  return isUnionMode.value ? '可同時生效多個角色，取消勾選即暫時降權' : '一次只有一個角色生效'
})

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

/**
 * 點擊角色，送出變更後的生效角色
 * @param roleId 被點擊的角色唯一編號
 */
async function handleRoleClick(roleId: string) {
  if (!canSwitchRoles.value || isSwitchingActiveRoles.value) {
    return
  }

  const nextRoleIds = buildNextActiveRoleIds(roleId)
  if (nextRoleIds === null) {
    return
  }

  const result = await switchActiveRoles(nextRoleIds)
  if (!result.success) {
    notify.notifyError(result.message, 0)
    return
  }

  // 切換後選單與可進入的頁面都會變，沒有回饋使用者不會知道這次點擊生效了
  notify.notifySuccess(`生效角色已切換為「${activeRoles.value.map((role) => role.name).join('、')}」`)

  // 換角色之後目前這一頁可能已經沒有權限了，留在原地會看到自己無權操作的畫面
  const resourceName = route.meta.resourceName
  if (resourceName !== undefined && !userStore.hasPermission(resourceName)) {
    await router.push({ name: 'error403' })
  }
}

/**
 * 算出點擊後應該生效的角色
 * @param roleId 被點擊的角色唯一編號
 * @returns 要送出的角色清單；null 表示這次點擊不需要送出
 */
function buildNextActiveRoleIds(roleId: string): string[] | null {
  // 稽核模式：一次一個，點目前已生效的那個不做事
  if (!isUnionMode.value) {
    return isRoleActive(roleId) ? null : [roleId]
  }

  const currentRoleIds = activeRoles.value.map((role) => role.id)
  if (!isRoleActive(roleId)) {
    return [...currentRoleIds, roleId]
  }

  // 至少要留一個角色，全部取消會變成完全沒有權限
  if (currentRoleIds.length === 1) {
    return null
  }
  return currentRoleIds.filter((id) => id !== roleId)
}

/**
 * 角色目前是否生效
 * @param roleId 角色唯一編號
 */
function isRoleActive(roleId: string): boolean {
  return activeRoles.value.some((role) => role.id === roleId)
}
</script>
