<template>
  <x-breadcrumb
    :items="[
      { label: t('menu.home'), icon: 'mdi-home', to: { name: 'home' } },
      { label: t('menu.systemManagement') },
      { label: t('role.title'), to: { name: 'roleManagementList' } },
      { label: t('role.editTitle') },
    ]"
  />

  <x-loading-state :loading="isLoading" :message="t('role.loading.role')" />

  <template v-if="!isLoading && role !== null">
    <!-- 標題放載入當下的名稱，不隨下方輸入框跳動 -->
    <x-page-header :overline="t('role.editTitle')" :title="role.name" icon="mdi-shield-edit-outline">
      <template #badges>
        <q-badge v-if="role.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">{{ t('role.status.systemDefault') }}</q-badge>
      </template>
      <template #meta>
        {{ t('role.meta.userCount', role.userCount) }}
        <span v-if="role.userCount > 0">{{ t('role.meta.saveImpact', role.userCount) }}</span>
      </template>
    </x-page-header>

    <q-card flat bordered class="q-mt-xs">
      <q-card-section>
        <x-section-header-bar :title="t('role.section.basic')" />
        <q-form ref="formRef" @submit="handleSubmit">
          <div class="row q-col-gutter-md q-mt-xs">
            <div class="col-12 col-md-6">
              <q-input
                v-model="formData.name"
                :label="t('role.field.name')"
                maxlength="50"
                counter
                outlined
                dense
                autocomplete="off"
                :rules="[(value: string) => value.trim() !== '' || t('role.validation.nameRequired')]"
              >
                <template #prepend>
                  <q-icon name="mdi-asterisk" color="negative" size="8px" />
                </template>
              </q-input>
            </div>
          </div>
        </q-form>

        <x-section-header-bar :title="t('role.section.permissions')" class="q-mt-md" />
        <div class="text-caption q-mt-xs q-mb-sm">{{ t('role.hint.autoGrantRule') }}</div>
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
            {{ changedCount > 0 ? t('role.unsavedCount', changedCount) : t('role.noUnsavedChanges') }}
          </div>
          <q-btn flat color="grey" :label="t('common.action.cancel')" :to="buildViewRoute()" />
          <q-btn flat color="grey" :label="t('common.action.resetForm')" :disable="changedCount === 0" @click="handleReset" />
          <q-btn
            unelevated
            color="primary"
            icon="mdi-content-save-outline"
            :label="t('common.action.save')"
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
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()
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
    const errorMessage = (error as ResponseStructure<null>).errorMessage || t('role.loadFailed')
    logger.error('載入角色失敗', errorMessage)
    dialog.showError(errorMessage, t('role.loadFailedTitle'))
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
    notify.notifySuccess(t('role.updated', { name }))
    await router.push(buildViewRoute())
  } catch (error) {
    const failure = error as ResponseStructure<null>
    logger.error('更新角色失敗', { status: failure.status, errorMessage: failure.errorMessage })

    // 版本不符（別人先存了）或名稱重複都回 409；留在原頁讓使用者決定要不要重新整理
    if (failure.status === 409) {
      dialog.showWarning(t('role.conflict'), t('role.conflictTitle'))
    } else {
      notify.notifyError(failure.errorMessage || t('role.updateFailed'), 0)
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
  notify.notifyInfo(t('role.reverted'))
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

/**
 * 連動了其他操作時告訴使用者發生了什麼
 * @param hintKey 說明的翻譯鍵；沒有連動時為 null
 */
function notifyHint(hintKey: string | null) {
  if (hintKey !== null) notify.notifyInfo(t(hintKey))
}

/** 離開前確認；回傳是否離開 */
function confirmLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    dialog
      .showConfirm(t('role.leaveConfirm', changedCount.value), t('role.leaveTitle'))
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
