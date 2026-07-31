<template>
  <q-card style="width: 400px; max-width: 100%">
    <!-- 標題列 -->
    <q-card-section class="row items-center q-py-sm" :class="layoutStore.getTopbarColorClass()">
      <div class="text-h6">主題設定</div>
      <q-space />
      <q-btn flat round dense icon="close" v-close-popup />
    </q-card-section>

    <!-- 內容區域 -->
    <q-card-section class="q-pa-md">
      <!-- 選擇佈局 -->
      <div class="q-mb-lg">
        <h6 class="text-h6 q-my-md">選擇佈局</h6>
        <div class="row q-gutter-md">
          <div class="col-5">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setLayout('vertical')">
              <q-card-section class="q-pa-sm flex justify-center">
                <LayoutVerticalPreview :is-selected="layoutStore.layoutConfig.layout === 'vertical'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">垂直佈局</div>
          </div>
          <div class="col-5">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setLayout('horizontal')">
              <q-card-section class="q-pa-sm flex justify-center">
                <LayoutHorizontalPreview :is-selected="layoutStore.layoutConfig.layout === 'horizontal'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">水平佈局</div>
          </div>
        </div>
      </div>

      <!-- 色彩方案 -->
      <div class="q-mb-lg">
        <h6 class="text-h6 q-my-md">色彩方案</h6>
        <div class="row q-gutter-md">
          <div class="col-5">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setColorScheme('light')">
              <q-card-section class="q-pa-sm flex justify-center">
                <ColorSchemeLight :is-selected="layoutStore.layoutConfig.colorScheme === 'light'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">亮色主題</div>
          </div>
          <div class="col-5">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setColorScheme('dark')">
              <q-card-section class="q-pa-sm flex justify-center">
                <ColorSchemeDark :is-selected="layoutStore.layoutConfig.colorScheme === 'dark'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">暗色主題</div>
          </div>
        </div>
      </div>

      <!-- 頂部欄顏色 -->
      <div class="q-mb-lg">
        <h6 class="text-h6 q-my-md">頂部欄顏色</h6>
        <div class="row q-gutter-md">
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setTopbarColor('light')">
              <q-card-section class="q-pa-sm flex justify-center">
                <TopbarColorLight :is-selected="layoutStore.layoutConfig.topbarColor === 'light'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">亮色</div>
          </div>
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setTopbarColor('dark')">
              <q-card-section class="q-pa-sm flex justify-center">
                <TopbarColorDark :is-selected="layoutStore.layoutConfig.topbarColor === 'dark'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">暗色</div>
          </div>
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setTopbarColor('brand')">
              <q-card-section class="q-pa-sm flex justify-center">
                <TopbarColorBrand :is-selected="layoutStore.layoutConfig.topbarColor === 'brand'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">品牌色</div>
          </div>
        </div>
      </div>

      <!-- 選單顏色 -->
      <div class="q-mb-lg">
        <h6 class="text-h6 q-my-md">選單顏色</h6>
        <div class="row q-gutter-md">
          <div class="col-3" v-if="isMenuColorAvailable.light">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setMenuColor('light')">
              <q-card-section class="q-pa-sm flex justify-center">
                <MenuColorLight :is-selected="layoutStore.layoutConfig.menuColor === 'light'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">亮色</div>
          </div>
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setMenuColor('dark')">
              <q-card-section class="q-pa-sm flex justify-center">
                <MenuColorDark :is-selected="layoutStore.layoutConfig.menuColor === 'dark'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">暗色</div>
          </div>
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setMenuColor('brand')">
              <q-card-section class="q-pa-sm flex justify-center">
                <MenuColorBrand :is-selected="layoutStore.layoutConfig.menuColor === 'brand'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">品牌色</div>
          </div>
        </div>
        <!-- 提示文字 -->
        <div v-if="!isMenuColorAvailable.light" class="text-caption text-grey-6 q-mt-sm">💡 暗色主題下僅支援暗色或品牌色選單，以確保最佳視覺體驗</div>
      </div>

      <!-- 側邊選單尺寸：僅垂直佈局適用 -->
      <div class="q-mb-lg" v-if="layoutStore.layoutConfig.layout === 'vertical'">
        <h6 class="text-h6 q-my-md">側邊選單尺寸</h6>
        <div class="row q-gutter-md">
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setSidebarSize('default')">
              <q-card-section class="q-pa-sm flex justify-center">
                <SidebarSizeDefault :is-selected="layoutStore.layoutConfig.sidebarSize === 'default'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">預設展開</div>
          </div>
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setSidebarSize('condensed')">
              <q-card-section class="q-pa-sm flex justify-center">
                <SidebarSizeCondensed :is-selected="layoutStore.layoutConfig.sidebarSize === 'condensed'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">常駐收合</div>
          </div>
          <div class="col-3">
            <q-card flat bordered class="cursor-pointer layout-preview-card" @click="layoutStore.setSidebarSize('sm-hover')">
              <q-card-section class="q-pa-sm flex justify-center">
                <SidebarSizeHover :is-selected="layoutStore.layoutConfig.sidebarSize === 'sm-hover'" :size="80" />
              </q-card-section>
            </q-card>
            <div class="text-center q-mt-sm text-caption">滑鼠移入展開</div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutStore } from '@/stores/useLayout'
import LayoutVerticalPreview from '@/layouts/components/LayoutVerticalPreview.vue'
import LayoutHorizontalPreview from '@/layouts/components/LayoutHorizontalPreview.vue'
import ColorSchemeLight from '@/layouts/components/ColorSchemeLight.vue'
import ColorSchemeDark from '@/layouts/components/ColorSchemeDark.vue'
import TopbarColorLight from '@/layouts/components/TopbarColorLight.vue'
import TopbarColorDark from '@/layouts/components/TopbarColorDark.vue'
import TopbarColorBrand from '@/layouts/components/TopbarColorBrand.vue'
import MenuColorLight from '@/layouts/components/MenuColorLight.vue'
import MenuColorDark from '@/layouts/components/MenuColorDark.vue'
import MenuColorBrand from '@/layouts/components/MenuColorBrand.vue'
import SidebarSizeDefault from '@/layouts/components/SidebarSizeDefault.vue'
import SidebarSizeCondensed from '@/layouts/components/SidebarSizeCondensed.vue'
import SidebarSizeHover from '@/layouts/components/SidebarSizeHover.vue'

// 使用 layout store
const layoutStore = useLayoutStore()

// 計算可用的選單顏色選項
const isMenuColorAvailable = computed(() => {
  const isDarkMode = layoutStore.layoutConfig.colorScheme === 'dark'
  return {
    light: !isDarkMode, // 暗色主題時不可選亮色選單
    dark: true, // 暗色選單總是可選
    brand: true, // 品牌色選單總是可選
  }
})
</script>
