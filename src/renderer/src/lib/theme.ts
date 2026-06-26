import type { ThemeConfig } from 'antd'

/** antd theme aligned with Archive Spine design tokens */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0f766e',
    colorBgLayout: '#f6f4ef',
    colorBgContainer: '#faf9f7',
    colorBorder: '#ddd8ce',
    colorText: '#141820',
    colorTextSecondary: '#6b7280',
    borderRadius: 8,
    fontFamily: '"IBM Plex Sans", "PingFang SC", system-ui, sans-serif',
    fontFamilyCode: '"IBM Plex Mono", "SF Mono", Menlo, monospace'
  },
  components: {
    Layout: {
      headerBg: '#f6f4ef',
      bodyBg: '#f6f4ef',
      siderBg: '#ebe8e1'
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#ccfbf1',
      itemSelectedColor: '#0f766e',
      itemHoverBg: '#f6f4ef'
    },
    Tree: {
      directoryNodeSelectedBg: '#ccfbf1'
    }
  }
}

export { SPINE_COLORS } from '@shared/constants/spine-colors'
