Deployment Guide – GitHub Pages (Official)
=========================================

This project is now deployed exclusively via GitHub Pages using GitHub Actions.

What’s configured
- A Pages workflow: .github/workflows/pages.yml
- Production build output: dist/
- Automatic deploys on push to main

One‑time setup (repo owner)
1. Repository → Settings → Pages → Build and deployment → Source: GitHub Actions
2. Ensure Actions are enabled for the repository

Everyday deployment (already set up)
- Push to main:
	```bash
	git add -A
	git commit -m "Your change"
	git push origin main
	```
- Actions → "Deploy to GitHub Pages" will build and publish dist automatically

Manual deployment trigger
- Actions tab → Workflows → "Deploy to GitHub Pages" → Run workflow

Local build (optional)
```bash
npm ci
npm run build
# Output is in dist/
```

Notes
- Netlify, Vercel and Surge are no longer used for this project.
- The file netlify.toml has been disabled; do not rely on it for deploys.
- If you need to change the Node version or cache behavior, edit .github/workflows/pages.yml.

## Current Status
- ✅ Build: dist/ folder ready
- ✅ GitHub Pages workflow configured
- ✅ PWA: Service worker + manifest configured
- ✅ Offline: Core assets cached

## Recommended Next Steps
1. Verify GitHub Pages is enabled (Settings → Pages → Source: GitHub Actions)
2. Push changes to main and wait for the Pages workflow to complete
3. Share the GitHub Pages URL with stakeholders

For details, see README.md.
