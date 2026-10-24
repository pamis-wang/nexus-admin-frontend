<template>
  <x-breadcrumb
    :items="[{ label: t('menu.home'), icon: 'mdi-home', to: { name: 'home' } }, { label: t('menu.systemManagement') }, { label: t('role.title') }]"
  />

  <!-- 功能操作區 -->
  <x-page-header :title="t('role.title')" icon="mdi-account-group">
    <template #actions>
      <q-btn v-if="canCreate" unelevated color="primary" icon="mdi-plus" :label="t('role.action.add')" :to="buildAddRoute()" data-tour="role-add-button" />
      <q-btn flat color="grey" icon="mdi-refresh" :label="t('common.action.refresh')" :loading="isLoading" @click="loadRoles" />
    </template>
  </x-page-header>

  <!-- 篩選條件；全部在前端比對，不另外打 API -->
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm">
      <div class="row items-center q-gutter-sm">
        <q-input v-model="keyword" :placeholder="t('role.placeholder.search')" outlined dense clearable style="width: 260px">
          <template #prepend>
            <q-icon name="mdi-magnify" />
          </template>
        </q-input>
        <q-space />
        <div class="text-caption">{{ t('role.hint.deleteRule') }}</div>
      </div>
    </q-card-section>
  </q-card>

  <!-- 角色列表 -->
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm" data-tour="role-result-table">
      <x-table v-model:pagination="paginationWithCount" :rows="filteredRows" :columns="columns" :loading="isLoading" row-key="id">
        <template #body-cell-number="props">{{ props.rowIndex + 1 }}</template>

        <template #body-cell-name="props">
          {{ props.row.name }}
          <q-badge v-if="props.row.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">{{ t('role.status.systemDefault') }}</q-badge>
        </template>

        <!-- 有用戶管理權限才能點進去看是哪些人 -->
        <template #body-cell-userCount="props">
          <router-link v-if="canViewUsers && props.row.userCount > 0" :to="buildUserListRoute(props.row.name)">
            {{ props.row.userCount }}
            <q-tooltip>{{ t('role.hint.viewUsers') }}</q-tooltip>
          </router-link>
          <span v-else>{{ props.row.userCount }}</span>
        </template>

        <template #body-cell-action="props">
          <!-- 只有第一列帶錨點，避免每一列都產生同名錨點 -->
          <div class="row no-wrap justify-center" :data-tour="props.rowIndex === 0 ? 'role-row-actions' : undefined">
            <x-icon
              :tooltip="t('role.action.view')"
              color="primary"
              icon="mdi-eye-outline"
              :size="props.isDense ? 'sm' : 'md'"
              flat
              dense
              :to="buildViewRoute(props.row.id)"
            />
            <x-icon
              v-if="canUpdate"
              :tooltip="t('common.action.edit')"
              color="warning"
              icon="mdi-file-document-edit-outline"
              :size="props.isDense ? 'sm' : 'md'"
              flat
              dense
              :to="buildEditRoute(props.row.id)"
            />
            <template v-if="canDelete">
              <x-icon
                v-if="deleteBlockedReason(props.row) === null"
                :tooltip="t('role.action.delete')"
                color="negative"
                icon="mdi-trash-can-outline"
                :size="props.isDense ? 'sm' : 'md'"
                flat
                dense
                @click="confirmDelete(props.row)"
              />
              <!-- 停用的按鈕收不到滑鼠事件，說明掛在外層 -->
              <span v-else>
                <x-icon color="negative" icon="mdi-trash-can-outline" :size="props.isDense ? 'sm' : 'md'" flat dense disable />
                <q-tooltip>{{ deleteBlockedReason(props.row) }}</q-tooltip>
              </span>
            </template>
          </div>
        </template>
      </x-table>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { useUserStore } from '@/stores/useUser'
import { deleteAdminRoleById, getAdminRoles } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import type { AdminRoleManagementRow } from '@/pages/AdminRoleManagement/types'

/** 角色管理在權限表上的資源名稱 */
const ROLE_RESOURCE_NAME = '系統管理>角色管理'
/** 用戶管理在權限表上的資源名稱 */
const USER_RESOURCE_NAME = '系統管理>用戶管理'

const { t } = useI18n()
const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'AdminRoleManagementList', enabled: import.meta.env.DEV })
const userStore = useUserStore()

const isLoading = ref(false)
const rows = ref<AdminRoleManagementRow[]>([])
/** 角色名稱的關鍵字 */
const keyword = ref<string | null>(null)
const pagination = ref<XPagination>({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 0 })

