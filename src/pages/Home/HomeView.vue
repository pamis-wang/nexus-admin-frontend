<template>
  <div class="col-12 col-md-6 col-sm-3">
    <q-card flat bordered class="q-mt-xs">
      <q-card-section class="q-pa-sm">
        <div class="text-h6 text-primary">
          <q-icon name="mdi-home" class="q-mr-sm" />
          歡迎使用 Nexus 管理後台
        </div>
      </q-card-section>

      <q-card-section>在這裡建立後台帳號、設定角色與各功能的權限，也可以調整後台選單的結構。</q-card-section>

      <!-- 與選單一致，沒有權限的功能不顯示捷徑，免得點進去才被導到 403 -->
      <q-card-actions>
        <q-btn
          v-if="userStore.hasPermission('系統管理>用戶管理')"
          flat
          color="primary"
          icon="mdi-account-circle"
          label="用戶管理"
          :to="{ name: 'userManagementList' }"
        />
        <q-btn
          v-if="userStore.hasPermission('系統管理>角色管理')"
          flat
          color="primary"
          icon="mdi-account-group"
          label="角色管理"
          :to="{ name: 'roleManagementList' }"
        />
        <q-btn
          v-if="userStore.hasPermission('系統管理>資源管理')"
          flat
          color="primary"
          icon="mdi-file-tree"
          label="選單設定"
          :to="{ name: 'menuSettingsList' }"
        />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/useUser'

const userStore = useUserStore()
</script>
