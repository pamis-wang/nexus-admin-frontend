<template>
  <x-breadcrumb :items="[{ label: '首頁', icon: 'home', to: { name: 'home' } }, { label: '系統管理' }, { label: '角色管理' }]" />

  <!-- 功能操作區 -->
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm">
      <div class="row justify-between items-center">
        <div class="text-h6 text-primary">
          <q-icon name="mdi-account-group" class="q-mr-sm" />
          角色管理
        </div>
        <div class="row q-gutter-sm">
          <q-btn unelevated color="primary" icon="mdi-plus" label="新增角色" :to="{ name: 'roleManagementAdd' }" />
          <q-btn flat color="grey" icon="mdi-refresh" label="重新整理" :loading="isLoading" @click="loadRoles" />
        </div>
      </div>
    </q-card-section>
  </q-card>

  <!-- 角色列表 -->
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm">
      <x-table v-model:pagination="pagination" :rows="rows" :columns="columns" :loading="isLoading" row-key="id">
        <template #body-cell-number="props">
          <q-td :props="props">{{ props.rowIndex + 1 }}</q-td>
        </template>

        <template #body-cell-name="props">
          <q-td :props="props">
            <span>{{ props.value }}</span>
            <q-badge v-if="props.row.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props">
            <x-icon tooltip="檢視權限" color="info" icon="mdi-eye-outline" flat dense :to="{ name: 'roleManagementView', params: { roleId: props.row.id } }" />
            <x-icon
              tooltip="編輯角色"
              color="primary"
              icon="mdi-file-document-edit-outline"
              flat
              dense
              :to="{ name: 'roleManagementEdit', params: { roleId: props.row.id } }"
            />
            <!-- 系統預設角色後端會回 403，直接不給刪 -->
            <x-icon
              v-if="!props.row.isSystemDefault"
              tooltip="刪除角色"
              color="negative"
              icon="mdi-trash-can-outline"
              flat
              dense
              @click="handleDelete(props.row)"
            />
          </q-td>
        </template>
      </x-table>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { deleteAdminRoleById, getAdminRoles } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import type { RoleManagementRow } from '@/pages/RoleManagement/types'

const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'RoleManagementList', enabled: import.meta.env.DEV })

const isLoading = ref(false)
const rows = ref<RoleManagementRow[]>([])
const pagination = ref<XPagination>({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 0 })
const columns: XTableColumn[] = [
  { name: 'number', align: 'center', label: '項次', field: '', style: 'width: 60px' },
  { name: 'name', align: 'left', label: '角色名稱', field: (row) => row.name },
  { name: 'userCount', align: 'center', label: '用戶人數', field: (row) => row.userCount, style: 'width: 120px' },
  { name: 'action', align: 'center', label: '操作', field: '', style: 'width: 160px' },
]

onMounted(() => {
  loadRoles()
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
      pagination.value.rowsCount = rows.value.length
    } else if (response.result.error) {
      notify.notifyError(response.result.error.message, 0)
    }
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('載入角色列表失敗', errorMessage)
    notify.notifyError(errorMessage, 0)
  } finally {
    isLoading.value = false
  }
}

/**
 * 刪除角色前的確認與前置檢查
 * @param row 要刪除的角色
 */
function handleDelete(row: RoleManagementRow) {
  // 後端在角色仍被指派時回 409，先擋下來並說清楚還有幾個人在用
  if (row.userCount > 0) {
    dialog.showWarning(`「${row.name}」目前有 ${row.userCount} 位用戶在使用，請先調整這些用戶的角色再刪除。`, '無法刪除')
    return
  }

  dialog.showConfirm(`確定要刪除角色「${row.name}」嗎？角色的權限設定會一併移除，此操作無法復原。`, '刪除角色').onOk(() => {
    deleteRole(row)
  })
}

/**
 * 執行刪除
 * @param row 要刪除的角色
 */
async function deleteRole(row: RoleManagementRow) {
  isLoading.value = true
  try {
    const response = await deleteAdminRoleById(row.id)

    if (response.success) {
      notify.notifySuccess(`角色「${row.name}」已刪除`)
      await loadRoles()
      return
    }

    notify.notifyError(response.result.error?.message || '刪除角色失敗', 0)
  } catch (error) {
    const failure = error as ResponseStructure<null>
    const errorMessage = failure.errorMessage || '未知錯誤'
    logger.error('刪除角色失敗', { status: failure.status, errorMessage })

    if (failure.status === 403) {
      notify.notifyError(errorMessage, 0)
    } else if (failure.status === 409) {
      notify.notifyError(errorMessage, 0)
    } else {
      notify.notifyError(errorMessage, 0)
    }
  } finally {
    isLoading.value = false
  }
}
</script>
