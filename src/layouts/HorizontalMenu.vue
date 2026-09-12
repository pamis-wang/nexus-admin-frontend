<template>
  <!--
    導覽錨點只掛在第一層：第二層以下包在 q-menu 裡，選單沒被點開時不在 DOM 上，
    導覽找不到就只能空等到逾時。系統導覽的選單步驟一律指向第一層，兩種版面都找得到。
  -->
  <div class="row q-gutter-xs" v-bind:class="layoutStore.getMenuColorClass()">
    <template v-for="item in visibleMenuRoutes" :key="item.name">
      <!-- 無子選單的項目 (一層選單) -->
      <template v-if="!hasSubMenu(item)">
        <q-btn
          class="col q-my-none q-py-md"
          flat
          no-caps
          :label="item.meta?.title"
          :icon="item.meta?.icon"
          :to="{ name: item.name }"
          :data-tour="buildMenuAnchor(item.name)"
        />
      </template>

      <!-- 有子選單的項目 -->
      <template v-else>
        <!-- 兩層選單：子項目都沒有 children -->
        <template v-if="!hasThirdLevel(item)">
          <q-btn class="col q-my-none q-py-md" flat no-caps :label="item.meta?.title" :icon="item.meta?.icon" :data-tour="buildMenuAnchor(item.name)">
            <q-menu fit>
              <q-list dense>
                <template v-for="child in item.children" :key="child.name">
                  <q-item clickable v-close-popup :to="{ name: child.name }">
                    <q-item-section avatar v-if="child.meta?.icon">
                      <q-icon :name="child.meta.icon" />
                    </q-item-section>
                    <q-item-section>{{ child.meta?.title }}</q-item-section>
                  </q-item>
                </template>
              </q-list>
            </q-menu>
          </q-btn>
        </template>

        <!-- 三層選單：至少有一個子項目有 children -->
        <template v-else>
          <q-btn class="col q-my-none q-py-md" flat no-caps :label="item.meta?.title" :icon="item.meta?.icon" :data-tour="buildMenuAnchor(item.name)">
            <q-menu fit>
              <q-list dense>
                <template v-for="child in item.children" :key="child.name">
                  <!-- 第二層沒有子選單的項目 -->
                  <template v-if="!hasSubMenu(child)">
                    <q-item clickable v-close-popup :to="{ name: child.name }">
                      <q-item-section avatar v-if="child.meta?.icon">
                        <q-icon :name="child.meta.icon" />
                      </q-item-section>
                      <q-item-section>{{ child.meta?.title }}</q-item-section>
                    </q-item>
                  </template>

                  <!-- 第二層有子選單的項目 -->
                  <template v-else>
                    <q-item clickable>
                      <q-item-section avatar v-if="child.meta?.icon">
                        <q-icon :name="child.meta.icon" />
                      </q-item-section>
                      <q-item-section>{{ child.meta?.title }}</q-item-section>
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
                              {{ grandChild.meta?.title }}
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
import { useLayoutStore } from '@/stores/useLayout'
import { useUserStore } from '@/stores/useUser'
import { filterMenuRoutesByPermission, menuRoutes } from '@/router/routes'
import type { RouteRecordRaw } from 'vue-router'

const layoutStore = useLayoutStore()
const userStore = useUserStore()

/** 目前這位使用者看得到的選單，隨生效角色變動 */
const visibleMenuRoutes = computed(() => filterMenuRoutesByPermission(menuRoutes, (resourceName) => userStore.hasPermission(resourceName)))

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
