<template>
  <div class="col-12 col-md-6 col-sm-3">
    <q-card flat bordered class="q-mt-xs">
      <q-card-section class="q-pa-sm">
        <div class="text-h6 text-primary">
          <q-icon name="mdi-home" class="q-mr-sm" />
          {{ t('home.welcome') }}
        </div>
      </q-card-section>

      <q-card-section>{{ t('home.description') }}</q-card-section>

      <!-- 與選單一致，沒有權限的功能不顯示捷徑，免得點進去才被導到 403 -->
      <q-card-actions>
        <q-btn
          v-if="userStore.hasPermission('系統管理>用戶管理')"
          flat
          color="primary"
          icon="mdi-account-circle"
          :label="t('user.title')"
          :to="{ name: 'userManagementList' }"
        />
        <q-btn
          v-if="userStore.hasPermission('系統管理>角色管理')"
          flat
          color="primary"
          icon="mdi-account-group"
          :label="t('role.title')"
          :to="{ name: 'roleManagementList' }"
        />
        <q-btn
          v-if="userStore.hasPermission('系統管理>資源管理')"
          flat
          color="primary"
          icon="mdi-file-tree"
          :label="t('resource.title')"
          :to="{ name: 'menuSettingsList' }"
        />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/useUser'

const { t } = useI18n()
const userStore = useUserStore()
</script>
