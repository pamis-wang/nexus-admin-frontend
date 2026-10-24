import auth from '@/locale/en-US/auth.json'
import common from '@/locale/en-US/common.json'
import error from '@/locale/en-US/error.json'
import home from '@/locale/en-US/home.json'
import http from '@/locale/en-US/http.json'
import layout from '@/locale/en-US/layout.json'
import menu from '@/locale/en-US/menu.json'
import resource from '@/locale/en-US/resource.json'
import role from '@/locale/en-US/role.json'
import shell from '@/locale/en-US/shell.json'
import table from '@/locale/en-US/table.json'
import time from '@/locale/en-US/time.json'
import tour from '@/locale/en-US/tour.json'
import user from '@/locale/en-US/user.json'
import type { MessageSchema } from '@/locale'

/** 英文語系檔；宣告成 MessageSchema，少了繁中有的 key 會在型別檢查時被擋下 */
const enUS: MessageSchema = {
  auth,
  common,
  error,
  home,
  http,
  layout,
  menu,
  resource,
  role,
  shell,
  table,
  time,
  tour,
  user,
}

export default enUS
