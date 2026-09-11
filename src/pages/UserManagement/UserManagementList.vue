<template>
  <div class="q-pa-md">
    <x-breadcrumb :items="[{ label: '首頁', icon: 'home', to: { name: 'home' } }, { label: '系統管理' }, { label: '用戶管理' }]" />

    <!-- 功能操作區 -->
    <q-card flat bordered class="q-mt-xs">
      <q-card-section class="q-pa-sm">
        <div class="row justify-between items-center">
          <div class="text-h6 text-primary">
            <q-icon name="mdi-account-circle" class="q-mr-sm" />
            用戶管理
          </div>
          <div class="row q-gutter-sm">
            <q-btn unelevated color="primary" icon="mdi-plus" label="新增用戶" :to="{ name: 'userManagementAdd' }" />
            <q-btn flat color="grey" icon="mdi-refresh" label="重新整理" :loading="isLoading" @click="loadUsers" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- 用戶列表 -->
    <q-card flat bordered class="q-mt-xs">
      <q-card-section class="q-pa-sm">
        <x-table v-model:pagination="pagination" :rows="rows" :columns="columns" :loading="isLoading" row-key="id">
          <template #body-cell-number="props">
            <q-td :props="props">{{ props.rowIndex + 1 }}</q-td>
          </template>

          <template #body-cell-account="props">
            <q-td :props="props">
              <span>{{ props.value }}</span>
              <q-badge v-if="props.row.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
            </q-td>
          </template>

          <template #body-cell-roleNames="props">
            <q-td :props="props">
              <template v-if="props.row.roleNames.length > 0">
                <q-chip v-for="roleName in props.row.roleNames" :key="roleName" dense color="primary" text-color="white" class="q-ma-xs">
                  {{ roleName }}
                </q-chip>
              </template>
              <span v-else class="text-caption text-grey-6">未指派角色</span>
            </q-td>
          </template>

          <template #body-cell-loginState="props">
            <q-td :props="props">
              <q-badge v-if="props.row.hasNoLogin" color="grey-5" class="q-ma-xs">尚未綁定登入方式</q-badge>
              <q-badge v-if="props.row.isLocked" color="negative" class="q-ma-xs">鎖定中</q-badge>
              <span v-if="!props.row.hasNoLogin && !props.row.isLocked" class="text-caption text-grey-6">正常</span>
            </q-td>
          </template>

          <template #body-cell-isDisabled="props">
            <q-td :props="props">
              <!-- XSwitch 沒有插槽，提示掛在外層 span 上；停用的按鈕本身也收不到滑鼠事件 -->
              <span>
                <x-switch
                  :model-value="!props.row.isDisabled"
                  size="sm"
                  active-text="啟用"
                  inactive-text="停用"
                  active-color="positive"
                  inactive-color="grey"
                  :disable="isToggleDisabled(props.row)"
                  @update:model-value="(value: boolean) => handleToggleDisabled(props.row, value)"
                />
                <q-tooltip v-if="isToggleDisabled(props.row)">
                  {{ props.row.isSystemDefault ? '系統預設帳號不允許停用' : '不能停用自己的帳號' }}
                </q-tooltip>
              </span>
            </q-td>
          </template>

          <template #body-cell-action="props">
            <q-td :props="props">
              <x-icon tooltip="檢視" color="info" icon="mdi-eye-outline" flat dense :to="{ name: 'userManagementView', params: { userId: props.row.id } }" />
              <x-icon
                tooltip="編輯"
                color="primary"
                icon="mdi-file-document-edit-outline"
                flat
                dense
                :to="{ name: 'userManagementEdit', params: { userId: props.row.id } }"
              />
            </q-td>
          </template>
        </x-table>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import { getAdminUsers, updateAdminUserDisabledState } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'
import { useUserStore } from '@/stores/useUser'
import type { UserManagementRow } from '@/pages/UserManagement/types'

const dialog = useDialog()
const logger = useLogger({ prefix: 'UserManagementList', enabled: import.meta.env.DEV })
const userStore = useUserStore()

