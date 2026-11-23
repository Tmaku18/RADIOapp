# Static images

Official NETWORX branding:

- **`networx-logo-cyan.png`** — full cyan wordmark (dark background)
- **`networx-logo-cyan-light.png`** — light-mode wordmark

The dashboard hero uses the cyan wordmark. Link previews use `og-networx.jpg` (1200×1200 JPEG) so Messages can show the logo.

## PWA / favicon icons

Regenerate from the cyan wordmark after any logo update:

```bash
cd web && node scripts/generate-pwa-icons.mjs
```

This updates `public/icons/pwa-*.png`, `public/apple-touch-icon.png`, and `src/app/icon.png`.
