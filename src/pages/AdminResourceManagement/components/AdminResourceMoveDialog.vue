<template>
  <q-dialog v-model="isVisible" persistent>
    <q-card style="min-width: 460px; max-width: 560px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-primary">{{ t('resource.action.move') }}</div>
        <q-space />
        <q-btn v-close-popup icon="mdi-close" flat round dense />
      </q-card-section>

      <q-card-section class="q-pb-none">
        <i18n-t keypath="resource.move.question" tag="div" class="text-body2" scope="global">
          <template #name>
            <span class="text-weight-bold">{{ nodeName || t('resource.empty.unnamed') }}</span>
          </template>
        </i18n-t>
        <div class="text-caption text-grey-7 q-mt-xs">
          {{
            descendantCount > 0
              ? t('resource.move.currentPathWithDescendants', { path: nodeFullPath, n: descendantCount }, descendantCount)
              : t('resource.move.currentPath', { path: nodeFullPath })
          }}
        </div>
      </q-card-section>

      <q-card-section>
        <q-list bordered separator style="max-height: 320px; overflow-y: auto">
          <q-item
            v-for="target in targets"
            :key="target.parentRowKey ?? 'root'"
            v-ripple
            clickable
            :disable="target.disabled"
            :active="selectedParentRowKey === target.parentRowKey"
            active-class="menu-move-target-active text-primary"
            @click="handleSelect(target)"
          >
            <q-item-section avatar>
              <q-radio :model-value="selectedParentRowKey" :val="target.parentRowKey" :disable="target.disabled" dense />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ target.label }}</q-item-label>
              <q-item-label caption>
                {{ t('resource.move.targetLevel', { level: target.level }) }}
                <template v-if="target.disabledReason !== null">・{{ target.disabledReason }}</template>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <q-banner v-if="selectedTarget !== null" class="bg-info text-white q-mt-md" rounded dense>
          <i18n-t
            v-if="descendantCount > 0"
            keypath="resource.move.previewWithDescendants"
            :plural="descendantCount"
            tag="div"
            class="text-caption"
            scope="global"
          >
            <template #path>
              <span class="text-weight-bold">{{ previewPath }}</span>
            </template>
            <template #n>{{ descendantCount }}</template>
          </i18n-t>
          <i18n-t v-else keypath="resource.move.preview" tag="div" class="text-caption" scope="global">
            <template #path>
              <span class="text-weight-bold">{{ previewPath }}</span>
            </template>
          </i18n-t>
        </q-banner>
      </q-card-section>

      <q-card-actions align="center" class="q-pt-none q-pb-md">
        <q-btn v-close-popup flat :label="t('common.action.cancel')" color="grey" class="q-px-xl" />
        <q-btn unelevated :label="t('resource.action.confirmMove')" color="primary" class="q-px-xl" :disable="selectedTarget === null" @click="handleConfirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminResourceMoveTarget } from '@/pages/AdminResourceManagement/types'

const { t } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  nodeName: '',
  nodeFullPath: '',
  descendantCount: 0,
})

/** 是否顯示對話框 */
const isVisible = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  confirm: [parentRowKey: string | null]
}>()

const selectedParentRowKey = ref<string | null>(null)
/** 第一層的 parentRowKey 是 null，單看 selectedParentRowKey 無法分辨「還沒選」與「選了第一層」 */
const hasSelection = ref(false)

const selectedTarget = computed(() => {
  if (!hasSelection.value) {
    return null
  }
  return props.targets.find((target) => target.parentRowKey === selectedParentRowKey.value) ?? null
})

const previewPath = computed(() => {
  const target = selectedTarget.value
  if (target === null) {
    return ''
  }
  return target.parentRowKey === null ? props.nodeName : `${target.label}>${props.nodeName}`
})

/** 對話框參數 */
interface Props {
  /** 要搬移的節點名稱（本層名稱） */
  nodeName?: string
  /** 要搬移的節點目前的完整資源名稱 */
  nodeFullPath?: string
  /** 會一起搬移的子項目數 */
  descendantCount?: number
  /** 候選的目標父節點 */
  targets: AdminResourceMoveTarget[]
}

watch(isVisible, (value) => {
  if (!value) {
    selectedParentRowKey.value = null
    hasSelection.value = false
  }
})

/**
 * 選定目標父節點
 * @param target 被點選的候選項
 */
function handleSelect(target: AdminResourceMoveTarget) {
  if (target.disabled) {
    return
  }
  selectedParentRowKey.value = target.parentRowKey
  hasSelection.value = true
}

/** 送出搬移結果並關閉對話框 */
function handleConfirm() {
  if (selectedTarget.value === null) {
    return
  }
  emit('confirm', selectedParentRowKey.value)
  isVisible.value = false
}
</script>

<style scoped>
/* 選取中的搬移目標，底色由語意色 token 調色 */
.menu-move-target-active {
  background: color-mix(in srgb, var(--q-primary) 8%, transparent);
}
</style>
