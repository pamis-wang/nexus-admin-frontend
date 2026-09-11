<template>
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

  <!-- 篩選條件；全部在前端比對，不另外打 API -->
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm">
      <div class="row items-center q-gutter-sm">
        <q-input v-model="filter.account" placeholder="搜尋帳號" outlined dense clearable style="width: 180px">
          <template #prepend>
            <q-icon name="mdi-account" />
          </template>
        </q-input>

        <q-input v-model="filter.fullName" placeholder="搜尋姓名" outlined dense clearable style="width: 180px">
          <template #prepend>
            <q-icon name="mdi-account-box" />
          </template>
        </q-input>

        <q-input v-model="filter.email" placeholder="搜尋電子信箱" outlined dense clearable style="width: 220px">
          <template #prepend>
            <q-icon name="mdi-email-outline" />
          </template>
        </q-input>

        <q-select v-model="filter.roleName" :options="roleNameOptions" label="角色" outlined dense clearable options-dense style="width: 180px" />

        <q-select
          v-model="filter.accountStatus"
          :options="accountStatusOptions"
          label="帳號狀態"
          outlined
          dense
          clearable
          options-dense
          emit-value
          map-options
          style="width: 150px"
        />

        <q-space />

        <template v-if="hasActiveFilter">
          <div class="text-caption text-grey-7">找到 {{ filteredRows.length }} 筆／共 {{ rows.length }} 筆</div>
          <q-btn flat color="grey" icon="mdi-filter-remove-outline" label="清除篩選" @click="clearFilter" />
        </template>
      </div>
    </q-card-section>
  </q-card>

  <!-- 用戶列表 -->
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm">
      <x-table v-model:pagination="paginationWithCount" :rows="filteredRows" :columns="columns" :loading="isLoading" row-key="id">
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
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import { getAdminUsers, updateAdminUserDisabledState } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'
import { useUserStore } from '@/stores/useUser'
import type { UserManagementAccountStatusOption, UserManagementFilter, UserManagementRow } from '@/pages/UserManagement/types'

const dialog = useDialog()
const logger = useLogger({ prefix: 'UserManagementList', enabled: import.meta.env.DEV })
const userStore = useUserStore()

const isLoading = ref(false)
const rows = ref<UserManagementRow[]>([])
const filter = reactive<UserManagementFilter>({ account: null, fullName: null, email: null, roleName: null, accountStatus: null })
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
const accountStatusOptions: UserManagementAccountStatusOption[] = [
  { value: 'enabled', label: '啟用' },
  { value: 'disabled', label: '停用' },
]

/** 目前登入者的唯一編號，用來擋掉「停用自己」 */
const currentUserId = computed(() => userStore.userProfile?.id ?? '')
/** 角色篩選的選項，取自目前列表裡出現過的角色名稱 */
const roleNameOptions = computed<string[]>(() => {
  const roleNames = new Set<string>()
  rows.value.forEach((row) => row.roleNames.forEach((roleName) => roleNames.add(roleName)))
  return Array.from(roleNames).sort((left, right) => left.localeCompare(right, 'zh-Hant'))
})
/** 套用篩選條件後要顯示的列 */
const filteredRows = computed<UserManagementRow[]>(() => filterRows())
/** 是否有任何篩選條件生效 */
const hasActiveFilter = computed<boolean>(() => {
  const hasKeyword = [filter.account, filter.fullName, filter.email].some((keyword) => (keyword ?? '').trim().length > 0)
  return hasKeyword || filter.roleName !== null || filter.accountStatus !== null
})
/** 分頁物件；總筆數要跟著篩選結果走，否則頁數會拿未篩選的筆數去算 */
const paginationWithCount = computed<XPagination>({
  get: () => ({ ...pagination.value, rowsCount: filteredRows.value.length }),
  set: (value) => {
    pagination.value = value
  },
})

onMounted(() => {
  loadUsers()
})

// 條件一改就回到第一頁，否則會停在篩選後已經不存在的頁碼上，表格看起來是空的
watch(
  () => [filter.account, filter.fullName, filter.email, filter.roleName, filter.accountStatus],
  () => {
    pagination.value.page = 1
  },
)

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
 * 套用篩選條件
 *
 * 五個條件之間是 AND；文字欄位一律去掉前後空白後轉小寫做部分符合。
 * @returns 篩選後的用戶列
 */
function filterRows(): UserManagementRow[] {
  let result = rows.value

  const account = filter.account?.trim().toLowerCase() ?? ''
  if (account.length > 0) {
    result = result.filter((row) => row.account.toLowerCase().includes(account))
  }

  const fullName = filter.fullName?.trim().toLowerCase() ?? ''
  if (fullName.length > 0) {
    // 姓名可空，沒填姓名的用戶一律不符合姓名條件
    result = result.filter((row) => (row.fullName ?? '').toLowerCase().includes(fullName))
  }

  const email = filter.email?.trim().toLowerCase() ?? ''
  if (email.length > 0) {
    result = result.filter((row) => row.email.toLowerCase().includes(email))
  }

  const roleName = filter.roleName
  if (roleName !== null) {
    result = result.filter((row) => row.roleNames.includes(roleName))
  }

  if (filter.accountStatus !== null) {
    const isDisabled = filter.accountStatus === 'disabled'
    result = result.filter((row) => row.isDisabled === isDisabled)
  }

  return result
}

/** 清除全部篩選條件 */
function clearFilter() {
  filter.account = null
  filter.fullName = null
  filter.email = null
  filter.roleName = null
  filter.accountStatus = null
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
