<template>
  <x-breadcrumb
    :items="[
      { label: '首頁', icon: 'mdi-home', to: { name: 'home' } },
      { label: '系統管理' },
      { label: '角色管理', to: { name: 'roleManagementList' } },
      { label: '編輯角色' },
    ]"
  />

  <x-loading-state :loading="isLoading" message="載入角色資料中..." />

  <template v-if="!isLoading && role !== null">
    <!-- 標題放載入當下的名稱，不隨下方輸入框跳動 -->
    <x-page-header overline="編輯角色" :title="role.name" icon="mdi-shield-edit-outline">
      <template #badges>
        <q-badge v-if="role.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
      </template>
      <template #meta>
        用戶人數 {{ role.userCount }}
        <span v-if="role.userCount > 0">・儲存後這 {{ role.userCount }} 位用戶的權限立即改變</span>
      </template>
    </x-page-header>

    <q-card flat bordered class="q-mt-xs">
      <q-card-section>
        <x-section-header-bar title="基本資料" />
        <q-form ref="formRef" @submit="handleSubmit">
          <div class="row q-col-gutter-md q-mt-xs">
            <div class="col-12 col-md-6">
              <q-input
                v-model="formData.name"
                label="角色名稱"
                maxlength="50"
                counter
                outlined
                dense
                autocomplete="off"
                :rules="[(value: string) => value.trim() !== '' || '請輸入角色名稱']"
              >
                <template #prepend>
                  <q-icon name="mdi-asterisk" color="negative" size="8px" />
                </template>
              </q-input>
            </div>
          </div>
        </q-form>

        <x-section-header-bar title="權限設定" class="q-mt-md" />
        <div class="text-caption q-mt-xs q-mb-sm">勾選「新增／修改／刪除」時會自動勾選「檢視」</div>
        <AdminRolePermissionMatrix :rows="matrix.rows.value" @set-cell="handleSetCell" @toggle-row="handleToggleRow" @toggle-column="handleToggleColumn" />
      </q-card-section>
    </q-card>

    <!-- 固定操作列的高度，避免蓋住內容最後一段 -->
    <div class="role-form-action-spacer" />

    <q-page-sticky position="bottom" expand>
      <q-card flat bordered square class="full-width">
        <q-card-section class="row items-center no-wrap q-py-sm q-gutter-sm">
          <!-- warning 色當文字在白底上對比不足，只給圖示上色，文字用加粗區分 -->
          <div class="col text-body2 row items-center no-wrap" :class="{ 'text-weight-medium': changedCount > 0 }" aria-live="polite">
            <q-icon
              :name="changedCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-check'"
              :color="changedCount > 0 ? 'warning' : undefined"
              size="sm"
              class="q-mr-xs"
            />
            {{ changedCount > 0 ? `有 ${changedCount} 項未儲存的變更` : '沒有未儲存的變更' }}
          </div>
          <q-btn flat color="grey" label="取消" :to="buildViewRoute()" />
          <q-btn flat color="grey" label="重設" :disable="changedCount === 0" @click="handleReset" />
          <q-btn
            unelevated
            color="primary"
            icon="mdi-content-save-outline"
            label="儲存"
            :loading="isSubmitting"
            :disable="changedCount === 0"
            @click="handleSubmit"
          />
        </q-card-section>
      </q-card>
    </q-page-sticky>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import type { QForm } from 'quasar'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { getAdminRolePermissionMatrix, updateAdminRole } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import { useAdminRolePermissionMatrix } from '@/pages/AdminRoleManagement/composables/useAdminRolePermissionMatrix'
import AdminRolePermissionMatrix from '@/pages/AdminRoleManagement/components/AdminRolePermissionMatrix.vue'
import type { AdminRoleManagementFormData, AdminRoleManagementSummary, AdminRolePermissionAction } from '@/pages/AdminRoleManagement/types'

