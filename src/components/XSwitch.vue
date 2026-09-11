<template>
  <q-btn :class="trackClasses" :disable="disable" :aria-checked="modelValue" role="switch" rounded unelevated @click="modelValue = !modelValue">
    <span class="x-switch__label" :class="`text-${textColor}`">{{ modelValue ? activeText : inactiveText }}</span>
    <span class="x-switch__thumb bg-grey-2"></span>
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 帶文字的開關按鈕
 *
 * 用在「啟用／停用」這種需要把兩種狀態的字面意思直接寫在控件上的場合；
 * 只需要單純勾選時用 Quasar 的 q-toggle 就夠了，不必用這個。
 *
 * 語意上是 switch 而非按鈕：控件上顯示的是「目前狀態」，不是「按下去會變成什麼」，
 * 因此標上 role="switch" 與 aria-checked，讓輔助技術不會把它讀成一般按鈕。
 *
 * @example
 * <x-switch v-model="isEnabled" size="sm" active-text="顯示" inactive-text="隱藏" active-color="positive" inactive-color="grey" />
 */

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  activeText: '啟用',
  inactiveText: '停用',
  activeColor: 'positive',
  inactiveColor: 'negative',
  textColor: 'white',
  disable: false,
})

/** 開關狀態 */
const modelValue = defineModel<boolean>({ required: true })

const trackClasses = computed(() => [
  'x-switch',
  `x-switch--${props.size}`,
  `bg-${modelValue.value ? props.activeColor : props.inactiveColor}`,
  { 'x-switch--on': modelValue.value },
])

/** 元件參數 */
interface Props {
  /** 控件尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 開啟時顯示的文字 */
  activeText?: string
  /** 關閉時顯示的文字 */
  inactiveText?: string
  /** 開啟時的背景色，需為 Quasar 色彩 token 名稱 */
  activeColor?: string
  /** 關閉時的背景色，需為 Quasar 色彩 token 名稱 */
  inactiveColor?: string
  /** 文字顏色，需為 Quasar 色彩 token 名稱；背景改成淺色時要一併調整才看得清楚 */
  textColor?: string
  /** 是否停用；停用時點擊不會切換狀態 */
  disable?: boolean
}
</script>

<style scoped>
/*
 * 幾何全部由每個尺寸的四個變數推導，數字之間的關係寫在 calc 裡，不手算：
 *   滑塊位移 = 軌道寬 − 滑塊直徑 − 兩側內縮
 *   滑塊與文字的垂直位置 = 軌道正中（top: 50% + translateY(-50%)）
 * 要新增尺寸只要補一組變數。顏色一律走 Quasar 的色彩 class，這裡不寫色碼。
 */
.x-switch {
  --x-switch-thumb-inset: 4px;

  width: var(--x-switch-track-width);
  /* height 與 min-height 都要寫：q-btn 自己有 min-height: 2.572em，
     只設 height 的話字級一大（lg／xl）就會被它撐高，滑塊跟著偏離軌道中線 */
  height: var(--x-switch-track-height);
  min-height: var(--x-switch-track-height);
  padding: 0;
  overflow: hidden;
}

.x-switch--xs {
  --x-switch-track-width: 56px;
  --x-switch-track-height: 24px;
  --x-switch-thumb-size: 16px;
  --x-switch-label-size: 10px;
  --x-switch-label-inset: 12px;
}

.x-switch--sm {
  --x-switch-track-width: 68px;
  --x-switch-track-height: 28px;
  --x-switch-thumb-size: 20px;
  --x-switch-label-size: 12px;
  --x-switch-label-inset: 14px;
}

.x-switch--md {
  --x-switch-track-width: 84px;
  --x-switch-track-height: 36px;
  --x-switch-thumb-size: 28px;
  --x-switch-label-size: 16px;
  --x-switch-label-inset: 16px;
}

.x-switch--lg {
  --x-switch-track-width: 120px;
  --x-switch-track-height: 44px;
  --x-switch-thumb-size: 36px;
  --x-switch-label-size: 20px;
  --x-switch-label-inset: 24px;
}

.x-switch--xl {
  --x-switch-track-width: 140px;
  --x-switch-track-height: 52px;
  --x-switch-thumb-size: 44px;
  --x-switch-label-size: 24px;
  --x-switch-label-inset: 28px;
}

.x-switch__thumb {
  position: absolute;
  top: 50%;
  left: var(--x-switch-thumb-inset);
  width: var(--x-switch-thumb-size);
  height: var(--x-switch-thumb-size);
  border-radius: 50%;
  transform: translateY(-50%);
  transition: transform 0.3s ease;
}

.x-switch--on .x-switch__thumb {
  transform: translateY(-50%) translateX(calc(var(--x-switch-track-width) - var(--x-switch-thumb-size) - var(--x-switch-thumb-inset) * 2));
}

/*
 * 文字靠在滑塊的另一側，兩個狀態都用長度定位所以能真的滑過去
 * （原本是 right 與 left: auto 互換，length ↔ auto 無法補間，文字只會瞬移）。
 * 絕對定位又貼在右緣時可用寬度是 0，沒有 nowrap 會逐字斷行。
 */
.x-switch__label {
  position: absolute;
  top: 50%;
  left: var(--x-switch-track-width);
  font-size: var(--x-switch-label-size);
  line-height: 1;
  white-space: nowrap;
  transform: translate(calc(-100% - var(--x-switch-label-inset)), -50%);
  transition:
    left 0.3s ease,
    transform 0.3s ease;
}

.x-switch--on .x-switch__label {
  left: 0;
  transform: translate(var(--x-switch-label-inset), -50%);
}

@media (prefers-reduced-motion: reduce) {
  .x-switch__thumb,
  .x-switch__label {
    transition: none;
  }
}
</style>
