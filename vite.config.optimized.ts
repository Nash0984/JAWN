import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { visualizer } from "rollup-plugin-visualizer";
import compression from "vite-plugin-compression";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    // Bundle size visualization
    visualizer({
      open: false, // Set to true to automatically open the report
      filename: 'bundle-stats.html',
      template: 'treemap', // Use 'sunburst' or 'network' for other views
      gzipSize: true,
      brotliSize: true,
    }),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Bundle optimization settings
    rollupOptions: {
      output: {
        // Code splitting configuration
        manualChunks: {
          // Vendor chunks - separate large libraries
          'vendor-react': ['react', 'react-dom', 'wouter', 'react-helmet-async'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
          ],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'lucide-react'],
        },
        // File naming for better caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : '';
          if (facadeModuleId.includes('page')) {
            return 'assets/pages/[name].[hash].js';
          }
          if (facadeModuleId.includes('component')) {
            return 'assets/components/[name].[hash].js';
          }
          return 'assets/[name].[hash].js';
        },
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    // Performance budgets
    chunkSizeWarningLimit: 500, // Warn for chunks over 500KB
    // CSS code splitting
    cssCodeSplit: true,
    // Source maps for production debugging (optional)
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    // Asset inlining threshold
    assetsInlineLimit: 4096, // 4KB
    // Target modern browsers for smaller bundles
    target: 'es2020',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'wouter',
      '@tanstack/react-query',
      'lucide-react',
      'date-fns',
    ],
    exclude: ['@replit/vite-plugin-runtime-error-modal'],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  // Performance hints
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    // Prefer module field for better tree shaking
    mainFields: ['module', 'browser', 'main'],
  },
  // Production-specific optimizations
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },
});