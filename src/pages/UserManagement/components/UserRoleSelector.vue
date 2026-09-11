<template>
  <q-select
    v-model="selectedRoleIds"
    :options="roleOptions"
    :loading="isLoading"
    :disable="disable"
    :hint="hintMessage"
    label="角色"
    emit-value
    map-options
    multiple
    use-chips
    outlined
    dense
  >
    <!-- 非必填欄位的等寬佔位，左緣才會跟同列的必填欄位對齊 -->
    <template #prepend>
      <div style="width: 8px" />
    </template>

    <!-- 照 QSelect 預設的選項結構，只多掛系統預設標記；多選模式沒有勾選框，選取狀態由 itemProps 帶 -->
    <template #option="scope">
      <q-item :key="scope.index" v-bind="scope.itemProps">
        <q-item-section>
          <q-item-label>
            {{ scope.opt.label }}
            <q-badge v-if="scope.opt.isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>

    <template #no-option>
      <q-item>
        <q-item-section class="text-grey-6">{{ isLoading ? '載入角色清單中…' : NO_ROLE_MESSAGE }}</q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useLogger } from '@/composables/useLogger'
import { getAdminRoles } from '@/services/admin/adminRoleService'
import type { UserManagementRoleOption } from '@/pages/UserManagement/types'

/** 一個角色都沒有時的說明，選單內與欄位提示共用 */
const NO_ROLE_MESSAGE = '目前沒有可指派的角色，請先到角色管理建立'

withDefaults(defineProps<Props>(), {
  disable: false,
})

/** 已選取的角色唯一編號 */
const selectedRoleIds = defineModel<string[]>({ required: true })

const emit = defineEmits<{
  loadFailed: [message: string]
}>()

const logger = useLogger({ prefix: 'UserRoleSelector', enabled: import.meta.env.DEV })

const roleOptions = ref<UserManagementRoleOption[]>([])
const isLoading = ref(false)

/** 欄位提示；一個角色都沒有時改成提醒先去建立，不必展開選單才看得到 */
const hintMessage = computed<string>(() => {
  if (!isLoading.value && roleOptions.value.length === 0) {
    return NO_ROLE_MESSAGE
  }
  return '可指派多個角色；未指派角色的帳號登入後沒有任何權限'
})

/** 元件參數 */
interface Props {
  /** 是否停用選取 */
  disable?: boolean
}

onMounted(async () => {
  await loadRoleOptions()
})

/** 載入可指派的角色清單 */
async function loadRoleOptions() {
  isLoading.value = true
  try {
    const response = await getAdminRoles()

    if (response.status === 200 && response.result.data) {
      roleOptions.value = response.result.data.map((role) => ({ value: role.id, label: role.name, isSystemDefault: role.isSystemDefault }))
      return
    }

    emit('loadFailed', response.result.error?.message || '載入角色清單失敗')
  } catch {
    logger.error('載入角色清單失敗')
    emit('loadFailed', '載入角色清單失敗，請稍後再試')
  } finally {
    isLoading.value = false
  }
}
</script>
