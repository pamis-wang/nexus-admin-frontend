<template>
  <!--
    導覽錨點只掛在第一層：第二層以下包在 q-menu 裡，選單沒被點開時不在 DOM 上，
    導覽找不到就只能空等到逾時。系統導覽的選單步驟一律指向第一層，兩種版面都找得到。
    整個選單的錨點與垂直版面同名（sidebar-menu），指向「選單」的導覽步驟不必分版面。
  -->
  <div class="row q-gutter-xs" v-bind:class="layoutStore.getMenuColorClass()" data-tour="sidebar-menu">
    <template v-for="item in visibleMenuRoutes" :key="item.name">
      <!-- 無子選單的項目 (一層選單) -->
      <template v-if="!hasSubMenu(item)">
        <q-btn
          class="col q-my-none q-py-md"
          flat
          no-caps
          :label="buildMenuTitle(item)"
          :icon="item.meta?.icon"
          :to="{ name: item.name }"
          :data-tour="buildMenuAnchor(item.name)"
        />
      </template>

      <!-- 有子選單的項目 -->
      <template v-else>
        <!-- 兩層選單：子項目都沒有 children -->
        <template v-if="!hasThirdLevel(item)">
          <q-btn class="col q-my-none q-py-md" flat no-caps :label="buildMenuTitle(item)" :icon="item.meta?.icon" :data-tour="buildMenuAnchor(item.name)">
            <q-menu fit>
              <q-list dense>
                <template v-for="child in item.children" :key="child.name">
                  <q-item clickable v-close-popup :to="{ name: child.name }">
                    <q-item-section avatar v-if="child.meta?.icon">
                      <q-icon :name="child.meta.icon" />
                    </q-item-section>
                    <q-item-section>{{ buildMenuTitle(child) }}</q-item-section>
                  </q-item>
                </template>
              </q-list>
            </q-menu>
          </q-btn>
        </template>

        <!-- 三層選單：至少有一個子項目有 children -->
        <template v-else>
          <q-btn class="col q-my-none q-py-md" flat no-caps :label="buildMenuTitle(item)" :icon="item.meta?.icon" :data-tour="buildMenuAnchor(item.name)">
            <q-menu fit>
              <q-list dense>
                <template v-for="child in item.children" :key="child.name">
                  <!-- 第二層沒有子選單的項目 -->
                  <template v-if="!hasSubMenu(child)">
                    <q-item clickable v-close-popup :to="{ name: child.name }">
                      <q-item-section avatar v-if="child.meta?.icon">
                        <q-icon :name="child.meta.icon" />
                      </q-item-section>
                      <q-item-section>{{ buildMenuTitle(child) }}</q-item-section>
                    </q-item>
                  </template>

                  <!-- 第二層有子選單的項目 -->
                  <template v-else>
                    <q-item clickable>
                      <q-item-section avatar v-if="child.meta?.icon">
                        <q-icon :name="child.meta.icon" />
                      </q-item-section>
                      <q-item-section>{{ buildMenuTitle(child) }}</q-item-section>
                      <q-item-section side>
                        <q-icon name="mdi-chevron-right" />
                      </q-item-section>

                      <q-menu anchor="top end" self="top start">
                        <q-list>
                          <q-item v-for="grandChild in child.children" :key="grandChild.name" dense clickable v-close-popup :to="{ name: grandChild.name }">
                            <q-item-section avatar v-if="grandChild.meta?.icon">
                              <q-icon :name="grandChild.meta.icon" />
                            </q-item-section>
                            <q-item-section>
                              {{ buildMenuTitle(grandChild) }}
                            </q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-item>
                  </template>
                </template>
              </q-list>
            </q-menu>
          </q-btn>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { siteHooks } from '@/config/siteHooks'
import { useLayoutStore } from '@/stores/useLayout'
import { filterMenuRoutes, menuRoutes } from '@/router/routes'
import type { RouteRecordRaw } from 'vue-router'

const { t } = useI18n()
const layoutStore = useLayoutStore()

/** 目前使用者看得到的選單；權限由 siteHooks.canAccess 判斷，切換角色後授權狀態一換就重算 */
const visibleMenuRoutes = computed(() => filterMenuRoutes(menuRoutes, siteHooks.canAccess))

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

/** 是否有子選單；menuRoutes 已把非選單節點剔掉，這裡只需看還剩不剩 */
function hasSubMenu(route: RouteRecordRaw): boolean {
  return route.children !== undefined && route.children.length > 0
}

/** 檢查是否有第三層選單 */
function hasThirdLevel(route: RouteRecordRaw): boolean {
  if (!route.children) return false
  return route.children.some((child) => child.children && child.children.length > 0)
}

/**
 * 組出選單項目的導覽錨點；與垂直版面同一套命名，導覽定義不必分版面
 * @param routeName 選單項目的路由名稱
 * @returns 錨點名稱；沒有路由名稱時為 undefined，該項目不掛錨點
 */
function buildMenuAnchor(routeName: string | symbol | null | undefined): string | undefined {
  if (!routeName) return undefined

  return `menu-${String(routeName)}`
}
</script>
