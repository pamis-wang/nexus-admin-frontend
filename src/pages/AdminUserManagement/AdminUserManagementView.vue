<template>
  <x-breadcrumb
    :items="[
      { label: t('menu.home'), icon: 'mdi-home', to: { name: 'home' } },
      { label: t('menu.systemManagement') },
      { label: t('user.title'), to: { name: 'userManagementList' } },
      { label: t('user.viewTitle') },
    ]"
  />

  <x-loading-state :loading="isLoading" :message="t('user.loading.user')" />

  <template v-if="!isLoading && user !== null">
    <x-page-header :title="user.account" icon="mdi-account-details-outline">
      <template #badges>
        <q-badge v-if="user.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">{{ t('user.status.systemDefault') }}</q-badge>
        <q-badge :color="user.isDisabled ? 'grey-6' : 'positive'" class="q-ml-sm">
          {{ user.isDisabled ? t('user.status.disabled') : t('user.status.enabled') }}
        </q-badge>
      </template>
      <template #actions>
        <q-btn outline color="secondary" icon="mdi-arrow-left" :label="t('common.action.backToList')" :to="{ name: 'userManagementList' }" />
        <q-btn
          unelevated
          :label="t('user.action.edit')"
          color="primary"
          icon="mdi-file-document-edit-outline"
          :to="{ name: 'userManagementEdit', params: { userId: user.id } }"
        />
      </template>
    </x-page-header>

    <q-card flat bordered class="q-mt-xs">
      <q-card-section>
        <x-section-header-bar :title="t('user.section.basic')" />
        <div class="row q-col-gutter-md q-mt-xs">
          <div v-for="field in basicFields" :key="field.label" class="col-12 col-md-6">
            <div class="text-caption text-grey-7">{{ field.label }}</div>
            <div class="text-body2">{{ field.value }}</div>
          </div>
        </div>

        <x-section-header-bar :title="t('user.section.roles')" class="q-mt-md" />
        <div class="q-mt-sm">
          <template v-if="user.roleMappings.length > 0">
            <q-chip v-for="mapping in user.roleMappings" :key="mapping.roleId" dense color="primary" text-color="white">
              {{ mapping.roleName ?? t('user.empty.unnamedRole') }}
            </q-chip>
          </template>
          <div v-else class="text-caption text-grey-6">{{ t('user.empty.noRoleDetail') }}</div>
        </div>

        <x-section-header-bar :title="t('user.section.logins')" class="q-mt-md" />
        <div class="text-caption text-grey-7 q-my-sm">{{ t('user.hint.loginsReadonly') }}</div>

        <div v-if="user.logins.length === 0" class="text-caption text-grey-6">{{ t('user.empty.noLogin') }}</div>

        <q-markup-table v-else flat bordered dense separator="horizontal">
          <thead class="bg-primary text-white">
            <q-tr>
              <q-th class="text-left">{{ t('user.column.loginMethod') }}</q-th>
              <q-th class="text-left">{{ t('user.column.providerEmail') }}</q-th>
              <q-th class="text-center" style="width: 110px">{{ t('user.column.status') }}</q-th>
              <q-th class="text-center" style="width: 110px">{{ t('user.column.failedCount') }}</q-th>
              <q-th class="text-left" style="width: 190px">{{ t('user.column.lockedUntil') }}</q-th>
              <q-th class="text-left" style="width: 190px">{{ t('user.column.lastUsedAt') }}</q-th>
            </q-tr>
          </thead>
          <tbody>
            <q-tr v-for="login in user.logins" :key="login.id">
              <q-td>
                {{ login.providerName || login.provider }}
                <q-badge v-if="login.verifiedAt === null" color="grey-5" class="q-ml-sm">{{ t('user.status.unverified') }}</q-badge>
                <q-badge v-if="login.requiresReset" color="warning" text-color="dark" class="q-ml-sm">{{ t('user.status.requiresReset') }}</q-badge>
              </q-td>
              <q-td>{{ login.providerEmail || '-' }}</q-td>
              <q-td class="text-center">
                <q-badge :color="login.isUsable ? 'positive' : 'grey-6'">{{ login.isUsable ? t('user.status.usable') : t('user.status.unusable') }}</q-badge>
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
      </q-card-section>
    </q-card>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import { getAdminUserById, type AdminUserResponse } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const dialog = useDialog()
const logger = useLogger({ prefix: 'AdminUserManagementView', enabled: import.meta.env.DEV })

const user = ref<AdminUserResponse | null>(null)
const isLoading = ref(true)

const basicFields = computed(() => [
  { label: t('user.field.email'), value: user.value?.email ?? '-' },
  { label: t('user.field.fullName'), value: user.value?.fullName || '-' },
  { label: t('user.field.activateAt'), value: formatDateTime(user.value?.activateAt ?? null) },
  { label: t('user.field.lastLoginAt'), value: formatDateTime(user.value?.lastLoginAt ?? null) },
])

onMounted(async () => {
  await loadUser()
})

/** 載入用戶資料 */
async function loadUser() {
  const userId = String(route.params.userId ?? '')
  if (userId.length === 0) {
    dialog.showError(t('user.missingId'), t('common.dialog.loadFailed'))
    router.push({ name: 'userManagementList' })
    return
  }

  isLoading.value = true
  try {
    const response = await getAdminUserById(userId)

    if (response.status !== 200 || !response.result.data) {
      dialog.showError(response.result.error?.message || t('user.notFound'), t('common.dialog.loadFailed'))
      router.push({ name: 'userManagementList' })
      return
    }

    user.value = response.result.data
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || t('common.unknownError')
    logger.error('載入用戶失敗', errorMessage)
    dialog.showError(errorMessage, t('user.loadFailedTitle'))
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
</script>
