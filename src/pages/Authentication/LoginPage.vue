<template>
  <default-layout>
    <q-form class="q-gutter-md" @submit.prevent="handleSubmit">
      <div class="text-h5 text-center text-primary q-mb-sm">登入</div>
      <div class="text-subtitle2 text-center text-grey-7 q-mb-lg">請輸入帳號與密碼以登入後台管理系統</div>

      <q-input v-model="account" label="帳號" placeholder="請輸入帳號或電子信箱" autocomplete="username" outlined dense>
        <template v-slot:prepend><q-icon name="mdi-account-outline" /></template>
      </q-input>

      <q-input
        v-model="password"
        label="密碼"
        placeholder="請輸入密碼"
        v-bind:type="isPasswordVisible ? 'text' : 'password'"
        autocomplete="current-password"
        outlined
        dense
        v-on:keydown="handleCapsLockCheck"
      >
        <template v-slot:prepend><q-icon name="mdi-lock-outline" /></template>
        <template v-slot:append>
          <q-icon v-bind:name="isPasswordVisible ? 'mdi-eye-off' : 'mdi-eye'" class="cursor-pointer" v-on:click="togglePasswordVisibility" />
        </template>
      </q-input>

      <div v-if="isCapsLockOn" class="text-warning text-center">
        <q-icon name="mdi-alert-outline" size="xs" class="q-mr-xs" />
        Caps Lock 已開啟
      </div>

      <div v-if="errorMessage" class="text-negative text-center">{{ errorMessage }}</div>

      <div class="text-center">
        <q-btn type="submit" label="登入" color="primary" class="full-width" v-bind:loading="isLoggingIn" />
      </div>
    </q-form>
  </default-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useAuthentication } from '@/composables/useAuthentication'
import { checkCapsLock } from '@/composables/useKeyboard'

const { isLoggingIn, login } = useAuthentication()

const account = ref('')
const password = ref('')
const isPasswordVisible = ref(false)
const isCapsLockOn = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  if (!account.value.trim()) {
    errorMessage.value = '請輸入帳號'
    return
  }

  if (!password.value.trim()) {
    errorMessage.value = '請輸入密碼'
    return
  }

  errorMessage.value = ''
  const result = await login(account.value, password.value)

  if (!result.success) {
    errorMessage.value = result.message
    password.value = ''
  }
}

function togglePasswordVisibility() {
  isPasswordVisible.value = !isPasswordVisible.value
}

/** 密碼欄位按鍵時偵測 Caps Lock 狀態，提示使用者 */
function handleCapsLockCheck(event: KeyboardEvent) {
  isCapsLockOn.value = checkCapsLock(event)
}
</script>
