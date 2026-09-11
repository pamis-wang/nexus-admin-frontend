<template>
  <x-breadcrumb
    :items="[
      { label: '首頁', icon: 'home', to: { name: 'home' } },
      { label: '系統管理' },
      { label: '用戶管理', to: { name: 'userManagementList' } },
      { label: '編輯用戶' },
    ]"
  />

  <x-loading-state :loading="isLoadingUser" message="載入用戶資料中..." />

  <q-card v-if="!isLoadingUser" flat bordered class="q-mt-xs">
    <q-card-section>
      <div class="text-h6 text-primary q-mb-md">
        <q-icon name="mdi-account-edit-outline" class="q-mr-sm" />
        編輯用戶
        <q-badge v-if="isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
        <q-badge v-if="formData.isDisabled" color="grey-6" class="q-ml-sm">已停用</q-badge>
      </div>

      <q-form class="q-gutter-md" @submit="handleSubmit" @reset="handleReset">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <!-- 後端允許修改帳號，但後台目前不開放；送出時仍要原樣帶回，PUT 是完整替換 -->
            <q-input :model-value="formData.account" label="登入帳號" outlined dense readonly hint="目前不開放在後台修改" />
          </div>
          <div class="col-12 col-md-6">
            <q-input
              v-model="formData.email"
              type="email"
              label="電子信箱 *"
              :rules="[(value) => !!value?.trim() || '請輸入電子信箱', (value) => EMAIL_PATTERN.test(value ?? '') || '電子信箱格式不正確']"
              maxlength="100"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-6">
            <q-input v-model="formData.fullName" label="姓名" maxlength="50" outlined dense />
          </div>
          <div class="col-12 col-md-6">
            <UserRoleSelector v-model="formData.roleIds" @load-failed="handleRoleLoadFailed" />
          </div>
        </div>

        <div class="text-caption text-grey-7">帳號的停用狀態目前不開放在後台變更，列表與本頁都只顯示狀態，儲存時會把載入當下的值原樣帶回。</div>

        <q-separator class="q-my-md" />

        <div class="row q-gutter-sm justify-end">
          <q-btn flat label="取消" color="grey" @click="handleCancel" />
          <q-btn flat label="重設" color="warning" type="reset" />
          <q-btn unelevated label="儲存" color="primary" type="submit" :loading="isSubmitting" />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import UserRoleSelector from '@/pages/UserManagement/components/UserRoleSelector.vue'
import { getAdminUserById, updateAdminUser, updateAdminUserRoles } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'
import type { UserManagementEditFormData } from '@/pages/UserManagement/types'

const route = useRoute()
const router = useRouter()
const dialog = useDialog()
const logger = useLogger({ prefix: 'UserManagementEdit', enabled: import.meta.env.DEV })

/** 電子信箱格式，與後端的 [EmailAddress] 一致地只做基本檢查 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const formData = reactive<UserManagementEditFormData>({ id: '', account: '', email: '', fullName: '', roleIds: [], isDisabled: false })
const isSystemDefault = ref(false)
const isLoadingUser = ref(true)
const isSubmitting = ref(false)
/** 載入當下的內容，按「重設」時還原 */
const originalFormData = ref<UserManagementEditFormData | null>(null)

onMounted(async () => {
  await loadUser()
})

/** 載入用戶資料與既有角色 */
async function loadUser() {
  const userId = String(route.params.userId ?? '')
  if (userId.length === 0) {
    dialog.showError('缺少用戶唯一編號', '載入失敗')
    router.push({ name: 'userManagementList' })
    return
  }

  isLoadingUser.value = true
  try {
    const response = await getAdminUserById(userId)

    if (response.status !== 200 || !response.result.data) {
      dialog.showError(response.result.error?.message || '找不到指定用戶', '載入失敗')
      router.push({ name: 'userManagementList' })
      return
    }

    const user = response.result.data
    formData.id = user.id
    formData.account = user.account
    formData.email = user.email
    formData.fullName = user.fullName ?? ''
    formData.roleIds = user.roleMappings.map((mapping) => mapping.roleId)
    formData.isDisabled = user.isDisabled
    isSystemDefault.value = user.isSystemDefault
    originalFormData.value = { ...formData, roleIds: [...formData.roleIds] }
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('載入用戶失敗', errorMessage)
    dialog.showError(errorMessage, '載入用戶失敗')
    router.push({ name: 'userManagementList' })
  } finally {
    isLoadingUser.value = false
  }
}

/**
 * 送出更新
 *
 * 基本資料與角色是兩支端點，依序送出。停用狀態原樣帶回——這支端點沒有
 * 「不能停用自己」與「系統預設不可停用」的防護，不該拿來改停用狀態。
 */
async function handleSubmit() {
  isSubmitting.value = true
  try {
    const response = await updateAdminUser(formData.id, {
      account: formData.account.trim(),
      email: formData.email.trim(),
      fullName: formData.fullName.trim() || null,
      isDisabled: formData.isDisabled,
    })

    if (!response.success) {
      dialog.showError(response.result.error?.message || '更新用戶失敗', '更新失敗')
      return
    }

    const isRolesUpdated = await updateRoles()
    if (isRolesUpdated) {
      dialog.showSuccess(`用戶「${formData.account}」已更新`)
    }
    router.push({ name: 'userManagementList' })
  } catch (error) {
    const failure = error as ResponseStructure<null>
    const errorMessage = failure.errorMessage || '未知錯誤'
    logger.error('更新用戶失敗', { status: failure.status, errorMessage })

    if (failure.status === 409) {
      // 後端對帳號與電子信箱都會擋重複，但帳號在這裡唯讀、不可能撞到別人，實際只會是信箱
      dialog.showWarning(errorMessage, '電子信箱重複')
    } else {
      dialog.showError(errorMessage, '更新失敗')
    }
  } finally {
    isSubmitting.value = false
  }
}

/**
 * 全量替換角色
 * @returns 是否更新成功
 */
async function updateRoles(): Promise<boolean> {
  try {
    const response = await updateAdminUserRoles(formData.id, { roleIds: formData.roleIds })
    if (response.success) {
      return true
    }
    throw response
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('更新角色失敗', errorMessage)
    dialog.showWarning(`用戶「${formData.account}」的基本資料已更新，但角色未更新（${errorMessage}），請重新操作一次。`, '角色未更新')
    return false
  }
}

/** 還原成載入當下的內容 */
function handleReset() {
  const original = originalFormData.value
  if (original === null) {
    return
  }
  formData.email = original.email
  formData.fullName = original.fullName
  formData.roleIds = [...original.roleIds]
}

function handleRoleLoadFailed(message: string) {
  dialog.showWarning(message, '載入角色清單失敗')
}

function handleCancel() {
  router.push({ name: 'userManagementList' })
}
</script>
