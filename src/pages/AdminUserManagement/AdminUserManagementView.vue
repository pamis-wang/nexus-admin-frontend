<template>
  <x-breadcrumb
    :items="[
      { label: '首頁', icon: 'mdi-home', to: { name: 'home' } },
      { label: '系統管理' },
      { label: '用戶管理', to: { name: 'userManagementList' } },
      { label: '檢視用戶' },
    ]"
  />

  <x-loading-state :loading="isLoading" message="載入用戶資料中..." />

  <q-card v-if="!isLoading && user !== null" flat bordered class="q-mt-xs">
    <q-card-section>
      <div class="text-h6 text-primary q-mb-md">
        <q-icon name="mdi-account-details-outline" class="q-mr-sm" />
        {{ user.account }}
        <q-badge v-if="user.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
        <q-badge :color="user.isDisabled ? 'grey-6' : 'positive'" class="q-ml-sm">{{ user.isDisabled ? '已停用' : '啟用中' }}</q-badge>
      </div>

      <!-- 基本資料 -->
      <div class="row q-col-gutter-md">
        <div v-for="field in basicFields" :key="field.label" class="col-12 col-md-6">
          <div class="text-caption text-grey-7">{{ field.label }}</div>
          <div class="text-body2">{{ field.value }}</div>
        </div>
      </div>

      <q-separator class="q-my-md" />

      <!-- 角色 -->
      <div class="text-subtitle1 text-primary q-mb-sm">
        <q-icon name="mdi-account-group" class="q-mr-sm" />
        角色
      </div>
      <div v-if="user.roleMappings.length > 0">
        <q-chip v-for="mapping in user.roleMappings" :key="mapping.roleId" dense color="primary" text-color="white">
          {{ mapping.roleName ?? '（未命名角色）' }}
        </q-chip>
      </div>
      <div v-else class="text-caption text-grey-6">未指派角色，此帳號登入後沒有任何權限</div>

      <q-separator class="q-my-md" />

      <!-- 登入方式 -->
      <div class="text-subtitle1 text-primary q-mb-sm">
        <q-icon name="mdi-key-outline" class="q-mr-sm" />
        登入方式
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">以下資料唯讀。解除鎖定、清除失敗次數與重設密碼目前沒有對應的後台端點，需由維運處理。</div>

      <div v-if="user.logins.length === 0" class="text-caption text-grey-6">尚未綁定任何登入方式，此帳號還不能登入。</div>

      <q-markup-table v-else flat bordered dense separator="horizontal">
        <thead class="bg-primary text-white">
          <q-tr>
            <q-th class="text-left">登入方式</q-th>
            <q-th class="text-left">綁定信箱</q-th>
            <q-th class="text-center" style="width: 110px">狀態</q-th>
            <q-th class="text-center" style="width: 110px">連續失敗</q-th>
            <q-th class="text-left" style="width: 190px">鎖定至</q-th>
            <q-th class="text-left" style="width: 190px">最後使用</q-th>
          </q-tr>
        </thead>
        <tbody>
          <q-tr v-for="login in user.logins" :key="login.id">
            <q-td>
              {{ login.providerName || login.provider }}
              <q-badge v-if="login.verifiedAt === null" color="grey-5" class="q-ml-sm">未驗證</q-badge>
              <q-badge v-if="login.requiresReset" color="warning" text-color="dark" class="q-ml-sm">待重設密碼</q-badge>
            </q-td>
            <q-td>{{ login.providerEmail || '-' }}</q-td>
            <q-td class="text-center">
              <q-badge :color="login.isUsable ? 'positive' : 'grey-6'">{{ login.isUsable ? '可用' : '不可用' }}</q-badge>
            </q-td>
            <q-td class="text-center">
              <span :class="login.failedCount > 0 ? 'text-negative text-weight-medium' : 'text-grey-7'">{{ login.failedCount }}</span>
            </q-td>
            <q-td>
              <q-badge v-if="login.lockedUntil !== null" color="negative">{{ formatDateTime(login.lockedUntil) }}</q-badge>
              <span v-else class="text-grey-6">-</span>
            </q-td>
            <q-td>{{ formatDateTime(login.lastUsedAt) }}</q-td>
          </q-tr>
        </tbody>
      </q-markup-table>

      <q-separator class="q-my-md" />

      <div class="row q-gutter-sm justify-end">
        <q-btn flat label="返回列表" color="grey" @click="handleBack" />
        <q-btn
          unelevated
          label="編輯用戶"
          color="primary"
          icon="mdi-file-document-edit-outline"
          :to="{ name: 'userManagementEdit', params: { userId: user.id } }"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import { getAdminUserById, type AdminUserResponse } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'

const route = useRoute()
const router = useRouter()
const dialog = useDialog()
const logger = useLogger({ prefix: 'AdminUserManagementView', enabled: import.meta.env.DEV })

const user = ref<AdminUserResponse | null>(null)
const isLoading = ref(true)

const basicFields = computed(() => [
  { label: '電子信箱', value: user.value?.email ?? '-' },
  { label: '姓名', value: user.value?.fullName || '-' },
  { label: '啟用時間', value: formatDateTime(user.value?.activateAt ?? null) },
  { label: '最後登入時間', value: formatDateTime(user.value?.lastLoginAt ?? null) },
])

onMounted(async () => {
  await loadUser()
})

/** 載入用戶資料 */
async function loadUser() {
  const userId = String(route.params.userId ?? '')
  if (userId.length === 0) {
    dialog.showError('缺少用戶唯一編號', '載入失敗')
    router.push({ name: 'userManagementList' })
    return
  }

  isLoading.value = true
  try {
    const response = await getAdminUserById(userId)

    if (response.status !== 200 || !response.result.data) {
      dialog.showError(response.result.error?.message || '找不到指定用戶', '載入失敗')
      router.push({ name: 'userManagementList' })
      return
    }

    user.value = response.result.data
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('載入用戶失敗', errorMessage)
    dialog.showError(errorMessage, '載入用戶失敗')
    router.push({ name: 'userManagementList' })
  } finally {
    isLoading.value = false
  }
}

/**
 * 把 ISO 8601 時間字串轉成本地顯示格式
 * @param value ISO 8601 時間字串；null 顯示為破折號
 */
function formatDateTime(value: string | null): string {
  if (value === null) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-TW', { hour12: false })
}

function handleBack() {
  router.push({ name: 'userManagementList' })
}
</script>
