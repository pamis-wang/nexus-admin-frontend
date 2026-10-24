<template>
  <div class="absolute-full overflow-hidden">
    <div class="absolute-center absolute-full full-height">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" class="background-svg">
        <g fill-opacity="0.1">
          <circle cx="400" cy="400" r="400" />
          <circle cx="400" cy="400" r="300" />
          <circle cx="400" cy="400" r="200" />
          <circle cx="400" cy="400" r="100" />
          <circle cx="400" cy="400" r="50" />
        </g>
      </svg>
    </div>

    <div class="row flex flex-center window-width window-height">
      <q-card flat bordered class="q-mx-md" style="width: 100%; max-width: 420px">
        <q-card-section class="bg-white text-center">
          <img :src="logoLockupBlue" :alt="t('layout.appTitle')" :style="{ height: `${siteConfig.logoHeight.login}px`, width: 'auto' }" />
          <div v-if="loginSubtitle !== ''" class="text-subtitle1 text-grey-8 q-mt-sm" data-test="login-subtitle">{{ loginSubtitle }}</div>
        </q-card-section>
        <q-card-section>
          <slot></slot>
        </q-card-section>
      </q-card>
    </div>

    <footer class="fixed-bottom text-center text-grey q-pb-sm">{{ t('layout.copyright', { year: currentYear }) }}</footer>

    <!-- 登入前的頁面也要能切換語系：瀏覽器語言不是使用者慣用的語言時，要能在登入前自己切換 -->
    <locale-switcher class="fixed-top-right q-ma-md" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { siteConfig } from '@/config/site'
import { siteHooks } from '@/config/siteHooks'
import logoLockupBlue from '@/assets/images/brand-lockup-blue.svg'

const { t } = useI18n()

/** 標誌下方的副標，由站別決定（例如網址所屬單位的名稱）；沒有時不顯示 */
const loginSubtitle = siteHooks.useLoginSubtitle()
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.background-svg g {
  fill: var(--q-primary);
}
</style>
