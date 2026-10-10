# Browser tests

These tests open the real app in a headless Chromium browser (Playwright), click through it like a user, and check what appears on screen. Screenshots are saved to `tests/e2e/output/` (ignored by git).

## Main suites (no account needed)

```bash
npm install
npm run test:e2e            # builds the app, serves it on port 4173, runs every suite
npm run test:e2e -- --no-build   # reuse the last build
```

| Suite | What it checks |
| --- | --- |
| `fresh` | A brand-new visitor: landing page, sign-up-free onboarding, empty states |
| `inputs` | Adding products, materials, suppliers and sales; form validation |
| `import` | Importing product lists from Shopify, Etsy and Square exports |
| `sales-import` | Importing sales history from CSV and Excel; charts update |
| `nav` | Every page opens from the sidebar with no errors, on desktop and phone |
| `i18n` | All six languages: every text is translated, Arabic is right-to-left, no page overflows |
| `profile` | Editing your profile and photo from the top-right menu and from Settings |

Example data lives in `tests/e2e/fixtures/`.

## Accounts suite (`cloud-e2e`)

Checks sign-up, saving to the database, support-access consent, the admin page and sign-out against a fake Supabase server, so no real project is needed:

```bash
node tests/e2e/mock-supabase.mjs &      # fake Supabase on port 54321
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=test npx vite build --outDir /tmp/dist-cloud
npx vite preview --outDir /tmp/dist-cloud --port 4180 --strictPort &
node tests/e2e/cloud-e2e.mjs
```

Restart the fake server before each run so it starts empty.
