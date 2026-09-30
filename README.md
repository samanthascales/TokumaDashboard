# Tokuma — Circular ERP Dashboard

A React + Tailwind + Recharts single-page app for Tokuma's business-facing circular-economy ERP. It rebuilds the Cluster 0 platform walkthrough as a production-feeling SaaS product and adds the Focus 2 (seasonal revenue analytics), Focus 4 (inventory) and Focus 5 (supplier reliability) upgrades.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

The app uses hash routing (`/#/app/...`) and a relative base path, so `dist/` can be hosted on any static host, including GitHub Pages.

## What's inside

| Area | Route | Highlights |
|---|---|---|
| Landing / Sign in | `/`, `/signin` | Two-portal split, animated gradient, count-up "Trusted by 500+", mock Google OAuth |
| Onboarding wizard | `/onboarding` | 4 steps, % progress, inline validation, live profile preview |
| **Business Hub** | `/app` | Low-stock banner, KPI cards with sparklines, Revenue vs Profit (30D/90D/YTD/12M/Custom, prior-period overlay, automatic peak annotation, click-to-drill modal), material-mix donut that filters the dashboard, milestone stepper with hover criteria, AI insights feed (dismiss / act, impact + confidence tags) |
| Products | `/app/products` | Grid/table toggle, sortable table, stock bars, add/edit modal with bill-of-materials editor |
| **Inventory** (Focus 4) | `/app/products/inventory` | `stockOnHand`, `lowStockThreshold`, auto `reorderPoint`, days of cover, suggested order, restock flow |
| Transactions | `/app/transactions` | Filter, search, paginate, CSV export, **import from CSV / Excel (.xlsx)**; sales link to product and customer |
| Circularity Metrics | `/app/circularity` | Calculated live from transactions × materials, composition, trend, ranking, ranked recommendation carousel |
| Supply Chain | `/app/supply-chain` | Sustainability, logistics carbon, transport mix, material origins, key suppliers |
| **Supplier Reliability** (Focus 5) | `/app/supply-chain/reliability` | Computed reliability score, gauges, sortable table, supplier drill-down, add/edit supplier modal |
| Funding | `/app/funding` | Verified banner, reactive eligibility and APR (flash plus a "since your last visit" note), what-if slider, request flow, history with status badges |
| Customers | `/app/customers` | Repeat-purchase rate, products bought, New / Repeat / At-risk segments, order history modal |
| Education Hub | `/app/education` | Restyled to match the design system |
| Settings | `/app/settings` | Your profile (photo, name, job title, contact details — also opened from your name in the top bar), language, light / dark / system theme, business profile (reuses the wizard fields), notification preferences, delete all data |
| Investor view | `/app/investor` | Opened from the role switcher. Shows impact, funding readiness and supply-chain risk |

These work across every page: the language menu (globe icon), the ⌘K / Ctrl K command palette, the notification bell, toasts, skeleton loading states, empty states with a call to action, page transitions, count-up numbers, and "Generate report" (a printable PDF summary).

## Importing transactions

**Transactions → Import CSV / Excel** reads a `.csv` or `.xlsx` file in the browser (nothing is uploaded):

1. Pick the file (and the sheet, for workbooks with several).
2. Match your columns to Tokuma's fields — Date and Amount are required; type, category, product, quantity, customer and note are optional. Column names are guessed from your headers.
3. Review every row before it's saved. Rows that can't be read (bad date or amount) are skipped with the reason; unknown products are imported without a product link; unknown customers can be added; rows matching an existing transaction are flagged as already imported.

**Dashboard → Import sales** opens the same importer for sales exports (Shopify, Square, Etsy, a POS or a spreadsheet): every row is a sale, negative amounts are refunds, and a row can use either a line total or unit price × quantity. On line-item exports that also have an order-level *Total* (Shopify), the per-item price × quantity is used so multi-item orders aren't double-counted. Only rows matching data already in the app are flagged as duplicates; identical sales within one file are all kept.

Without a type column, negative amounts are money out. A sale without a quantity adds revenue but no units. Imports don't change stock on hand. Files in SharePoint, OneDrive or Google Sheets need to be downloaded first. Parsing uses `papaparse` and `read-excel-file`, loaded only when an import starts.

## Languages

Tokuma is available in English, Spanish (Latin America), Portuguese (Brazil), French, Arabic and Dutch (for Suriname). The first visit uses the browser's language when it's one of these, otherwise English. People can switch with the globe button in the top bar (also on the landing and sign-in pages) or under **Settings → Language**; the choice is saved per device.

