import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import XTable from '@/components/XTable.vue'
import quasarPlugin from '@/plugins/quasar'
import customPlugin from '@/plugins/custom'
import { i18n } from '@/plugins/i18n'

const COLUMNS = [{ name: 'name', label: '名稱', field: 'name' }]

/**
 * 掛載表格
 * @param rows 資料列
 * @param rowsPerPage 每頁筆數，0 代表全部
 * @returns 掛載後的元件
 */
function mountTable(rows: { id: number; name: string }[], rowsPerPage = 0) {
  return mount(XTable, {
    props: { rows, columns: COLUMNS, pagination: { page: 1, rowsPerPage, rowsCount: rows.length } },
    global: { plugins: [quasarPlugin, i18n, customPlugin] },
  })
}

describe('XTable', () => {
  afterEach(() => {
    i18n.global.locale.value = 'zh-TW'
  })

  it('沒有資料時依語系顯示查無資料', async () => {
    const wrapper = mountTable([])

    expect(wrapper.text()).toContain('查無資料')

    i18n.global.locale.value = 'en-US'
    await nextTick()

    expect(wrapper.text()).toContain('No data found')
  })

  it('切換語系後分頁資訊與「全部」選項跟著換', async () => {
    const wrapper = mountTable([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ])

    expect(wrapper.text()).toContain('第 1 - 2 筆 / 共 2 筆')
    expect(wrapper.text()).toContain('全部')

    i18n.global.locale.value = 'en-US'
    await nextTick()

    expect(wrapper.text()).toContain('1 - 2 of 2')
    // 選中的是「全部」，存的是數值 0，語系切換後要對應到新的選項文字
    expect(wrapper.text()).toContain('All')
    expect(wrapper.text()).not.toContain('全部')
  })
})
