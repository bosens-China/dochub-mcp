import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup
} from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      scale: 1.1,
      warn: true
    }),
    presetTypography({
      colorScheme: {
        // Default prose uses light text on dark pre — we use light archive blocks instead
        'pre-code': [800, 100],
        'pre-bg': [100, 800]
      },
      cssExtend: {
        code: {
          'font-family': '"IBM Plex Mono", "SF Mono", Menlo, monospace'
        },
        pre: {
          'font-family': '"IBM Plex Mono", "SF Mono", Menlo, monospace'
        }
      }
    })
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      archive: {
        ink: '#141820',
        paper: '#f6f4ef',
        shelf: '#ebe8e1',
        line: '#ddd8ce',
        teal: '#0f766e',
        'teal-soft': '#ccfbf1',
        signal: '#ca8a04',
        'signal-soft': '#fef3c7',
        muted: '#6b7280',
        danger: '#b91c1c'
      }
    },
    fontFamily: {
      display: '"Literata", "Songti SC", Georgia, serif',
      body: '"IBM Plex Sans", "PingFang SC", system-ui, sans-serif',
      mono: '"IBM Plex Mono", "SF Mono", Menlo, monospace'
    }
  },
  shortcuts: {
    'archive-panel': 'bg-archive-paper border border-archive-line rounded-lg',
    'archive-label': 'text-xs font-medium tracking-wide uppercase text-archive-muted',
    'archive-spine': 'w-1 rounded-full shrink-0'
  }
})
