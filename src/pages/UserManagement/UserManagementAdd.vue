<template>
  <div class="q-pa-md">
    <x-breadcrumb
      :items="[
        { label: '首頁', icon: 'home', to: { name: 'home' } },
        { label: '系統管理' },
        { label: '用戶管理', to: { name: 'userManagementList' } },
        { label: '新增用戶' },
      ]"
    />

    <q-card flat bordered class="q-mt-xs">
      <q-card-section>
        <div class="text-h6 text-primary q-mb-md">
          <q-icon name="mdi-account-plus-outline" class="q-mr-sm" />
          新增用戶
        </div>

        <q-banner class="bg-info text-white q-mb-md" rounded dense>
          <template #avatar>
            <q-icon name="info" />
          </template>
          <div class="text-caption">※ 這裡只建立帳號本身。新帳號尚未綁定登入方式，需另行啟用後才能登入。</div>
          <div class="text-caption">※ 帳號建立後不可修改，電子信箱與姓名之後仍可在編輯頁調整。</div>
        </q-banner>

        <q-form class="q-gutter-md" @submit="handleSubmit">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                v-model="formData.account"
                label="登入帳號 *"
                :rules="[(value) => !!value?.trim() || '請輸入登入帳號']"
                maxlength="50"
                counter
                outlined
                dense
              />
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

          <q-separator class="q-my-md" />

          <div class="row q-gutter-sm justify-end">
            <q-btn flat label="取消" color="grey" @click="handleCancel" />
            <q-btn unelevated label="儲存" color="primary" type="submit" :loading="isSubmitting" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import UserRoleSelector from '@/pages/UserManagement/components/UserRoleSelector.vue'
import { createAdminUser, updateAdminUserRoles } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'
import type { UserManagementCreateFormData } from '@/pages/UserManagement/types'

const router = useRouter()
const dialog = useDialog()
const logger = useLogger({ prefix: 'UserManagementAdd', enabled: import.meta.env.DEV })

/** 電子信箱格式，與後端的 [EmailAddress] 一致地只做基本檢查 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const formData = reactive<UserManagementCreateFormData>({ account: '', email: '', fullName: '', roleIds: [] })
const isSubmitting = ref(false)

/**
 * 送出新增
 *
 * 後端的新增端點不收角色，所以角色要在帳號建立後再打一次。兩個請求沒有交易保護，
 * 第二步失敗時帳號已經建好，訊息要講清楚後續怎麼補，不能只說「新增失敗」。
 */
async function handleSubmit() {
  isSubmitting.value = true
  try {
    const account = formData.account.trim()
    const response = await createAdminUser({
      account,
      email: formData.email.trim(),
      fullName: formData.fullName.trim() || null,
    })

    if (!response.success || response.result.data?.id == null) {
      dialog.showError(response.result.error?.message || '新增用戶失敗', '新增失敗')
      return
    }

    const isRolesAssigned = await assignRoles(response.result.data.id, account)
    if (isRolesAssigned) {
      dialog.showSuccess(`用戶「${account}」已建立。此帳號尚未綁定登入方式，需另行啟用後才能登入。`)
    }
    router.push({ name: 'userManagementList' })
  } catch (error) {
    const failure = error as ResponseStructure<null>
    const errorMessage = failure.errorMessage || '未知錯誤'
    logger.error('新增用戶失敗', { status: failure.status, errorMessage })

    if (failure.status === 409) {
      dialog.showWarning(errorMessage, '帳號或電子信箱重複')
    } else {
      dialog.showError(errorMessage, '新增失敗')
    }
  } finally {
    isSubmitting.value = false
  }
}

/**
 * 指派角色；沒有選角色就不打這一支
 * @param userId 新建立的用戶唯一編號
 * @param account 用戶帳號，用於訊息
 * @returns 是否完成指派
 */
async function assignRoles(userId: string, account: string): Promise<boolean> {
  if (formData.roleIds.length === 0) {
    return true
  }

  try {
    const response = await updateAdminUserRoles(userId, { roleIds: formData.roleIds })
    if (response.success) {
      return true
    }
    throw response
  } catch (error) {
    const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
    logger.error('指派角色失敗', errorMessage)
    dialog.showWarning(`用戶「${account}」已建立，但角色指派失敗（${errorMessage}），請到編輯頁重新指派。`, '角色未設定')
    return false
  }
}

function handleRoleLoadFailed(message: string) {
  dialog.showWarning(message, '載入角色清單失敗')
}

function handleCancel() {
  router.push({ name: 'userManagementList' })
}
</script>
