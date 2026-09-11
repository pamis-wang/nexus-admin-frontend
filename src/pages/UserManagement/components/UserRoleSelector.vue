<template>
  <q-select
    v-model="selectedRoleIds"
    :options="roleOptions"
    :loading="isLoading"
    :disable="disable"
    label="角色"
    hint="可指派多個角色；未指派角色的帳號登入後沒有任何權限"
    emit-value
    map-options
    multiple
    use-chips
    outlined
    dense
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useLogger } from '@/composables/useLogger'
import { getAdminRoles } from '@/services/admin/adminRoleService'
import type { UserManagementRoleOption } from '@/pages/UserManagement/types'

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
      roleOptions.value = response.result.data.map((role) => ({ value: role.id, label: role.name }))
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