// 欄位標題隨語系切換
const columns = computed<XTableColumn[]>(() => [
  { name: 'number', align: 'center', label: t('common.column.index'), field: '', style: 'width: 60px' },
  { name: 'name', align: 'left', label: t('role.column.name'), field: (row: AdminRoleManagementRow) => row.name, sortable: true },
  {
    name: 'userCount',
    align: 'center',
    label: t('role.column.userCount'),
    field: (row: AdminRoleManagementRow) => row.userCount,
    sortable: true,
    style: 'width: 120px',
  },
  { name: 'action', align: 'center', label: t('role.column.actions'), field: '', style: 'width: 160px' },
])
const canCreate = computed<boolean>(() => userStore.hasPermission(ROLE_RESOURCE_NAME, 'canCreate'))
const canUpdate = computed<boolean>(() => userStore.hasPermission(ROLE_RESOURCE_NAME, 'canUpdate'))
const canDelete = computed<boolean>(() => userStore.hasPermission(ROLE_RESOURCE_NAME, 'canDelete'))
const canViewUsers = computed<boolean>(() => userStore.hasPermission(USER_RESOURCE_NAME))
/** 套用關鍵字後要顯示的列 */
const filteredRows = computed<AdminRoleManagementRow[]>(() => filterRows())
/** 分頁物件；總筆數要跟著篩選結果走，否則頁數會拿未篩選的筆數去算 */
const paginationWithCount = computed<XPagination>({
  get: () => ({ ...pagination.value, rowsCount: filteredRows.value.length }),
  set: (value) => {
    pagination.value = value
  },
})

onMounted(() => {
  loadRoles()
})

// 條件一改就回到第一頁，否則會停在篩選後已經不存在的頁碼上，表格看起來是空的
watch(keyword, () => {
  pagination.value.page = 1
})

/** 載入角色列表 */
async function loadRoles() {
  isLoading.value = true
  try {
    const response = await getAdminRoles()

    if (response.status === 200 && response.result.data) {
      rows.value = response.result.data.map((role) => ({
        id: role.id,
        name: role.name,
        isSystemDefault: role.isSystemDefault,
        userCount: role.userCount,
      }))
    } else if (response.result.error) {
      notify.notifyError(response.result.error.message, 0)
    }
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || t('common.unknownError')
    logger.error('載入角色列表失敗', errorMessage)
    notify.notifyError(errorMessage, 0)
  } finally {
    isLoading.value = false
  }
}

/**
 * 刪除確認；角色連同權限矩陣一起刪除
 * @param row 要刪除的角色
 */
async function confirmDelete(row: AdminRoleManagementRow) {
  dialog.showConfirm(t('role.deleteConfirm', { name: row.name }), t('role.deleteTitle')).onOk(async () => {
    try {
      await deleteAdminRoleById(row.id)
      notify.notifySuccess(t('role.deleted', { name: row.name }))
      await loadRoles()
    } catch (error) {
      const failure = error as ResponseStructure<null>
      logger.error('刪除角色失敗', { status: failure.status, errorMessage: failure.errorMessage })
      notify.notifyError(failure.errorMessage || t('role.deleteFailed'), 0)
    }
  })
}

/**
 * 依關鍵字篩選角色名稱
 * @returns 篩選後的列
 */
function filterRows(): AdminRoleManagementRow[] {
  const term = keyword.value?.trim().toLowerCase() ?? ''
  if (term === '') return rows.value

  return rows.value.filter((row) => row.name.toLowerCase().includes(term))
}

/**
 * 不能刪除的原因；可以刪除時為 null
 *
 * 按鈕停用並說明原因，不藏起來，也不等按了才跳警告
 * @param row 角色
 */
function deleteBlockedReason(row: AdminRoleManagementRow): string | null {
  if (row.isSystemDefault) return t('role.deleteBlockedSystemDefault')
  if (row.userCount > 0) return t('role.deleteBlockedInUse', row.userCount)

  return null
}

/** 新增角色頁的路由位置 */
function buildAddRoute(): RouteLocationRaw {
  return { name: 'roleManagementAdd' }
}

/** 檢視角色頁的路由位置 */
function buildViewRoute(roleId: string): RouteLocationRaw {
  return { name: 'roleManagementView', params: { roleId } }
}

/** 編輯角色頁的路由位置 */
function buildEditRoute(roleId: string): RouteLocationRaw {
  return { name: 'roleManagementEdit', params: { roleId } }
}

/** 用戶列表並帶入角色篩選 */
function buildUserListRoute(roleName: string): RouteLocationRaw {
  return { name: 'userManagementList', query: { roleName } }
}
</script>
