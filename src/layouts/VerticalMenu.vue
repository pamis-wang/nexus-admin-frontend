<template>
  <q-scroll-area class="fit" v-bind:class="layoutStore.getMenuColorClass()">
    <q-toolbar class="flex justify-center">
      <router-link to="/" class="logo-container">
        <img v-if="props.miniModeState && !props.miniExpandState" :src="logoMarkSrc" alt="logo" class="logo-mark" />
        <img v-else :src="logoLockupSrc" alt="logo" class="logo-lockup" />
      </router-link>
    </q-toolbar>

    <q-list>
      <template v-for="item in visibleMenuRoutes" :key="item.name">
        <!-- 無子選單的項目 -->
        <template v-if="!hasVisibleChildren(item)">
          <q-item clickable v-ripple exact :to="{ name: item.name }" :data-tour="buildMenuAnchor(item.name)">
            <q-item-section avatar>
              <q-icon :name="item.meta?.icon" />
            </q-item-section>
            <q-item-section>{{ item.meta?.title }}</q-item-section>
          </q-item>
        </template>
        <!-- 有子選單的項目 -->
        <template v-else>
          <q-expansion-item
            v-model="expansionStates[String(item.name)]"
            :icon="item.meta?.icon"
            :label="item.meta?.title"
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
                    <q-item-section>{{ child.meta?.title }}</q-item-section>
                  </q-item>
                </template>
                <!-- 有子選單的項目 (第三層) -->
                <template v-else>
                  <q-expansion-item
                    v-model="expansionStates[String(child.name)]"
                    :icon="child.meta?.icon"
                    :label="child.meta?.title"
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
                            {{ grandChild.meta?.title }}
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
import { useRoute } from 'vue-router'
import { useLayoutStore } from '@/stores/useLayout'
import { useUserStore } from '@/stores/useUser'
import { filterMenuRoutesByPermission, menuRoutes } from '@/router/routes'
import logoMarkBlue from '@/assets/images/nexus-mark-blue.svg'
import logoMarkWhite from '@/assets/images/nexus-mark-white.svg'
import logoLockupBlue from '@/assets/images/nexus-lockup-blue.svg'
import logoLockupWhite from '@/assets/images/nexus-lockup-white.svg'
import type { RouteRecordRaw } from 'vue-router'

const route = useRoute()
const layoutStore = useLayoutStore()
const userStore = useUserStore()

interface Props {
  miniModeState: boolean
  miniExpandState: boolean
}

const props = defineProps<Props>()

const expansionStates = ref<Record<string, boolean>>({})

/** 目前這位使用者看得到的選單，隨生效角色變動 */
const visibleMenuRoutes = computed(() => filterMenuRoutesByPermission(menuRoutes, (resourceName) => userStore.hasPermission(resourceName)))
// 選單背景是亮色時用藍色版標誌，暗色／品牌色背景用白色版以維持對比
const isLightMenu = computed(() => layoutStore.layoutConfig.menuColor === 'light')
const logoMarkSrc = computed(() => (isLightMenu.value ? logoMarkBlue : logoMarkWhite))
const logoLockupSrc = computed(() => (isLightMenu.value ? logoLockupBlue : logoLockupWhite))

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
  { immediate: true },
)

/** 遞迴查找路由的 resourceName */
function findRouteResourceName(routes: RouteRecordRaw[], name: string | symbol | null | undefined): unknown {
  if (!name) return null
  for (const r of routes) {
    if (r.name === name) return r.meta?.resourceName
    if (r.children) {
      const found = findRouteResourceName(r.children, name)
      if (found !== null && found !== undefined) return found
    }
  }
  return null
}

/** 判斷選單項目是否為當前路徑或其父路徑 */
function isMenuItemActive(routeName: string | symbol | null | undefined): boolean {
  if (!routeName) return false
  if (route.name === routeName) return true
  // 用 resourceName 判斷：當前路由與選單項目屬於同一個資源群組
  const targetResourceName = findRouteResourceName(visibleMenuRoutes.value, routeName)
  if (!targetResourceName) return false
  return route.meta?.resourceName === targetResourceName
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

.logo-mark,
.logo-lockup {
  height: 26px;
  width: auto;
}
</style>
