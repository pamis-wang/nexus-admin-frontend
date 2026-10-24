<template>
  <q-scroll-area class="fit" v-bind:class="layoutStore.getMenuColorClass()">
    <q-toolbar class="flex justify-center">
      <router-link :to="{ name: 'home' }" class="logo-container">
        <img v-if="props.miniModeState && !props.miniExpandState" :src="logoMarkSrc" :alt="t('layout.appTitle')" class="logo-mark" :style="logoStyle" />
        <img v-else :src="logoLockupSrc" :alt="t('layout.appTitle')" class="logo-lockup" :style="logoStyle" />
      </router-link>
    </q-toolbar>

    <q-list data-tour="sidebar-menu">
      <template v-for="item in visibleMenuRoutes" :key="item.name">
        <!-- 無子選單的項目 -->
        <template v-if="!hasVisibleChildren(item)">
          <q-item clickable v-ripple exact :to="{ name: item.name }" :data-tour="buildMenuAnchor(item.name)">
            <q-item-section avatar>
              <q-icon :name="item.meta?.icon" />
            </q-item-section>
            <q-item-section>{{ buildMenuTitle(item) }}</q-item-section>
          </q-item>
        </template>
        <!-- 有子選單的項目 -->
        <template v-else>
          <q-expansion-item
            v-model="expansionStates[String(item.name)]"
            :icon="item.meta?.icon"
            :label="buildMenuTitle(item)"
            :content-inset-level="0.5"
            :data-tour="buildMenuAnchor(item.name)"
          >
            <q-list>
              <!-- 第二層選單 -->
              <template v-for="child in item.children" :key="child.name">
                <!-- 無子選單的項目 -->
                <template v-if="!hasVisibleChildren(child)">
                  <q-item clickable v-ripple :to="{ name: child.name }" :active="isMenuItemActive(child.name)" :data-tour="buildMenuAnchor(child.name)">
                    <q-item-section avatar>
                      <q-icon v-if="child.meta?.icon" :name="child.meta?.icon" />
                    </q-item-section>
                    <q-item-section>{{ buildMenuTitle(child) }}</q-item-section>
                  </q-item>
                </template>
                <!-- 有子選單的項目 (第三層) -->
                <template v-else>
                  <q-expansion-item
                    v-model="expansionStates[String(child.name)]"
                    :icon="child.meta?.icon"
                    :label="buildMenuTitle(child)"
                    :content-inset-level="0.5"
                    :data-tour="buildMenuAnchor(child.name)"
                  >
                    <q-list>
                      <!-- 第三層選單 -->
                      <template v-for="grandChild in child.children" :key="grandChild.name">
                        <q-item
                          clickable
                          v-ripple
                          :to="{ name: grandChild.name }"
                          :active="isMenuItemActive(grandChild.name)"
                          :data-tour="buildMenuAnchor(grandChild.name)"
                        >
                          <q-item-section avatar>
                            <q-icon v-if="grandChild.meta?.icon" :name="grandChild.meta?.icon" />
                          </q-item-section>
                          <q-item-section>
                            {{ buildMenuTitle(grandChild) }}
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-list>
                  </q-expansion-item>
                </template>
              </template>
            </q-list>
          </q-expansion-item>
        </template>
      </template>
    </q-list>
  </q-scroll-area>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '@/config/site'
import { siteHooks } from '@/config/siteHooks'
import { useLayoutStore } from '@/stores/useLayout'
import { filterMenuRoutes, menuRoutes } from '@/router/routes'
import logoMarkBlue from '@/assets/images/brand-mark-blue.svg'
import logoMarkWhite from '@/assets/images/brand-mark-white.svg'
import logoLockupBlue from '@/assets/images/brand-lockup-blue.svg'
import logoLockupWhite from '@/assets/images/brand-lockup-white.svg'
import type { RouteRecordRaw } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const layoutStore = useLayoutStore()

interface Props {
  miniModeState: boolean
  miniExpandState: boolean
}

const props = defineProps<Props>()

const expansionStates = ref<Record<string, boolean>>({})

/** 目前使用者看得到的選單；權限由 siteHooks.canAccess 判斷，切換角色後授權狀態一換就重算 */
const visibleMenuRoutes = computed(() => filterMenuRoutes(menuRoutes, siteHooks.canAccess))
// 選單背景是亮色時用藍色版標誌，暗色／品牌色背景用白色版以維持對比
const isLightMenu = computed(() => layoutStore.layoutConfig.menuColor === 'light')
const logoMarkSrc = computed(() => (isLightMenu.value ? logoMarkBlue : logoMarkWhite))
const logoLockupSrc = computed(() => (isLightMenu.value ? logoLockupBlue : logoLockupWhite))
/** 標誌高度依各站標誌圖檔的比例而定 */
const logoStyle = { height: `${siteConfig.logoHeight.menu}px` }

/** 路徑變更時自動展開對應的選單群組 */
watch(
  () => route.path,
  () => {
    visibleMenuRoutes.value.forEach((item) => {
      if (item.children && isChildRouteActive(item)) {
        expansionStates.value[String(item.name)] = true
      }
    })
  },
  { immediate: true }
)

/**
 * 判斷選單項目是否為當前路徑或其父路徑
 *
 * 只從列表進入的頁面（新增、檢視、編輯）網址都在列表頁底下，例如 /users/{id}/edit 屬於 /users，
 * 停在這些頁面時選單仍標示列表那一項。
 * 目前頁面本身就是選單項目時只比對名稱：網址掛在別的列表底下的選單項目（例如 /users/settings）不算在那個列表底下。
 * 判斷要看葉節點自己的 meta——route.meta 會沿 matched 合併父層的 title，子頁面也會帶到群組的 title
 */
function isMenuItemActive(routeName: string | symbol | null | undefined): boolean {
  if (!routeName) return false
  if (route.name === routeName) return true
  if (route.matched[route.matched.length - 1]?.meta.title) return false
  const menuPath = router.resolve({ name: routeName }).path
  return route.path.startsWith(`${menuPath}/`)
}

/** 遞迴檢查是否有任何子路由符合當前路徑 */
function isChildRouteActive(item: RouteRecordRaw): boolean {
  const check = (children: RouteRecordRaw[]): boolean =>
    children.some((child) => isMenuItemActive(child.name) || (child.children ? check(child.children) : false))
  return item.children ? check(item.children) : false
}

/** 是否有子選單；menuRoutes 已把非選單節點剔掉，這裡只需看還剩不剩 */
function hasVisibleChildren(route: RouteRecordRaw): boolean {
  return route.children !== undefined && route.children.length > 0
}

/**
 * 取得選單項目目前語系的標題；meta.title 是語系檔 menu 底下的 key
 * @param menuRoute 選單項目
 * @returns 標題；沒有設定標題時為空字串
 */
function buildMenuTitle(menuRoute: RouteRecordRaw): string {
  const titleKey = menuRoute.meta?.title
  if (titleKey === undefined || titleKey === '') return ''

  return t(`menu.${titleKey}`)
}

/**
 * 組出選單項目的導覽錨點；以路由名稱為準，重構版面不會影響錨點
 * @param routeName 選單項目的路由名稱
 * @returns 錨點名稱；沒有路由名稱時為 undefined，該項目不掛錨點
 */
function buildMenuAnchor(routeName: string | symbol | null | undefined): string | undefined {
  if (!routeName) return undefined

  return `menu-${String(routeName)}`
}
</script>

<style lang="css" scoped>
.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  text-decoration: none;
  color: inherit;
}

/* 高度由站別設定決定，寫在元素的 style */
.logo-mark,
.logo-lockup {
  width: auto;
}
</style>