- **How it works:** UI text is written in English and wrapped in `t('…')` (`src/i18n`). Each language is a file in `src/i18n/locales/` that maps the English text to its translation, and is downloaded only when that language is chosen. Missing strings fall back to English. `{name}` placeholders are filled in; counts use each language's plural rules (Arabic has six forms).
- **Numbers and dates** are formatted for the chosen language (e.g. `US$ 1.234,50` in Portuguese). Amounts stay in US dollars. Arabic uses Western digits.
- **Arabic** switches the whole layout to right-to-left: the sidebar moves to the right and margins, alignment and arrows are mirrored. Charts keep time running left to right.
- **Stored values stay in English** (categories, material types, funding status…), so data looks the same whichever language entered it. They're translated only when shown. Text you type yourself (product names, notes) isn't translated.
- **Adding a language** (e.g. Quechua or Guaraní): copy `src/i18n/locales/es.ts` to a new file, translate the values (keep the `{placeholders}`), and add a row to `LANGUAGES` in `src/i18n/index.tsx`.
- **Checking translations:** `npm run i18n:check` lists any UI string missing from a language file and any translation whose placeholders don't match the English.

The Spanish, Portuguese, French, Arabic and Dutch translations were machine-drafted and should be reviewed by native speakers.

## Key formulas (`src/lib/metrics.ts`)

- **Circularity rate** = recycled + reused material weight in units sold ÷ total material weight sold. Units come from `Transaction.productId` / `quantity`, and weights come from each product's `materials`. When there are no sales it falls back to the catalog, so the rate never sits at a static 0%.
- **Reorder point** = `ceil(avgDailySales × supplier.avgLeadTimeDays + safetyStock)`. The lead time is pulled automatically from the linked supplier.
- **Reliability score** = `0.3 × leadTimeScore + 0.5 × onTimeDeliveryRate + 0.2 × certificationScore`
  - leadTimeScore is 100 at ≤ 5 days and falls linearly to 0 at 45 days.
  - certificationScore is 35 points per certification, capped at 100.
- **Funding terms**: the score, max eligibility and APR are all driven by the circularity rate, average supplier sustainability and net margin. Any change to circularity elsewhere in the app flows through to them.
- **Profit** is shown on an accrual basis. Recurring costs are spread across the period they cover, and financing inflows (grants, loans) are left out.

## Project layout

```
src/
  types.ts                 data model (Product, Supplier, Transaction, Customer, …)
  data/defaults.ts         the empty profile a new account starts with
  lib/metrics.ts           all business calculations
  i18n/                    language switching, t() and one strings file per language
  store/AppStore.tsx       app state, derived data, actions, toasts, persistence
  components/ui            design-system primitives (Card, Modal, Gauge, StockBar, Skeleton, …)
  components/layout        sidebar, top bar, command palette, report modal
  pages/                   one file per route (+ sub-folders for page-specific parts)
```

New accounts start empty. A **Get started** checklist on the dashboard walks through the business profile, first product, first supplier and first sale.

## Accounts and data storage

The app runs in one of two modes:

- **Accounts mode.** This is on when the build has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, for example in `.env.production`. People sign up with email and password, and each business's data is stored in Supabase and syncs across devices. Saves happen automatically, and a top-bar indicator shows *Saving… / Saved*. If the same account is edited in two tabs, the older tab loads the newer data instead of overwriting it. The first time someone signs in on a browser that already holds data from local mode, that data moves into their account.
- **Local mode.** This is used when those settings are missing. Data is saved in the browser's `localStorage` only.

**Setting up accounts:** follow [`docs/ACCOUNTS_SETUP.md`](docs/ACCOUNTS_SETUP.md). The database tables and security rules are in [`supabase/migrations/001_workspaces.sql`](supabase/migrations/001_workspaces.sql):
- Row Level Security limits each user to their own row.
- Support access is off by default. A business turns it on under **Settings → Account & privacy**.
- Admins open a business's data through functions that check that consent, require a reason, and log each view. The business sees every view in its access history.

**Owner admin page:** `/app/admin` is shown only to accounts listed in the `admins` table. It lists every business (names, emails, counts) and opens a read-only support view for businesses that allowed it.

**Security tests:** [`supabase/tests/security.sql`](supabase/tests/security.sql) checks the rules as different users on a scratch PostgreSQL database:

```bash
psql -d scratch -f supabase/tests/local_auth_stub.sql -f supabase/migrations/001_workspaces.sql -f supabase/tests/security.sql
```

**Delete all data** (Settings → Appearance) clears the current business's data in whichever mode is active.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes `dist/` to the `gh-pages` branch. GitHub Pages serves that branch at https://samanthascales.github.io/TokumaDashboard/. If the site doesn't appear, open **Settings → Pages** and set the source to **Deploy from a branch → `gh-pages` / root**.
