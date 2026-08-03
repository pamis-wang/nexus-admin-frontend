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
        <q-card-section class="bg-primary text-center">
          <img :src="logoLockupWhite" alt="logo" style="height: 28px; width: auto" />
        </q-card-section>
        <q-card-section>
          <slot></slot>
        </q-card-section>
      </q-card>
    </div>

    <footer class="fixed-bottom text-center text-grey q-pb-sm">© {{ currentYear }} Nexus</footer>
  </div>
</template>

<script setup lang="ts">
import logoLockupWhite from '@/assets/images/nexus-lockup-white.svg'

const currentYear = new Date().getFullYear()
</script>

<style scoped>
.background-svg g {
  fill: var(--q-primary);
}
</style>
