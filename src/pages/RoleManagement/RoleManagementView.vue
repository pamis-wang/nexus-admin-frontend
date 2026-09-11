<template>
  <div class="q-pa-md">
    <x-breadcrumb
      :items="[
        { label: '首頁', icon: 'home', to: { name: 'home' } },
        { label: '系統管理' },
        { label: '角色管理', to: { name: 'roleManagementList' } },
        { label: '檢視權限' },
      ]"
    />

    <x-loading-state :loading="isLoadingRole" message="載入角色資料中..." />

    <q-card v-if="!isLoadingRole" flat bordered class="q-mt-xs">
      <q-card-section>
        <div class="row justify-between items-center q-mb-md">
          <div class="text-h6 text-primary">
            <q-icon name="mdi-shield-search" class="q-mr-sm" />
            {{ role.name }}
            <q-badge v-if="role.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
          </div>
          <div class="text-body2 text-grey-7">用戶人數 {{ role.userCount }}</div>
        </div>

        <q-separator class="q-my-md" />

        <!-- 唯讀模式下勾選框全部停用，不會發出 update，所以不接這個事件 -->
        <RolePermissionMatrix :tree-nodes="treeNodes" :has-permission="hasPermission" :is-loading="isLoading" is-readonly />

        <q-separator class="q-my-md" />

        <div class="row q-gutter-sm justify-end">
          <q-btn flat label="返回列表" color="grey" @click="handleBack" />
          <q-btn
            unelevated
            label="編輯角色"
            color="primary"
            icon="mdi-file-document-edit-outline"
            :to="{ name: 'roleManagementEdit', params: { roleId: role.id } }"
          />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import { useRolePermissionMatrix } from '@/pages/RoleManagement/composables/useRolePermissionMatrix'
import RolePermissionMatrix from '@/pages/RoleManagement/components/RolePermissionMatrix.vue'
import { getAdminRoleById } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'
import type { RoleManagementDetailFormData } from '@/pages/RoleManagement/types'

const route = useRoute()
const router = useRouter()
const dialog = useDialog()
const logger = useLogger({ prefix: 'RoleManagementView', enabled: import.meta.env.DEV })
const { isLoading, treeNodes, loadResources, loadRolePermissions, hasPermission } = useRolePermissionMatrix()

const role = reactive<RoleManagementDetailFormData>({
  id: '',
  name: '',
  isSystemDefault: false,
  userCount: 0,
  version: null,
})
const isLoadingRole = ref(true)

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
    const [roleResponse] = await Promise.all([getAdminRoleById(roleId), loadResources()])

    if (roleResponse.status !== 200 || !roleResponse.result.data) {
      dialog.showError(roleResponse.result.error?.message || '找不到指定角色', '載入失敗')
      router.push({ name: 'roleManagementList' })
      return
    }

    const roleData = roleResponse.result.data
    role.id = roleData.id
    role.name = roleData.name
    role.isSystemDefault = roleData.isSystemDefault
    role.userCount = roleData.userCount
    role.version = roleData.version

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

function handleBack() {
  router.push({ name: 'roleManagementList' })
}
</script>
