<template>
  <x-breadcrumb
    :items="[
      { label: t('menu.home'), icon: 'mdi-home', to: { name: 'home' } },
      { label: t('menu.systemManagement') },
      { label: t('user.title'), to: { name: 'userManagementList' } },
      { label: t('user.addTitle') },
    ]"
  />

  <x-page-header :title="t('user.addTitle')" icon="mdi-account-plus-outline" />

  <q-card flat bordered class="q-mt-xs">
    <q-card-section>
      <q-banner class="bg-info text-white q-mb-md" rounded dense data-tour="user-form-notice">
        <template #avatar>
          <q-icon name="mdi-information-outline" />
        </template>
        <div class="text-caption">{{ t('user.hint.createOnly') }}</div>
        <div class="text-caption">{{ t('user.hint.accountImmutable') }}</div>
      </q-banner>

      <q-form @submit="handleSubmit">
        <x-section-header-bar :title="t('user.section.basic')" />
        <div class="row q-col-gutter-md q-mt-xs" data-tour="user-form-basic">
          <div class="col-12 col-md-6">
            <q-input
              v-model="formData.account"
              :label="t('user.field.account')"
              :rules="[(value) => !!value?.trim() || t('user.validation.accountRequired')]"
              maxlength="50"
              counter
              outlined
              dense
            >
              <template #prepend>
                <q-icon name="mdi-asterisk" color="negative" size="8px" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-md-6">
            <q-input
              v-model="formData.email"
              type="email"
              :label="t('user.field.email')"
              :rules="[
                (value) => !!value?.trim() || t('user.validation.emailRequired'),
                (value) => EMAIL_PATTERN.test(value ?? '') || t('user.validation.emailFormat'),
              ]"
              maxlength="100"
              outlined
              dense
            >
              <template #prepend>
                <q-icon name="mdi-asterisk" color="negative" size="8px" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-md-6">
            <q-input v-model="formData.fullName" :label="t('user.field.fullName')" maxlength="50" outlined dense>
              <template #prepend>
                <div style="width: 8px" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-md-6" data-tour="user-form-roles">
            <AdminUserRoleSelector v-model="formData.roleIds" @load-failed="handleRoleLoadFailed" />
          </div>
        </div>

        <q-separator class="q-mt-md" />

        <div class="q-pa-md q-mt-lg" data-tour="user-form-submit">
          <div class="row q-gutter-sm justify-center">
            <q-btn flat :label="t('common.action.cancel')" color="grey" size="md" class="q-px-xl" @click="handleCancel" />
            <q-btn unelevated :label="t('common.action.save')" color="primary" size="md" class="q-px-xl" type="submit" :loading="isSubmitting" />
          </div>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import AdminUserRoleSelector from '@/pages/AdminUserManagement/components/AdminUserRoleSelector.vue'
import { createAdminUser, updateAdminUserRoles } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'
import type { AdminUserManagementCreateFormData } from '@/pages/AdminUserManagement/types'

const router = useRouter()
const { t } = useI18n()
const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'AdminUserManagementAdd', enabled: import.meta.env.DEV })

/** 電子信箱格式，與後端的 [EmailAddress] 一致地只做基本檢查 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const formData = reactive<AdminUserManagementCreateFormData>({ account: '', email: '', fullName: '', roleIds: [] })
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
      notify.notifyError(response.result.error?.message || t('user.createFailed'), 0)
      return
    }

    const isRolesAssigned = await assignRoles(response.result.data.id, account)
    if (isRolesAssigned) {
      dialog.showSuccess(t('user.created', { account }))
    }
    router.push({ name: 'userManagementList' })
  } catch (error) {
    const failure = error as ResponseStructure<null>
    const errorMessage = failure.errorMessage || t('common.unknownError')
    logger.error('新增用戶失敗', { status: failure.status, errorMessage })

    if (failure.status === 409) {
      notify.notifyError(errorMessage, 0)
    } else {
      notify.notifyError(errorMessage, 0)
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
    const errorMessage = (error as ResponseStructure<null>).errorMessage || t('common.unknownError')
    logger.error('指派角色失敗', errorMessage)
    dialog.showWarning(t('user.roleAssignFailed', { account, message: errorMessage }), t('user.roleAssignFailedTitle'))
    return false
  }
}

function handleRoleLoadFailed(message: string) {
  notify.notifyError(message, 0)
}

function handleCancel() {
  router.push({ name: 'userManagementList' })
}
</script>
