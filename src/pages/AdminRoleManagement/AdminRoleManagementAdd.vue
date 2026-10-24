<template>
  <x-breadcrumb
    :items="[
      { label: '首頁', icon: 'mdi-home', to: { name: 'home' } },
      { label: '系統管理' },
      { label: '角色管理', to: { name: 'roleManagementList' } },
      { label: '新增角色' },
    ]"
  />

  <x-page-header title="新增角色" icon="mdi-shield-plus-outline" />

  <x-loading-state :loading="isLoading" message="載入權限設定中..." />

  <q-card v-if="!isLoading" flat bordered class="q-mt-xs">
    <q-card-section>
      <q-banner v-if="loadErrorMessage !== null" dense rounded class="bg-negative text-white">
        <template #avatar>
          <q-icon name="mdi-alert-circle-outline" />
        </template>
        {{ loadErrorMessage }}
      </q-banner>

      <template v-else>
        <x-section-header-bar title="基本資料" />
        <q-form ref="formRef" @submit="handleSubmit">
          <div class="row q-col-gutter-md q-mt-xs" data-tour="role-form-name">
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
            <div class="col-12 col-md-6">
              <q-select
                v-model="templateRoleId"
                :options="templateOptions"
                label="以既有角色為範本"
                emit-value
                map-options
                outlined
                dense
                :loading="isApplyingTemplate"
                hint="只複製權限，之後兩個角色互不影響"
                @update:model-value="handleTemplateChange"
              >
                <template #prepend>
                  <div style="width: 8px" />
                </template>
              </q-select>
            </div>
          </div>
        </q-form>

        <x-section-header-bar title="權限設定" class="q-mt-md" />
        <div class="text-caption q-mt-xs q-mb-sm">勾選「新增／修改／刪除」時會自動勾選「檢視」</div>
        <div data-tour="role-permission-matrix">
          <AdminRolePermissionMatrix :rows="matrix.rows.value" @set-cell="handleSetCell" @toggle-row="handleToggleRow" @toggle-column="handleToggleColumn" />
        </div>
      </template>
    </q-card-section>
  </q-card>

  <!-- 固定操作列的高度，避免蓋住內容最後一段 -->
  <div class="role-form-action-spacer" />

  <q-page-sticky position="bottom" expand>
    <q-card flat bordered square class="full-width">
      <q-card-section class="row items-center no-wrap q-py-sm q-gutter-sm">
        <div class="col text-body2 row items-center no-wrap" aria-live="polite">
          <q-icon name="mdi-information-outline" class="q-mr-xs" />
          新角色儲存前不會影響任何用戶
        </div>
        <div class="row no-wrap q-gutter-sm" data-tour="role-form-submit">
          <q-btn flat color="grey" label="取消" :to="buildListRoute()" />
          <q-btn flat color="grey" label="重設" :disable="!hasChanges" @click="handleReset" />
          <q-btn
            unelevated
            color="primary"
            icon="mdi-content-save-outline"
            label="儲存"
            :loading="isSubmitting"
            :disable="isLoading || loadErrorMessage !== null"
            @click="handleSubmit"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-page-sticky>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, useRouter, type RouteLocationRaw } from 'vue-router'
import type { QForm } from 'quasar'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { createAdminRole, getAdminRolePermissionMatrix, getAdminRoles } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import { useAdminRolePermissionMatrix } from '@/pages/AdminRoleManagement/composables/useAdminRolePermissionMatrix'
import AdminRolePermissionMatrix from '@/pages/AdminRoleManagement/components/AdminRolePermissionMatrix.vue'
import type { AdminRoleManagementFormData, AdminRoleManagementRow, AdminRolePermissionAction } from '@/pages/AdminRoleManagement/types'

/** 範本選單「不使用範本」的值 */
const NO_TEMPLATE = ''

const router = useRouter()
const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'AdminRoleManagementAdd', enabled: import.meta.env.DEV })
const matrix = useAdminRolePermissionMatrix()

