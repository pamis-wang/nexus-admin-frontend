/** 佈局配置介面 */
export interface LayoutConfig {
  /** 佈局類型：垂直或水平 */
  layout: 'vertical' | 'horizontal'
  /** 色彩方案：亮色或暗色 */
  colorScheme: 'light' | 'dark'
  /** 頂部欄顏色：亮色、暗色或品牌色 */
  topbarColor: 'light' | 'dark' | 'brand'
  /** 選單顏色：亮色、暗色或品牌色 */
  menuColor: 'light' | 'dark' | 'brand'
  /** 側邊選單尺寸：預設展開、常駐收合、滑鼠移入展開 */
  sidebarSize: 'default' | 'condensed' | 'sm-hover'
}
