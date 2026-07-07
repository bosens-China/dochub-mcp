import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import UnoCSS from 'unocss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'sqlite-vec', /^sqlite-vec-/, 'playwright', 'playwright-core']
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        routesDirectory: resolve('src/renderer/src/routes'),
        generatedRouteTree: resolve('src/renderer/src/routeTree.gen.ts'),
        autoCodeSplitting: true
      }),
      UnoCSS(),
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler']
        }
      })
    ]
  }
})
