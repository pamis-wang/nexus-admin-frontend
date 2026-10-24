import type { SiteConfig } from '@/config/siteTypes'

/** nexus 後台的站別設定，各鍵的用途見 siteTypes.ts */
export const siteConfig: SiteConfig = {
  features: {
    roleSwitch: true,
    themeSettings: true,
  },
  logoHeight: {
    topbar: 24,
    menu: 26,
    login: 28,
  },
  layoutDefaults: {},
  userMenuLinks: [],
}
