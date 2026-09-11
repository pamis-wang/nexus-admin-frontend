<template>
  <x-breadcrumb
    :items="[
      { label: '首頁', icon: 'mdi-home', to: { name: 'home' } },
      { label: '系統管理' },
      { label: '角色管理', to: { name: 'roleManagementList' } },
      { label: '編輯角色' },
    ]"
  />

  <x-loading-state :loading="isLoadingRole" message="載入角色資料中..." />

  <q-card v-if="!isLoadingRole" flat bordered class="q-mt-xs">
    <q-card-section>
      <div class="text-h6 text-primary q-mb-md">
        <q-icon name="mdi-shield-edit-outline" class="q-mr-sm" />
        編輯角色
        <q-badge v-if="formData.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
      </div>

      <q-form class="q-gutter-md" @submit="handleSubmit" @reset="handleReset">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-input v-model="formData.name" label="角色名稱" :rules="[(value) => !!value?.trim() || '請輸入角色名稱']" maxlength="50" counter outlined dense>
              <template #prepend>
                <q-icon name="mdi-asterisk" color="negative" size="8px" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-md-6">
            <q-input :model-value="formData.userCount" label="用戶人數" outlined dense readonly hint="由系統統計，不可修改">
              <template #prepend>
                <div style="width: 8px" />
              </template>
            </q-input>
          </div>
        </div>

        <q-separator class="q-my-md" />

        <RolePermissionMatrix :tree-nodes="treeNodes" :has-permission="hasPermission" :is-loading="isLoading" @update="updatePermission" />

        <q-separator />

        <div class="q-pa-md q-mt-lg">
          <div class="row q-gutter-sm justify-center">
            <q-btn flat label="取消" color="grey" size="md" class="q-px-xl" @click="handleCancel" />
            <q-btn flat label="重設" color="grey" size="md" class="q-px-xl" type="reset" />
            <q-btn unelevated label="儲存" color="primary" size="md" class="q-px-xl" type="submit" :loading="isSubmitting" />
          </div>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { useRolePermissionMatrix } from '@/pages/RoleManagement/composables/useRolePermissionMatrix'
import RolePermissionMatrix from '@/pages/RoleManagement/components/RolePermissionMatrix.vue'
import { getAdminRoleById, updateAdminRole } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import type { RoleManagementDetailFormData } from '@/pages/RoleManagement/types'

const route = useRoute()
const router = useRouter()
const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'RoleManagementEdit', enabled: import.meta.env.DEV })
const { isLoading, treeNodes, loadResources, loadRolePermissions, hasPermission, updatePermission, resetPermissions, buildPermissionItems } =
  useRolePermissionMatrix()

const formData = reactive<RoleManagementDetailFormData>({
  id: '',
  name: '',
  isSystemDefault: false,
  userCount: 0,
  version: null,
})
const isLoadingRole = ref(true)
const isSubmitting = ref(false)
/** 載入當下的角色名稱，按「重設」時一併還原 */
const originalName = ref('')

onMounted(async () => {
  await loadRole()
})

/** 載入角色資料、資源清單與該角色的權限 */
async function loadRole() {
  const roleId = String(route.params.roleId ?? '')
  if (roleId.length === 0) {
    dialog.showError('缺少角色唯一編號', '載入失敗')
    router.push({ name: 'roleManagementList' })
    return
  }

  isLoadingRole.value = true
  try {
    // 資源清單要先備妥，權限才有對應的資源可以套上去
    const [roleResponse] = await Promise.all([getAdminRoleById(roleId), loadResources()])

    if (roleResponse.status !== 200 || !roleResponse.result.data) {
      dialog.showError(roleResponse.result.error?.message || '找不到指定角色', '載入失敗')
      router.push({ name: 'roleManagementList' })
      return
    }

    const role = roleResponse.result.data
    formData.id = role.id
    formData.name = role.name
    formData.isSystemDefault = role.isSystemDefault
    formData.userCount = role.userCount
    formData.version = role.version
    originalName.value = role.name

    await loadRolePermissions(roleId)
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('載入角色失敗', errorMessage)
    dialog.showError(errorMessage, '載入角色失敗')
    router.push({ name: 'roleManagementList' })
  } finally {
    isLoadingRole.value = false
  }
}

/** 送出更新 */
async function handleSubmit() {
  isSubmitting.value = true
  try {
    const response = await updateAdminRole(formData.id, {
      name: formData.name.trim(),
      version: formData.version,
      permissions: buildPermissionItems(),
    })

    if (response.success) {
      notify.notifySuccess(`角色「${formData.name.trim()}」已更新`)
      router.push({ name: 'roleManagementList' })
      return
    }

    notify.notifyError(response.result.error?.message || '更新角色失敗', 0)
  } catch (error) {
    const failure = error as ResponseStructure<null>
    const errorMessage = failure.errorMessage || '未知錯誤'
    logger.error('更新角色失敗', { status: failure.status, errorMessage })

    if (failure.status === 409) {
      dialog.showWarning('這個角色在你編輯期間已被其他人修改，或名稱與現有角色重複，請重新載入後再調整。', '版本衝突')
    } else {
      notify.notifyError(errorMessage, 0)
    }
  } finally {
    isSubmitting.value = false
  }
}

/** 還原成載入當下的名稱與權限 */
function handleReset() {
  formData.name = originalName.value
  resetPermissions()
}

function handleCancel() {
  router.push({ name: 'roleManagementList' })
}
</script>