const route = useRoute()
const router = useRouter()
const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'AdminRoleManagementEdit', enabled: import.meta.env.DEV })
const matrix = useAdminRolePermissionMatrix()

const roleId = String(route.params.roleId ?? '')
const formRef = useTemplateRef<QForm>('formRef')
const isLoading = ref(true)
const isSubmitting = ref(false)
/** 載入時的角色；名稱比對、版本戳記都以它為準 */
const role = ref<AdminRoleManagementSummary | null>(null)
const formData = reactive<AdminRoleManagementFormData>({ name: '' })
/** 儲存成功後離開不必再確認 */
const isSaved = ref(false)

/** 未儲存的變更數：權限矩陣的格數，加上角色名稱 */
const changedCount = computed<number>(() => matrix.changedCount.value + (role.value !== null && formData.name.trim() !== role.value.name ? 1 : 0))

onMounted(() => {
  loadRole()
})

onBeforeRouteLeave(async () => {
  if (isSaved.value || changedCount.value === 0) return true

  return await confirmLeave()
})

/** 載入角色與權限矩陣；系統預設角色照樣可以調整權限，只是不能刪除 */
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
    formData.name = data.role.name
    matrix.load(data.permissions)
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '載入角色失敗'
    logger.error('載入角色失敗', errorMessage)
    dialog.showError(errorMessage, '載入角色失敗')
    await router.push({ name: 'roleManagementList' })
  } finally {
    isLoading.value = false
  }
}

/** 驗證後送出；名稱沒填只標示欄位並捲過去，不跳對話框 */
async function handleSubmit() {
  if (role.value === null || changedCount.value === 0) return

  const isValid = await formRef.value?.validate(true)
  if (isValid !== true) return

  isSubmitting.value = true
  try {
    const name = formData.name.trim()
    await updateAdminRole(roleId, { name, version: role.value.version, permissions: matrix.buildPermissionItems() })
    isSaved.value = true
    notify.notifySuccess(`角色「${name}」已更新`)
    await router.push(buildViewRoute())
  } catch (error) {
    const failure = error as ResponseStructure<null>
    logger.error('更新角色失敗', { status: failure.status, errorMessage: failure.errorMessage })

    // 版本不符（別人先存了）或名稱重複都回 409；留在原頁讓使用者決定要不要重新整理
    if (failure.status === 409) {
      dialog.showWarning('這個角色在你編輯期間已被其他人修改，或名稱與現有角色重複，請重新載入後再調整。', '版本衝突')
    } else {
      notify.notifyError(failure.errorMessage || '更新角色失敗', 0)
    }
  } finally {
    isSubmitting.value = false
  }
}

/** 還原成載入時的名稱與權限 */
function handleReset() {
  formData.name = role.value?.name ?? ''
  matrix.reset()
  formRef.value?.resetValidation()
  notify.notifyInfo('已還原為載入時的設定')
}

function handleSetCell(resourceId: string, action: AdminRolePermissionAction, value: boolean) {
  notifyHint(matrix.setCell(resourceId, action, value))
}

function handleToggleRow(resourceId: string) {
  notifyHint(matrix.toggleRow(resourceId))
}

function handleToggleColumn(action: AdminRolePermissionAction, leafIds: string[]) {
  notifyHint(matrix.toggleColumn(action, leafIds))
}

/** 連動了其他操作時告訴使用者發生了什麼 */
function notifyHint(hint: string | null) {
  if (hint !== null) notify.notifyInfo(hint)
}

/** 離開前確認；回傳是否離開 */
function confirmLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    dialog
      .showConfirm(`有 ${changedCount.value} 項未儲存的變更，離開後會遺失。`, '離開這一頁？')
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
      .onDismiss(() => resolve(false))
  })
}

/** 檢視角色頁的路由位置 */
function buildViewRoute(): RouteLocationRaw {
  return { name: 'roleManagementView', params: { roleId } }
}
</script>

<style scoped>
.role-form-action-spacer {
  height: 72px;
}
</style>
