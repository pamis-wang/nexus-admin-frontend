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
import { useQuasar } from 'quasar'
import { storeToRefs } from 'pinia'
import { useLayoutStore } from '@/stores/useLayout'
import { useUserStore } from '@/stores/useUser'
import { useAuthentication } from '@/composables/useAuthentication'
import logoLockupBlue from '@/assets/images/nexus-lockup-blue.svg'
import logoLockupWhite from '@/assets/images/nexus-lockup-white.svg'

defineEmits<{
  toggleLeftDrawer: []
}>()

const $q = useQuasar()
const layoutStore = useLayoutStore()
const { userProfile } = storeToRefs(useUserStore())
const { isLoggingOut, logout } = useAuthentication()

// 頂部欄背景是亮色時用藍色版標誌，暗色／品牌色背景用白色版以維持對比
const logoLockupSrc = computed(() => (layoutStore.layoutConfig.topbarColor === 'light' ? logoLockupBlue : logoLockupWhite))
const displayName = computed(() => userProfile.value?.fullName ?? userProfile.value?.account ?? '')

onMounted(() => {
  layoutStore.initQuasar($q)
})

async function handleLogout() {
  await logout()
}
</script>
