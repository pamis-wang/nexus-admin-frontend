<template>
  <x-breadcrumb
    :items="[
      { label: t('menu.home'), icon: 'mdi-home', to: { name: 'home' } },
      { label: t('menu.systemManagement') },
      { label: t('role.title'), to: { name: 'roleManagementList' } },
      { label: t('role.viewTitle') },
    ]"
  />

  <x-loading-state :loading="isLoading" :message="t('role.loading.role')" />

  <template v-if="!isLoading && role !== null">
    <x-page-header :overline="t('role.overline')" :title="role.name" icon="mdi-shield-account-outline">
      <template #badges>
        <q-badge v-if="role.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">{{ t('role.status.systemDefault') }}</q-badge>
      </template>
      <template #meta>
        {{ t('role.meta.userCount', role.userCount) }}
        <template v-if="canViewUsers && role.userCount > 0">
          ・
          <router-link :to="buildUserListRoute()">{{ t('role.action.viewUsers') }}</router-link>
        </template>
      </template>
      <template #actions>
        <q-btn outline color="secondary" icon="mdi-arrow-left" :label="t('common.action.backToList')" :to="buildListRoute()" />
        <template v-if="canDelete">
          <q-btn
            v-if="deleteBlockedReason === null"
            outline
            color="negative"
            icon="mdi-trash-can-outline"
            :label="t('role.action.delete')"
            :loading="isDeleting"
            @click="confirmDelete"
          />
          <!-- 停用的按鈕收不到滑鼠事件，說明掛在外層 -->
          <span v-else>
            <q-btn outline color="negative" icon="mdi-trash-can-outline" :label="t('role.action.delete')" disable />
            <q-tooltip>{{ deleteBlockedReason }}</q-tooltip>
          </span>
        </template>
        <q-btn v-if="canUpdate" unelevated color="primary" icon="mdi-file-document-edit-outline" :label="t('role.action.edit')" :to="buildEditRoute()" />
      </template>
    </x-page-header>

    <q-card flat bordered class="q-mt-xs">
      <q-card-section>
        <x-section-header-bar :title="t('role.section.permissions')" />
        <div class="q-mt-sm">
          <AdminRolePermissionMatrix :rows="matrix.rows.value" is-readonly />
        </div>

        <x-section-header-bar :title="t('role.section.users', { n: users.length })" class="q-mt-md" />
        <div class="q-mt-sm">
          <x-loading-state :loading="isLoadingUsers" :message="t('role.loading.users')" />
          <template v-if="!isLoadingUsers">
            <div v-if="usersErrorMessage !== null" class="text-negative">{{ usersErrorMessage }}</div>
            <div v-else-if="users.length === 0">{{ t('role.empty.users') }}</div>
            <div v-else class="row q-gutter-xs">
              <q-chip v-for="user in users" :key="user.id" dense square :outline="user.isDisabled" icon="mdi-account">
                {{ user.fullName ?? user.account }}
                <span v-if="user.isDisabled" class="q-ml-xs">{{ t('role.status.userDisabled') }}</span>
                <q-tooltip>{{ user.account }}</q-tooltip>
              </q-chip>
            </div>
          </template>
        </div>
      </q-card-section>
    </q-card>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { useUserStore } from '@/stores/useUser'
import { deleteAdminRoleById, getAdminRolePermissionMatrix, getAdminRoleUsers } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import { useAdminRolePermissionMatrix } from '@/pages/AdminRoleManagement/composables/useAdminRolePermissionMatrix'
import AdminRolePermissionMatrix from '@/pages/AdminRoleManagement/components/AdminRolePermissionMatrix.vue'
import type { AdminRoleManagementSummary, AdminRoleManagementUser } from '@/pages/AdminRoleManagement/types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'AdminRoleManagementView', enabled: import.meta.env.DEV })
const userStore = useUserStore()
const matrix = useAdminRolePermissionMatrix()

const roleId = String(route.params.roleId ?? '')
const isLoading = ref(true)
const isLoadingUsers = ref(true)
const isDeleting = ref(false)
const role = ref<AdminRoleManagementSummary | null>(null)
const users = ref<AdminRoleManagementUser[]>([])
/** 用戶名單載入失敗的說明；權限矩陣照樣顯示 */
const usersErrorMessage = ref<string | null>(null)

const canUpdate = computed<boolean>(() => userStore.hasPermission('admin_roles', 'canUpdate'))
const canDelete = computed<boolean>(() => userStore.hasPermission('admin_roles', 'canDelete'))
const canViewUsers = computed<boolean>(() => userStore.hasPermission('admin_users'))
/** 不能刪除的原因；可以刪除時為 null */
const deleteBlockedReason = computed<string | null>(() => {
  if (role.value === null) return null
  if (role.value.isSystemDefault) return t('role.deleteBlockedSystemDefault')
  if (role.value.userCount > 0) return t('role.deleteBlockedInUse', role.value.userCount)

  return null
})

onMounted(() => {
  loadRole()
  loadUsers()
})

/** 載入角色與權限矩陣 */
async function loadRole() {
  isLoading.value = true
  try {
    const response = await getAdminRolePermissionMatrix(roleId)
    const data = response.result.data
    if (data === null) return

    role.value = {
      id: data.role.id,
      name: data.role.name,
      isSystemDefault: data.role.isSystemDefault,
      version: data.role.version,
      userCount: data.role.userCount,
    }
    matrix.load(data.permissions)
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || t('role.loadFailed')
    logger.error('載入角色失敗', errorMessage)
    dialog.showError(errorMessage, t('role.loadFailedTitle'))
    await router.push(buildListRoute())
  } finally {
    isLoading.value = false
  }
}

/** 載入使用此角色的用戶；失敗只影響名單這一塊 */
async function loadUsers() {
  isLoadingUsers.value = true
  usersErrorMessage.value = null
  try {
    const response = await getAdminRoleUsers(roleId)
    users.value = (response.result.data ?? []).map((user) => ({
      id: user.id,
      account: user.account,
      fullName: user.fullName,
      isDisabled: user.isDisabled,
    }))
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || t('common.unknownError')
    logger.error('載入角色用戶失敗', errorMessage)
    usersErrorMessage.value = t('role.loadUsersFailed', { message: errorMessage })
    notify.notifyError(usersErrorMessage.value, 0)
  } finally {
    isLoadingUsers.value = false
  }
}

/** 刪除確認；角色連同權限矩陣一起刪除 */
async function confirmDelete() {
  if (role.value === null) return

  const roleName = role.value.name
  dialog.showConfirm(t('role.deleteConfirm', { name: roleName }), t('role.deleteTitle')).onOk(async () => {
    isDeleting.value = true
    try {
      await deleteAdminRoleById(roleId)
      notify.notifySuccess(t('role.deleted', { name: roleName }))
      await router.push(buildListRoute())
    } catch (error) {
      notify.notifyError((error as ResponseStructure<null>).errorMessage || t('role.deleteFailed'), 0)
    } finally {
      isDeleting.value = false
    }
  })
}

/** 角色列表的路由位置 */
function buildListRoute(): RouteLocationRaw {
  return { name: 'roleManagementList' }
}

/** 編輯角色頁的路由位置 */
function buildEditRoute(): RouteLocationRaw {
  return { name: 'roleManagementEdit', params: { roleId } }
}

/** 用戶列表並帶入這個角色的篩選 */
function buildUserListRoute(): RouteLocationRaw {
  return { name: 'userManagementList', query: { roleName: role.value?.name ?? '' } }
}
</script>
