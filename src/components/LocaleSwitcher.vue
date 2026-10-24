<template>
  <q-btn-dropdown flat dense no-caps icon="mdi-translate" :label="currentLabel" :aria-label="t('layout.language')">
    <q-list>
      <q-item
        v-for="option in LOCALE_OPTIONS"
        :key="option.value"
        clickable
        v-close-popup
        :active="option.value === locale"
        v-on:click="setLocale(option.value)"
      >
        <q-item-section>{{ option.label }}</q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALE_OPTIONS } from '@/locale'
import { setLocale } from '@/plugins/i18n'

const { t, locale } = useI18n()

/** 目前語系的名稱，以該語言本身書寫 */
const currentLabel = computed(() => LOCALE_OPTIONS.find((option) => option.value === locale.value)?.label ?? '')
</script>