const formRef = useTemplateRef<QForm>('formRef')
const isLoading = ref(true)
const isSubmitting = ref(false)
const isApplyingTemplate = ref(false)
/** 權限設定的骨架載入失敗的說明；有值時不能儲存 */
const loadErrorMessage = ref<string | null>(null)
const formData = reactive<AdminRoleManagementFormData>({ name: '' })
/** 可以當範本的角色 */
const templateRoles = ref<AdminRoleManagementRow[]>([])
const templateRoleId = ref<string>(NO_TEMPLATE)
/** 儲存成功後離開不必再確認 */
const isSaved = ref(false)

const templateOptions = computed(() => [
  { label: '不使用範本（從零開始）', value: NO_TEMPLATE },
  ...templateRoles.value.map((role) => ({ label: role.isSystemDefault ? `${role.name}（系統預設）` : role.name, value: role.id })),
])
/** 有沒有填過任何東西；有就要在離開前確認 */
const hasChanges = computed<boolean>(() => formData.name.trim() !== '' || matrix.changedCount.value > 0)

onMounted(() => {
  loadMatrix()
})

onBeforeRouteLeave(async () => {
  if (isSaved.value || !hasChanges.value) return true

  return await confirmLeave()
})

/**
 * 載入範本清單與權限設定的骨架
 *
 * 權限矩陣要以全部資源為底；後端每個角色的權限矩陣都是以全部資源為底回傳，
 * 借第一個角色的權限樹當骨架、權限全部不勾，就不必另外要求資源管理的檢視權限
 */
async function loadMatrix() {
  isLoading.value = true
  try {
    const rolesResponse = await getAdminRoles()
    templateRoles.value = (rolesResponse.result.data ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      isSystemDefault: role.isSystemDefault,
      userCount: role.userCount,
    }))

    const skeletonRole = templateRoles.value[0]
    if (skeletonRole === undefined) {
      loadErrorMessage.value = '找不到任何角色，無法取得權限設定的項目，請聯絡系統管理者。'
      return
    }

    const matrixResponse = await getAdminRolePermissionMatrix(skeletonRole.id)
    matrix.loadBlank(matrixResponse.result.data?.permissions ?? [])
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('載入權限設定失敗', errorMessage)
    loadErrorMessage.value = `載入權限設定失敗：${errorMessage}`
  } finally {
    isLoading.value = false
  }
}

/** 套用範本角色的權限；選「不使用範本」就全部取消 */
async function handleTemplateChange(roleId: string) {
  if (roleId === NO_TEMPLATE) {
    matrix.clear()
    return
  }

  isApplyingTemplate.value = true
  try {
    const response = await getAdminRolePermissionMatrix(roleId)
    matrix.applyTemplate(response.result.data?.permissions ?? [])
    const roleName = templateRoles.value.find((role) => role.id === roleId)?.name ?? ''
    notify.notifyInfo(`已套用「${roleName}」的權限作為起點，可以再調整`)
  } catch (error) {
    templateRoleId.value = NO_TEMPLATE
    notify.notifyError((error as ResponseStructure<null>).errorMessage || '載入範本角色的權限失敗', 0)
  } finally {
    isApplyingTemplate.value = false
  }
}

/** 驗證後送出；名稱沒填只標示欄位並捲過去，不跳對話框 */
async function handleSubmit() {
  const isValid = await formRef.value?.validate(true)
  if (isValid !== true) return

  isSubmitting.value = true
  try {
    const name = formData.name.trim()
    await createAdminRole({ name, permissions: matrix.buildPermissionItems() })
    isSaved.value = true
    notify.notifySuccess(`角色「${name}」已新增`)
    await router.push(buildListRoute())
  } catch (error) {
    const failure = error as ResponseStructure<null>
    logger.error('新增角色失敗', { status: failure.status, errorMessage: failure.errorMessage })
    notify.notifyError(failure.errorMessage || '新增角色失敗', 0)
  } finally {
    isSubmitting.value = false
  }
}

/** 還原成剛進頁面的樣子 */
function handleReset() {
  formData.name = ''
  templateRoleId.value = NO_TEMPLATE
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
      .showConfirm('新角色還沒儲存，離開後填寫的內容會遺失。', '離開這一頁？')
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
      .onDismiss(() => resolve(false))
  })
}

/** 角色列表的路由位置 */
function buildListRoute(): RouteLocationRaw {
  return { name: 'roleManagementList' }
}
</script>

<style scoped>
.role-form-action-spacer {
  height: 72px;
}
</style>
