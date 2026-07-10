# Image Resizer

Mobile-first, browser-only image resizer.

## Features

- Aspect-ratio-preserving pixel resize
- Upscale and downscale
- Width or height input with automatic counterpart calculation
- 50%, 100%, 200%, 400% presets
- PNG, JPEG, WebP output
- JPEG/WebP quality control
- Download result directly on mobile/desktop
- PWA manifest and offline app-shell cache

## Privacy and security

- Image bytes never leave the browser; there is no upload API
- No analytics, ads, trackers, external fonts, third-party scripts, or external API calls
- Strict Content Security Policy blocks network connections (`connect-src 'none'`)
- SVG input is rejected to reduce active-content and external-reference risk
- Output is re-encoded through Canvas, so EXIF/GPS metadata is not copied to the result
- Untrusted filenames are rendered with `textContent` and sanitized for downloads
- 100 MB input cap and 32 MP output cap reduce accidental mobile-memory exhaustion
- Service worker caches only an explicit same-origin app-shell allowlist

## Local development

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deployment

Pushes to `main` deploy through GitHub Pages using `.github/workflows/pages.yml`.
