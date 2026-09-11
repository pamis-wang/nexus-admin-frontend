<template>
  <x-breadcrumb
    :items="[
      { label: '首頁', icon: 'home', to: { name: 'home' } },
      { label: '系統管理' },
      { label: '角色管理', to: { name: 'roleManagementList' } },
      { label: '新增角色' },
    ]"
  />

  <q-card flat bordered class="q-mt-xs">
    <q-card-section>
      <div class="text-h6 text-primary q-mb-md">
        <q-icon name="mdi-shield-plus-outline" class="q-mr-sm" />
        新增角色
      </div>

      <q-form class="q-gutter-md" @submit="handleSubmit">
        <div class="row">
          <div class="col-12 col-md-6">
            <q-input
              v-model="formData.name"
              label="角色名稱 *"
              :rules="[(value) => !!value?.trim() || '請輸入角色名稱']"
              maxlength="50"
              counter
              outlined
              dense
            />
          </div>
        </div>

        <q-separator class="q-my-md" />

        <RolePermissionMatrix :tree-nodes="treeNodes" :has-permission="hasPermission" :is-loading="isLoading" @update="updatePermission" />

        <q-separator class="q-my-md" />

        <div class="row q-gutter-sm justify-end">
          <q-btn flat label="取消" color="grey" @click="handleCancel" />
          <q-btn flat label="清空權限" color="warning" @click="clearAllPermissions" />
          <q-btn unelevated label="儲存" color="primary" type="submit" :loading="isSubmitting" />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import { useRolePermissionMatrix } from '@/pages/RoleManagement/composables/useRolePermissionMatrix'
import RolePermissionMatrix from '@/pages/RoleManagement/components/RolePermissionMatrix.vue'
import { createAdminRole } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import type { RoleManagementFormData } from '@/pages/RoleManagement/types'

const router = useRouter()
const dialog = useDialog()
const logger = useLogger({ prefix: 'RoleManagementAdd', enabled: import.meta.env.DEV })
const { isLoading, treeNodes, loadResources, hasPermission, updatePermission, clearAllPermissions, buildPermissionItems } = useRolePermissionMatrix()

const formData = reactive<RoleManagementFormData>({ name: '' })
const isSubmitting = ref(false)

onMounted(async () => {
  const isSuccess = await loadResources()
  if (!isSuccess) {
    dialog.showWarning('載入資源清單失敗，權限設定可能不完整，請重新整理後再試。', '載入失敗')
  }
})

/** 送出新增 */
async function handleSubmit() {
  isSubmitting.value = true
  try {
    const response = await createAdminRole({
      name: formData.name.trim(),
      permissions: buildPermissionItems(),
    })

    if (response.success) {
      dialog.showSuccess(`角色「${formData.name.trim()}」已新增`)
      router.push({ name: 'roleManagementList' })
      return
    }

    dialog.showError(response.result.error?.message || '新增角色失敗', '新增失敗')
  } catch (error) {
    const failure = error as ResponseStructure<null>
    const errorMessage = failure.errorMessage || '未知錯誤'
    logger.error('新增角色失敗', { status: failure.status, errorMessage })

    if (failure.status === 409) {
      dialog.showWarning(errorMessage, '角色名稱重複')
    } else {
      dialog.showError(errorMessage, '新增失敗')
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleCancel() {
  router.push({ name: 'roleManagementList' })
}
</script>
