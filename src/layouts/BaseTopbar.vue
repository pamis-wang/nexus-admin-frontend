<template>
  <q-toolbar v-bind:class="layoutStore.getTopbarColorClass()">
    <!-- 左側區域：根據佈局模式顯示不同內容 -->
    <!-- Vertical Layout: 顯示選單按鈕 -->
    <q-btn
      v-if="layoutStore.layoutConfig.layout === 'vertical'"
      dense
      flat
      round
      icon="mdi-menu"
      data-tour="topbar-menu-toggle"
      @click="$emit('toggleLeftDrawer')"
    />

    <!-- Horizontal Layout: 顯示品牌標誌 -->
    <div v-if="layoutStore.layoutConfig.layout === 'horizontal'" class="flex items-center q-mr-md">
      <img :src="logoLockupSrc" :alt="t('layout.appTitle')" :style="{ height: `${siteConfig.logoHeight.topbar}px`, width: 'auto' }" />
    </div>

    <q-toolbar-title></q-toolbar-title>

    <locale-switcher class="q-mr-sm" />

    <q-btn dense flat round icon="mdi-compass-outline" class="q-mr-sm" data-tour="topbar-tour-entry">
      <q-tooltip>{{ t('tour.entry') }}</q-tooltip>
      <!-- 捲動交給 q-menu 預設的 max-height；q-list 再設 max-height 會出現兩條捲軸 -->
      <q-menu>
        <q-list style="min-width: 300px">
          <template v-for="group in tourStore.tourGroups" :key="group.key">
            <q-separator v-if="group !== tourStore.tourGroups[0]" />

            <q-item-label header class="text-primary text-weight-medium">{{ resolveTourText(group.name) }}</q-item-label>

            <q-item
              v-for="tour in group.tours"
              :key="tour.id"
              clickable
              v-close-popup
              :disable="!tourStore.canStartTour(tour.id)"
              v-on:click="handleStartTour(tour.id)"
            >
              <q-item-section>
                <q-item-label>{{ resolveTourText(tour.name) }}</q-item-label>
                <q-item-label caption>{{ buildTourHint(tour) }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>

          <q-item v-if="tourStore.tourGroups.length === 0">
            <q-item-section>
              <q-item-label caption>{{ t('tour.empty') }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- 外觀設定：站別關閉時版面固定用預設外觀，兩顆按鈕都不顯示 -->
    <template v-if="siteConfig.features.themeSettings">
      <!-- 色彩方案切換：點擊依序切換亮色／暗色／跟隨系統，與主題設定面板的「色彩方案」同一設定 -->
      <q-btn dense flat round v-bind:icon="currentColorSchemeIcon" class="q-mr-sm" @click="layoutStore.cycleColorScheme()">
        <q-tooltip>{{ colorSchemeTooltip }}</q-tooltip>
      </q-btn>

      <q-btn dense flat round icon="mdi-cog-outline" class="q-mr-sm" @click="layoutStore.toggleSettingPanel()">
        <q-tooltip>{{ t('shell.themeSettings.title') }}</q-tooltip>
      </q-btn>
    </template>

    <q-btn-dropdown flat dense no-caps dropdown-icon="none" class="q-px-none q-py-none" data-tour="topbar-user-menu">
      <template v-slot:label>
        <div class="row items-center no-wrap q-gutter-x-sm">
          <q-avatar>
            <q-icon name="mdi-account" color="white" size="sm" class="bg-primary rounded-borders" />
          </q-avatar>
          <div class="column items-start">
            <div>{{ displayName }}</div>
            <div v-if="activeRoleNames !== ''" class="text-caption topbar-role-caption">{{ activeRoleNames }}</div>
          </div>
        </div>
      </template>

      <q-list style="min-width: 240px">
        <template v-if="siteConfig.features.roleSwitch">
          <q-item-label header v-bind:class="{ 'q-pb-none': isSingleRole }">
            {{ isUnionMode ? t('shell.role.activeRolesTitle') : t('shell.role.switchTitle') }}
          </q-item-label>
          <!-- 只被指派一個角色時沒有東西可切，角色不可點，說明為什麼 -->
          <q-item-label v-if="isSingleRole" caption class="q-px-md q-pb-sm">{{ t('shell.role.singleRoleHint') }}</q-item-label>

          <!-- 稽核模式一次只有一個角色生效（單選）；聯集模式點選是加入或移出生效角色（複選）。點角色不關選單，可以連續勾選 -->
          <q-item
            v-for="role in roles"
            :key="role.id"
            :clickable="canSwitchRoles"
            :disable="isChangingRoles"
            :active="isActiveRole(role.id)"
            @click="handleRoleClick(role.id)"
          >
            <q-item-section avatar>
              <q-icon :name="buildRoleIcon(role.id)" :color="isActiveRole(role.id) ? 'primary' : 'grey'" size="xs" />
            </q-item-section>
            <q-item-section>{{ role.name }}</q-item-section>
          </q-item>

          <q-item v-if="roles.length === 0">
            <q-item-section>
              <q-item-label caption>{{ t('shell.role.noRoles') }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator />
        </template>
        <q-item-label v-else header>{{ t('shell.welcome') }}</q-item-label>

        <!-- 站別的額外連結，例如個人的金鑰設定 -->
        <template v-if="siteConfig.userMenuLinks.length > 0">
          <q-item-label header>{{ t('shell.personalSettings') }}</q-item-label>

          <q-item v-for="link in siteConfig.userMenuLinks" :key="link.routeName" clickable v-close-popup :to="{ name: link.routeName }">
            <q-item-section>
              <q-item-label class="flex items-center">
                <q-icon :name="link.icon" size="xs" class="q-mr-sm" />
                {{ t(`menu.${link.title}`) }}
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-separator />
        </template>

        <q-item clickable v-close-popup v-bind:disable="isLoggingOut" @click="handleLogout">
          <q-item-section>
            <q-item-label class="flex items-center">
              <q-icon name="mdi-logout" size="xs" class="q-mr-sm" />
              {{ t('shell.logout') }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
  </q-toolbar>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { siteConfig } from '@/config/site'
import { useLayoutStore } from '@/stores/useLayout'
import { useUserStore } from '@/stores/useUser'
import { useTourStore } from '@/stores/useTour'
import { resolveTourText } from '@/tours'
import { useAuthentication } from '@/composables/useAuthentication'
import { useNotify } from '@/composables/useNotify'
import logoLockupBlue from '@/assets/images/brand-lockup-blue.svg'
import logoLockupWhite from '@/assets/images/brand-lockup-white.svg'
import type { LayoutConfig } from '@/types/layout'
import type { TourDefinition } from '@/types/tour'

defineEmits<{
  toggleLeftDrawer: []
}>()

/** 各色彩方案的圖示 */
const COLOR_SCHEME_ICONS: Record<LayoutConfig['colorScheme'], string> = {
  light: 'mdi-weather-sunny',
  dark: 'mdi-weather-night',
  system: 'mdi-monitor',
}

const layoutStore = useLayoutStore()
const userStore = useUserStore()
const tourStore = useTourStore()
const { t } = useI18n()
const { authorization, displayName } = storeToRefs(userStore)
const { isLoggingOut, isChangingRoles, logout, changeActiveRoles } = useAuthentication()
const notify = useNotify()

// 頂部欄背景是亮色時用藍色版標誌，暗色／品牌色背景用白色版以維持對比
const logoLockupSrc = computed(() => (layoutStore.layoutConfig.topbarColor === 'light' ? logoLockupBlue : logoLockupWhite))
// 按鈕顯示「目前選擇」的方案，故 system 顯示螢幕圖示而非實際生效的亮／暗
const currentColorSchemeIcon = computed(() => COLOR_SCHEME_ICONS[layoutStore.layoutConfig.colorScheme])
// 三段循環光看圖示不易理解，tooltip 同時說明目前方案與下一次點擊的結果
const colorSchemeTooltip = computed(() =>
  t('shell.colorScheme.tooltip', {
    current: t(`shell.colorScheme.${layoutStore.layoutConfig.colorScheme}`),
    next: t(`shell.colorScheme.${layoutStore.nextColorScheme}`),
  })
)
/** 擁有的全部角色 */
const roles = computed(() => authorization.value?.roles ?? [])
/** 目前生效的角色唯一編號 */
const activeRoleIds = computed<string[]>(() => (authorization.value?.activeRoles ?? []).map((role) => role.id))
/** 生效角色的名稱，顯示在用戶名稱底下；多個以頓號串接 */
const activeRoleNames = computed(() => (authorization.value?.activeRoles ?? []).map((role) => role.name).join(t('shell.role.separator')))
const isUnionMode = computed(() => authorization.value?.permissionMode === 'union')
/** 只被指派一個角色 */
const isSingleRole = computed(() => roles.value.length === 1)
/** 被指派兩個以上的角色才有東西可切 */
const canSwitchRoles = computed(() => roles.value.length > 1)

onMounted(() => {
  layoutStore.initColorScheme()
})

/**
 * 啟動指定導覽；手動開啟不受「已看過」限制
 * @param tourId 導覽識別碼
 */
async function handleStartTour(tourId: string) {
  await tourStore.startTour(tourId)
}

async function handleLogout() {
  await logout()
}

/**
 * 點選角色：稽核模式切換成這個角色，聯集模式把它加入或移出生效角色
 *
 * 切換後目前頁面沒有權限時，由 changeActiveRoles 導向 403
 * @param roleId 點選的角色唯一編號
 */
async function handleRoleClick(roleId: string) {
  if (!canSwitchRoles.value || isChangingRoles.value) return

  const nextRoleIds = buildNextActiveRoleIds(roleId)
  if (nextRoleIds === null) {
    notify.notifyWarning(t('shell.role.keepOneActive'))
    return
  }
  if (nextRoleIds.length === activeRoleIds.value.length && nextRoleIds.every((id) => activeRoleIds.value.includes(id))) {
    return
  }

  const result = await changeActiveRoles(nextRoleIds)
  if (result.success) {
    notify.notifySuccess(result.message)
  } else {
    notify.notifyError(result.message, 0)
  }
}

/**
 * 角色是否生效中
 * @param roleId 角色唯一編號
 */
function isActiveRole(roleId: string): boolean {
  return activeRoleIds.value.includes(roleId)
}

/**
 * 角色選項的圖示：稽核模式為單選鈕、聯集模式為核取方塊
 * @param roleId 角色唯一編號
 */
function buildRoleIcon(roleId: string): string {
  if (isUnionMode.value) return isActiveRole(roleId) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'

  return isActiveRole(roleId) ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'
}

/**
 * 算出點選角色後的生效角色
 *
 * 後端要求至少一個生效角色，聯集模式移出最後一個時回傳 null
 * @param roleId 點選的角色唯一編號
 * @returns 新的生效角色；不允許變更時為 null
 */
function buildNextActiveRoleIds(roleId: string): string[] | null {
  if (!isUnionMode.value) return [roleId]
  if (!isActiveRole(roleId)) return [...activeRoleIds.value, roleId]

  const remainingRoleIds = activeRoleIds.value.filter((activeRoleId) => activeRoleId !== roleId)
  return remainingRoleIds.length > 0 ? remainingRoleIds : null
}

/**
 * 導覽在選單上的說明文字
 * @param tour 導覽定義
 * @returns 說明文字
 */
function buildTourHint(tour: TourDefinition): string {
  const blockedHint = tourStore.resolveStartBlockedHint(tour.id)
  if (blockedHint !== null) return blockedHint

  return tourStore.hasSeenTour(tour.id) ? t('tour.hint.seen') : t('tour.hint.unseen')
}
</script>

<style scoped>
/* 生效角色疊在頂部列底色上，沿用文字顏色、降低不透明度區分層次，亮色與深色頂部列都看得清楚 */
.topbar-role-caption {
  line-height: 1.2;
  opacity: 0.8;
}
</style>
