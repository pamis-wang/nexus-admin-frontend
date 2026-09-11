<template>
  <div class="row q-gutter-xs" v-bind:class="layoutStore.getMenuColorClass()">
    <template v-for="item in menuRoutes" :key="item.name">
      <!-- 無子選單的項目 (一層選單) -->
      <template v-if="!hasSubMenu(item)">
        <q-btn class="col q-my-none q-py-md" flat no-caps :label="item.meta?.title" :icon="item.meta?.icon" :to="{ name: item.name }" />
      </template>

      <!-- 有子選單的項目 -->
      <template v-else>
        <!-- 兩層選單：子項目都沒有 children -->
        <template v-if="!hasThirdLevel(item)">
          <q-btn class="col q-my-none q-py-md" flat no-caps :label="item.meta?.title" :icon="item.meta?.icon">
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
          <q-btn class="col q-my-none q-py-md" flat no-caps :label="item.meta?.title" :icon="item.meta?.icon">
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
                        <q-icon name="keyboard_arrow_right" />
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
import { useLayoutStore } from '@/stores/useLayout'
import { menuRoutes } from '@/router/routes'
import type { RouteRecordRaw } from 'vue-router'

const layoutStore = useLayoutStore()

/** 是否有子選單；menuRoutes 已把非選單節點剔掉，這裡只需看還剩不剩 */
function hasSubMenu(route: RouteRecordRaw): boolean {
  return route.children !== undefined && route.children.length > 0
}

/** 檢查是否有第三層選單 */
function hasThirdLevel(route: RouteRecordRaw): boolean {
  if (!route.children) return false
  return route.children.some((child) => child.children && child.children.length > 0)
}
</script>
