/** 用於集中管理登入用戶狀態 */
import { defineStore } from 'pinia'
import { StorageSerializers, useStorage } from '@vueuse/core'
import type { LoginUserProfileResponse } from '@/services/auth/authService'

export const useUserStore = defineStore('userStore', () => {
  /** 存取權杖 */
  const accessToken = useStorage<string | null>('accessToken', null)

  /** 刷新權杖 */
  const refreshToken = useStorage<string | null>('refreshToken', null)

  /** 是否已通過驗證 */
  const isAuthenticated = useStorage<boolean>('isAuthenticated', false)

  // 預設值為 null 時 useStorage 會推斷成 any 序列化器（寫入用 String()，物件會變成 "[object Object]"），故明確指定 object
  /** 登入用戶資料 */
  const userProfile = useStorage<LoginUserProfileResponse | null>('userProfile', null, localStorage, { serializer: StorageSerializers.object })

  /** 登入成功時寫入用戶狀態 */
  async function storageUser(accessTokenValue: string, refreshTokenValue: string, userProfileValue: LoginUserProfileResponse) {
    isAuthenticated.value = true
    accessToken.value = accessTokenValue
    refreshToken.value = refreshTokenValue
    userProfile.value = userProfileValue
  }

  /** 換發權杖後更新 Token */
  async function updateTokens(newAccessToken: string, newRefreshToken: string) {
    accessToken.value = newAccessToken
    refreshToken.value = newRefreshToken
  }

  /** 登出時清空用戶狀態 */
  async function clearUser() {
    isAuthenticated.value = false
    accessToken.value = null
    refreshToken.value = null
    userProfile.value = null
  }

  return {
    accessToken,
    refreshToken,
    isAuthenticated,
    userProfile,
    storageUser,
    updateTokens,
    clearUser,
  }
})
