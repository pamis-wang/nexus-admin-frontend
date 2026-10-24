<template>
  <x-breadcrumb
    :items="[
      { label: '首頁', icon: 'mdi-home', to: { name: 'home' } },
      { label: '系統管理' },
      { label: '角色管理', to: { name: 'roleManagementList' } },
      { label: '檢視角色' },
    ]"
  />

  <x-loading-state :loading="isLoading" message="載入角色資料中..." />

  <template v-if="!isLoading && role !== null">
    <x-page-header overline="角色" :title="role.name" icon="mdi-shield-account-outline">
      <template #badges>
        <q-badge v-if="role.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
      </template>
      <template #meta>
        用戶人數 {{ role.userCount }}
        <template v-if="canViewUsers && role.userCount > 0">
          ・
          <router-link :to="buildUserListRoute()">查看用戶</router-link>
        </template>
      </template>
      <template #actions>
        <q-btn outline color="secondary" icon="mdi-arrow-left" label="返回列表" :to="buildListRoute()" />
        <template v-if="canDelete">
          <q-btn
            v-if="deleteBlockedReason === null"
            outline
            color="negative"
            icon="mdi-trash-can-outline"
            label="刪除"
            :loading="isDeleting"
            @click="confirmDelete"
          />
          <!-- 停用的按鈕收不到滑鼠事件，說明掛在外層 -->
          <span v-else>
            <q-btn outline color="negative" icon="mdi-trash-can-outline" label="刪除" disable />
            <q-tooltip>{{ deleteBlockedReason }}</q-tooltip>
          </span>
        </template>
        <q-btn v-if="canUpdate" unelevated color="primary" icon="mdi-file-document-edit-outline" label="編輯角色" :to="buildEditRoute()" />
      </template>
    </x-page-header>

    <q-card flat bordered class="q-mt-xs">
      <q-card-section>
        <x-section-header-bar title="權限設定" />
        <div class="q-mt-sm">
          <AdminRolePermissionMatrix :rows="matrix.rows.value" is-readonly />
        </div>

        <x-section-header-bar :title="`使用此角色的用戶（${users.length}）`" class="q-mt-md" />
        <div class="q-mt-sm">
          <x-loading-state :loading="isLoadingUsers" message="載入用戶中..." />
          <template v-if="!isLoadingUsers">
            <div v-if="usersErrorMessage !== null" class="text-negative">{{ usersErrorMessage }}</div>
            <div v-else-if="users.length === 0">目前沒有用戶使用此角色</div>
            <div v-else class="row q-gutter-xs">
              <q-chip v-for="user in users" :key="user.id" dense square :outline="user.isDisabled" icon="mdi-account">
                {{ user.fullName ?? user.account }}
                <span v-if="user.isDisabled" class="q-ml-xs">（已停用）</span>
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

/** 角色管理在權限表上的資源名稱 */
const ROLE_RESOURCE_NAME = '系統管理>角色管理'
/** 用戶管理在權限表上的資源名稱 */
const USER_RESOURCE_NAME = '系統管理>用戶管理'

const route = useRoute()
const router = useRouter()
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

const canUpdate = computed<boolean>(() => userStore.hasPermission(ROLE_RESOURCE_NAME, 'canUpdate'))
const canDelete = computed<boolean>(() => userStore.hasPermission(ROLE_RESOURCE_NAME, 'canDelete'))
const canViewUsers = computed<boolean>(() => userStore.hasPermission(USER_RESOURCE_NAME))
/** 不能刪除的原因；可以刪除時為 null */
const deleteBlockedReason = computed<string | null>(() => {
  if (role.value === null) return null
  if (role.value.isSystemDefault) return '系統預設角色不能刪除'
  if (role.value.userCount > 0) return `仍有 ${role.value.userCount} 位用戶使用此角色，請先調整這些用戶的角色再刪除`

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
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '載入角色失敗'
    logger.error('載入角色失敗', errorMessage)
    dialog.showError(errorMessage, '載入角色失敗')
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
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('載入角色用戶失敗', errorMessage)
    usersErrorMessage.value = `無法載入用戶名單：${errorMessage}`
    notify.notifyError(usersErrorMessage.value, 0)
  } finally {
    isLoadingUsers.value = false
  }
}

/** 刪除確認；角色連同權限矩陣一起刪除 */
async function confirmDelete() {
  if (role.value === null) return

  const roleName = role.value.name
  dialog.showConfirm(`確定要刪除角色「${roleName}」嗎？角色的權限設定會一併移除，此操作無法復原。`, '刪除角色').onOk(async () => {
    isDeleting.value = true
    try {
      await deleteAdminRoleById(roleId)
      notify.notifySuccess(`角色「${roleName}」已刪除`)
      await router.push(buildListRoute())
    } catch (error) {
      notify.notifyError((error as ResponseStructure<null>).errorMessage || '刪除角色失敗', 0)
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
