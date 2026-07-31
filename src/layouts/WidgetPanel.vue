<template>
  <div class="q-pa-md" style="width: 280px">
    <div class="text-subtitle2 q-mb-md text-center">應用程式</div>
    <div class="row q-gutter-md">
      <div class="col-3" v-for="app in apps" :key="app.name">
        <q-btn flat no-caps class="full-width q-pa-sm" style="height: 80px; flex-direction: column" @click="openApp(app.url)">
          <q-avatar size="32px" class="q-mb-xs">
            <q-icon :name="app.icon" size="24px" :color="app.color" />
          </q-avatar>
          <div class="text-caption text-center" style="line-height: 1.2">
            {{ app.name }}
          </div>
        </q-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 應用程式清單（示範資料，尚未串接真實服務）
const apps = [
  {
    name: 'Slack',
    icon: 'chat',
    color: 'purple',
    url: 'https://slack.com',
  },
  {
    name: 'GitHub',
    icon: 'code',
    color: 'grey-8',
    url: 'https://github.com',
  },
  {
    name: 'Dribbble',
    icon: 'palette',
    color: 'pink',
    url: 'https://dribbble.com',
  },
  {
    name: 'Bitbucket',
    icon: 'source',
    color: 'blue',
    url: 'https://bitbucket.org',
  },
  {
    name: 'Dropbox',
    icon: 'cloud',
    color: 'light-blue',
    url: 'https://dropbox.com',
  },
  {
    name: 'G Suite',
    icon: 'apps',
    color: 'orange',
    url: 'https://workspace.google.com',
  },
]

function openApp(url: string) {
  window.open(url, '_blank')
}
</script>
