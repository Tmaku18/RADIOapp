# Static images

Official NETWORX branding:

- **`networx-logo-cyan.png`** — full cyan wordmark (dark background)
- **`networx-logo-cyan-light.png`** — light-mode wordmark

The dashboard hero and social previews use the cyan wordmark from `@/lib/brand-assets`.

## PWA / favicon icons

Regenerate from the cyan wordmark after any logo update:

```bash
cd web && node scripts/generate-pwa-icons.mjs
```

This updates `public/icons/pwa-*.png`, `public/apple-touch-icon.png`, and `src/app/icon.png`.