const isLoading = ref(false)
const rows = ref<UserManagementRow[]>([])
const pagination = ref<XPagination>({ sortBy: 'account', descending: false, page: 1, rowsPerPage: 0 })
const columns: XTableColumn[] = [
  { name: 'number', align: 'center', label: '項次', field: '', style: 'width: 60px' },
  { name: 'account', align: 'left', label: '帳號', field: (row) => row.account },
  { name: 'fullName', align: 'left', label: '姓名', field: (row) => row.fullName || '—' },
  { name: 'email', align: 'left', label: '電子信箱', field: (row) => row.email },
  { name: 'roleNames', align: 'left', label: '角色', field: '' },
  { name: 'loginState', align: 'center', label: '登入狀態', field: '', style: 'width: 150px' },
  { name: 'isDisabled', align: 'center', label: '帳號狀態', field: '', style: 'width: 120px' },
  { name: 'action', align: 'center', label: '操作', field: '', style: 'width: 120px' },
]

/** 目前登入者的唯一編號，用來擋掉「停用自己」 */
const currentUserId = computed(() => userStore.userProfile?.id ?? '')

onMounted(() => {
  loadUsers()
})

/** 載入用戶列表 */
async function loadUsers() {
  isLoading.value = true
  try {
    const response = await getAdminUsers()

    if (response.status === 200 && response.result.data) {
      rows.value = response.result.data.map((user) => ({
        id: user.id,
        account: user.account,
        email: user.email,
        fullName: user.fullName,
        isSystemDefault: user.isSystemDefault,
        isDisabled: user.isDisabled,
        roleNames: user.roleMappings.map((mapping) => mapping.roleName ?? '（未命名角色）'),
        hasNoLogin: user.logins.length === 0,
        isLocked: user.logins.some((login) => login.lockedUntil !== null),
      }))
      pagination.value.rowsCount = rows.value.length
    } else if (response.result.error) {
      dialog.showWarning(response.result.error.message, '載入失敗')
    }
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('載入用戶列表失敗', errorMessage)
    dialog.showError(errorMessage, '載入用戶列表失敗')
  } finally {
    isLoading.value = false
  }
}

/**
 * 是否不給切換
 *
 * 後端只擋停用：系統預設帳號與自己的帳號不能停用，但都可以啟用回來。
 * @param row 用戶列
 */
function isToggleDisabled(row: UserManagementRow): boolean {
  if (row.isDisabled) {
    return false
  }
  return row.isSystemDefault || row.id === currentUserId.value
}

/**
 * 切換啟停用狀態
 * @param row 用戶列
 * @param isEnabled 切換後是否為啟用
 */
function handleToggleDisabled(row: UserManagementRow, isEnabled: boolean) {
  const isDisabled = !isEnabled
  const action = isDisabled ? '停用' : '啟用'
  const message = isDisabled ? `確定要停用「${row.account}」嗎？停用後該帳號會立即失去全部權限。` : `確定要啟用「${row.account}」嗎？`

  dialog.showConfirm(message, `${action}帳號`).onOk(() => {
    updateDisabledState(row, isDisabled)
  })
}

/**
 * 送出啟停用變更
 * @param row 用戶列
 * @param isDisabled 是否停用
 */
async function updateDisabledState(row: UserManagementRow, isDisabled: boolean) {
  isLoading.value = true
  try {
    const response = await updateAdminUserDisabledState(row.id, { isDisabled })

    if (response.success) {
      dialog.showSuccess(`「${row.account}」已${isDisabled ? '停用' : '啟用'}`)
      await loadUsers()
      return
    }

    dialog.showError(response.result.error?.message || '更新帳號狀態失敗', '更新失敗')
  } catch (error) {
    const failure = error as ResponseStructure<null>
    const errorMessage = failure.errorMessage || '未知錯誤'
    logger.error('更新帳號狀態失敗', { status: failure.status, errorMessage })

    if (failure.status === 403) {
      dialog.showWarning(errorMessage, '不允許的操作')
    } else {
      dialog.showError(errorMessage, '更新失敗')
    }
  } finally {
    isLoading.value = false
  }
}
</script>
