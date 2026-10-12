import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

// App background color: maskable and Apple icons need a solid background,
// otherwise the generator fills the transparent area with white.
const background = '#0E0F14';

// Generates every app icon from the logo in public/favicon.svg.
// To change the logo: replace that SVG and run `pnpm --filter @psq/web icons`.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // No extra padding: the logo already keeps its ring inside the central
    // 80% that Android's circle crop and iOS's rounded corners never touch.
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { background },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background },
    },
  },
  images: ['public/favicon.svg'],
});
