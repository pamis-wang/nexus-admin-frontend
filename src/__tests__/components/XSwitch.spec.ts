import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import quasarPlugin from '@/plugins/quasar'
import XSwitch from '@/components/XSwitch.vue'

/**
 * 掛載開關按鈕
 * @param props 元件參數
 * @param attrs 額外落到根節點的屬性
 */
function mountXSwitch(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(XSwitch, {
    props,
    attrs,
    global: { plugins: [quasarPlugin] },
  })
}

describe('XSwitch', () => {
  it('依狀態顯示對應文字', () => {
    const activeWrapper = mountXSwitch({ modelValue: true, activeText: '顯示', inactiveText: '隱藏' })
    const inactiveWrapper = mountXSwitch({ modelValue: false, activeText: '顯示', inactiveText: '隱藏' })

    expect(activeWrapper.text()).toBe('顯示')
    expect(inactiveWrapper.text()).toBe('隱藏')
  })

  it('未指定文字時使用「啟用」與「停用」', () => {
    expect(mountXSwitch({ modelValue: true }).text()).toBe('啟用')
    expect(mountXSwitch({ modelValue: false }).text()).toBe('停用')
  })

  it('點擊時送出相反的狀態', async () => {
    const wrapper = mountXSwitch({ modelValue: false })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('停用時點擊不會切換狀態', async () => {
    const wrapper = mountXSwitch({ modelValue: false, disable: true })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.find('button').classes()).toContain('disabled')
  })

  it('標上 switch 語意，aria-checked 跟著狀態走', () => {
    expect(mountXSwitch({ modelValue: true }).find('button').attributes('aria-checked')).toBe('true')

    const inactiveButton = mountXSwitch({ modelValue: false }).find('button')

    expect(inactiveButton.attributes('role')).toBe('switch')
    expect(inactiveButton.attributes('aria-checked')).toBe('false')
  })

  it('背景色、尺寸與開啟狀態的 class 隨參數切換', () => {
    const button = mountXSwitch({ modelValue: true, size: 'sm', activeColor: 'teal', inactiveColor: 'grey' }).find('button')

    expect(button.classes()).toContain('bg-teal')
    expect(button.classes()).toContain('x-switch--sm')
    expect(button.classes()).toContain('x-switch--on')
    expect(mountXSwitch({ modelValue: false, activeColor: 'teal', inactiveColor: 'grey' }).find('button').classes()).toContain('bg-grey')
  })

  it('文字顏色可覆寫，預設為白色', () => {
    expect(mountXSwitch({ modelValue: true }).find('span.x-switch__label').classes()).toContain('text-white')
    expect(mountXSwitch({ modelValue: true, textColor: 'dark' }).find('span.x-switch__label').classes()).toContain('text-dark')
  })

  it('外部傳入的 class 只套用一次', () => {
    const wrapper = mountXSwitch({ modelValue: false }, { class: 'my-extra-class' })

    const appliedCount = wrapper
      .find('button')
      .attributes('class')
      ?.split(' ')
      .filter((name) => name === 'my-extra-class').length

    expect(appliedCount).toBe(1)
  })

  it('外部傳入的 click 事件只觸發一次，且不影響狀態切換', async () => {
    const onClick = vi.fn<() => void>()
    const wrapper = mountXSwitch({ modelValue: false }, { onClick })

    await wrapper.find('button').trigger('click')

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('不把 size 傳進 q-btn，避免 q-btn 依字級撐高而蓋掉軌道高度', () => {
    const button = mountXSwitch({ modelValue: false, size: 'xl' }).find('button')

    expect(button.attributes('style')).toBeUndefined()
  })
})
