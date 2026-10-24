<template>
  <x-breadcrumb
    :items="[{ label: t('menu.home'), icon: 'mdi-home', to: { name: 'home' } }, { label: t('menu.systemManagement') }, { label: t('user.title') }]"
  />

  <!-- 功能操作區 -->
  <x-page-header :title="t('user.title')" icon="mdi-account-circle">
    <template #actions>
      <q-btn unelevated color="primary" icon="mdi-plus" :label="t('user.action.add')" :to="{ name: 'userManagementAdd' }" data-tour="user-add-button" />
      <q-btn flat color="grey" icon="mdi-refresh" :label="t('common.action.refresh')" :loading="isLoading" @click="loadUsers" />
    </template>
  </x-page-header>

  <!-- 篩選條件；全部在前端比對，不另外打 API -->
  <q-card flat bordered class="q-mt-xs" data-tour="user-filter-section">
    <q-card-section class="q-pa-sm">
      <div class="row items-center q-gutter-sm">
        <q-input v-model="filter.account" :placeholder="t('user.placeholder.account')" outlined dense clearable style="width: 180px">
          <template #prepend>
            <q-icon name="mdi-account" />
          </template>
        </q-input>

        <q-input v-model="filter.fullName" :placeholder="t('user.placeholder.fullName')" outlined dense clearable style="width: 180px">
          <template #prepend>
            <q-icon name="mdi-account-box" />
          </template>
        </q-input>

        <q-input v-model="filter.email" :placeholder="t('user.placeholder.email')" outlined dense clearable style="width: 220px">
          <template #prepend>
            <q-icon name="mdi-email-outline" />
          </template>
        </q-input>

        <q-select
          v-model="filter.roleName"
          :options="roleNameOptions"
          :label="t('user.field.role')"
          outlined
          dense
          clearable
          options-dense
          style="width: 180px"
        />

        <q-select
          v-model="filter.accountStatus"
          :options="accountStatusOptions"
          :label="t('user.field.accountStatus')"
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
          <div class="text-caption text-grey-7">{{ t('user.filterSummary', { found: filteredRows.length, total: rows.length }) }}</div>
          <q-btn flat color="grey" icon="mdi-filter-remove-outline" :label="t('user.action.clearFilters')" @click="clearFilter" />
        </template>
      </div>
    </q-card-section>
  </q-card>

  <!-- 用戶列表 -->
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm" data-tour="user-result-table">
      <x-table v-model:pagination="paginationWithCount" :rows="filteredRows" :columns="columns" :loading="isLoading" row-key="id">
        <template #body-cell-number="props">
          <q-td :props="props">{{ props.rowIndex + 1 }}</q-td>
        </template>

        <template #body-cell-account="props">
          <q-td :props="props">
            <span>{{ props.value }}</span>
            <q-badge v-if="props.row.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">{{ t('user.status.systemDefault') }}</q-badge>
          </q-td>
        </template>

        <template #body-cell-roleNames="props">
          <q-td :props="props">
            <template v-if="props.row.roleNames.length > 0">
              <q-chip v-for="roleName in props.row.roleNames" :key="roleName" dense color="primary" text-color="white" class="q-ma-xs">
                {{ roleName }}
              </q-chip>
            </template>
            <span v-else class="text-caption text-grey-6">{{ t('user.empty.noRole') }}</span>
          </q-td>
        </template>

        <template #body-cell-loginState="props">
          <q-td :props="props">
            <q-badge v-if="props.row.hasNoLogin" color="grey-5" class="q-ma-xs">{{ t('user.status.noLogin') }}</q-badge>
            <q-badge v-if="props.row.isLocked" color="negative" class="q-ma-xs">{{ t('user.status.locked') }}</q-badge>
            <span v-if="!props.row.hasNoLogin && !props.row.isLocked" class="text-caption text-grey-6">{{ t('user.status.normal') }}</span>
          </q-td>
        </template>

        <template #body-cell-isDisabled="props">
          <q-td :props="props">
            <!-- 只顯示狀態，不提供切換；與檢視頁、編輯頁的標籤用同一組樣式 -->
            <q-badge :color="props.row.isDisabled ? 'grey-6' : 'positive'">
              {{ props.row.isDisabled ? t('user.status.disabled') : t('user.status.enabled') }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-action="props">
          <!-- 只有第一列帶錨點，避免每一列都產生同名錨點 -->
          <q-td :props="props" :data-tour="props.rowIndex === 0 ? 'user-row-actions' : undefined">
            <x-icon
              :tooltip="t('user.action.view')"
              color="primary"
              icon="mdi-eye-outline"
              :size="props.isDense ? 'sm' : 'md'"
              flat
              dense
              :to="{ name: 'userManagementView', params: { userId: props.row.id } }"
            />
            <x-icon
              :tooltip="t('common.action.edit')"
              color="warning"
              icon="mdi-file-document-edit-outline"
              :size="props.isDense ? 'sm' : 'md'"
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
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { getAdminUsers } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'
import type { AdminUserManagementAccountStatusOption, AdminUserManagementFilter, AdminUserManagementRow } from '@/pages/AdminUserManagement/types'

const route = useRoute()
const { t } = useI18n()
const notify = useNotify()
const logger = useLogger({ prefix: 'AdminUserManagementList', enabled: import.meta.env.DEV })

const isLoading = ref(false)
const rows = ref<AdminUserManagementRow[]>([])
const filter = reactive<AdminUserManagementFilter>({ account: null, fullName: null, email: null, roleName: roleNameFromQuery(), accountStatus: null })
const pagination = ref<XPagination>({ sortBy: 'account', descending: false, page: 1, rowsPerPage: 0 })

// 欄位標題隨語系切換
const columns = computed<XTableColumn[]>(() => [
  { name: 'number', align: 'center', label: t('common.column.index'), field: '', style: 'width: 60px' },
  { name: 'account', align: 'left', label: t('user.column.account'), field: (row) => row.account },
  { name: 'fullName', align: 'left', label: t('user.column.fullName'), field: (row) => row.fullName || '-' },
  { name: 'email', align: 'left', label: t('user.column.email'), field: (row) => row.email },
  { name: 'roleNames', align: 'left', label: t('user.column.roles'), field: '' },
  { name: 'loginState', align: 'center', label: t('user.column.loginState'), field: '', style: 'width: 150px' },
  { name: 'isDisabled', align: 'center', label: t('user.column.accountStatus'), field: '', style: 'width: 120px' },
  { name: 'action', align: 'center', label: t('user.column.actions'), field: '', style: 'width: 120px' },
])
// 用詞與表格裡的狀態標籤一致，避免同一欄位在篩選與列表上叫不同名字
const accountStatusOptions = computed<AdminUserManagementAccountStatusOption[]>(() => [
  { value: 'enabled', label: t('user.status.enabled') },
  { value: 'disabled', label: t('user.status.disabled') },
])
/** 角色篩選的選項，取自目前列表裡出現過的角色名稱 */
const roleNameOptions = computed<string[]>(() => {
  const roleNames = new Set<string>()
  rows.value.forEach((row) => row.roleNames.forEach((roleName) => roleNames.add(roleName)))
  return Array.from(roleNames).sort((left, right) => left.localeCompare(right, 'zh-Hant'))
})
/** 套用篩選條件後要顯示的列 */
const filteredRows = computed<AdminUserManagementRow[]>(() => filterRows())
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
  }
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
        roleNames: user.roleMappings.map((mapping) => mapping.roleName ?? t('user.empty.unnamedRole')),
        hasNoLogin: user.logins.length === 0,
        isLocked: user.logins.some((login) => login.lockedUntil !== null),
      }))
    } else if (response.result.error) {
      notify.notifyError(response.result.error.message, 0)
    }
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || t('common.unknownError')
    logger.error('載入用戶列表失敗', errorMessage)
    notify.notifyError(errorMessage, 0)
  } finally {
    isLoading.value = false
  }
}

/**
 * 網址上帶的角色篩選
 *
 * 從角色檢視頁的「查看用戶」進來時會帶 ?roleName=，直接套用；角色名稱整個系統內不重複，可以當篩選值
 * @returns 角色名稱；沒帶或是空白時為 null
 */
function roleNameFromQuery(): string | null {
  const roleName = route.query.roleName
  return typeof roleName === 'string' && roleName.trim() !== '' ? roleName : null
}

/**
 * 套用篩選條件
 *
 * 五個條件之間是 AND；文字欄位一律去掉前後空白後轉小寫做部分符合。
 * @returns 篩選後的用戶列
 */
function filterRows(): AdminUserManagementRow[] {
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
</script>
