# Tokuma — Business Dashboard

Tokuma is a dashboard for small businesses, built for owners with no business training. It helps them run the business and understand it. Most businesses judge success by money alone. Tokuma gives the **circularity score** (how well the business keeps materials in use) the same weight as **profit**, and shows the two side by side on every main page. Every number has a plain-language explanation the owner can open by hovering over it or tapping it.

Built with React, Tailwind and Recharts.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

The app uses hash routing (`/#/app/...`) and a relative base path, so `dist/` can be hosted on any static host, including GitHub Pages.

## What's inside

| Page | Route | What the owner can do |
|---|---|---|
| Landing / Sign in | `/`, `/signin` | Learn what Tokuma does; sign up or sign in |
| Onboarding | `/onboarding` | Answer 4 short steps about the business |
| **Dashboard** | `/app` | Two cards side by side: **Financial performance** (net profit for the last 30 days, revenue, expenses, progress toward a goal) and **Circularity performance** (circularity score, level, progress toward a goal). Also: profit and score month by month, products at a glance, and next steps |
| Revenue & expenses | `/app/money` | Record sales and expenses by category, including circular revenue (repairs, resale, rental, take-back). Import from CSV / Excel or a Shopify, Square or Etsy export |
| Products | `/app/products` | Each product shows its **profit per unit** and its **circularity score**; edit what it is made of |
| Inventory | `/app/products/inventory` | Stock levels, low-stock warnings, when to reorder, one-click restock |
| Suppliers | `/app/products/suppliers` | Supplier sustainability ratings (part of the score), reliability, carbon |
| **Circularity** | `/app/circularity` | The score and its five pillars, the research basis, the waste & returned-products log, ideas to raise it, materials breakdown and trend |
| **Reports** | `/app/reports` | Basic accounting, each with a "what is this?" box: **Profit & loss**, **Balance sheet** (assets, liabilities, owner’s equity), **Cash flow** (including cash runway) and a **Break-even** calculator. Printable |
| Learn | `/app/learn` | Short lessons on the circularity score, the circular economy, profit & loss, the balance sheet, cash flow and break-even, each linked to the matching page. Funding is under Learn |
| Settings | `/app/settings` | Your profile and photo, language, theme, business profile, notifications, delete data |

The menu groups pages so an owner sees six main pages. Labels use standard business terms (revenue, expenses, net profit, assets, liabilities, owner’s equity, fixed costs), and each has a plain-language explanation. The customers page, the supplier reliability detail and the investor view still exist but are no longer in the menu. Old links (`/app/transactions`, `/app/supply-chain`, `/app/education`, `/app/funding`) forward to the new pages.

These work on every page: the **explanation buttons** (the small "i" next to a number or word; they open on hover, keyboard focus or tap), the language menu, the Ctrl K command palette, notifications and toasts.

## The circularity score

The score runs from 0 to 100 and is the main measure of how circular a business is. It implements the **Circular Innovation Score (CIS)** from *Circularity Scoring: Research Basis for the Circular Innovation Score* (Oct 14, 2026). Everything that decides it lives in [`src/lib/score.ts`](src/lib/score.ts).

| Pillar | Measured in Tokuma as | Based on |
|---|---|---|
| Circular inflow | Share of the weight of products sold (last 30 days) made from recycled, reused or certified renewable material | WBCSD CTI % circular inflow; EMF MCI F_R + F_U + F_S |
| Circular outflow | Waste and returned products from the waste log, valued by R-ladder route: reuse/repair 1, refurbish/remanufacture 0.75, recycle/compost 0.5, energy recovery 0.25, landfill 0 | WBCSD CTI % circular outflow; R-ladder (Potting et al. 2017) |
| Product life & use | X = (lifetime ÷ typical lifetime) × use intensity, normalized min–max on 0–2, weighted by mass sold | EMF MCI utility factor |
| Resource productivity | Product revenue ÷ kg of virgin material sold, min–max on a log scale from $5 to $500 per kg | WBCSD CTI circular material productivity |
| Circular business model | Share of revenue from repairs, resale, rental, take-back and recycling services | MSCI CE indexes; CTI revenue |

**Aggregation (OECD/JRC method).**
- Equal weights (0.2 each).
- Geometric mean: CIS = 100 × Π P_k^w_k, so one weak pillar pulls the score down.
- The linear average is shown beside it as a sensitivity band ("between X and Y depending on the method").
- Missing data: a pillar with no data is left out and flagged "not measured yet", and the other weights are scaled up. At least two measured pillars are needed for a score.
- A pillar measured at exactly zero counts as 0.01, so the geometric mean doesn't collapse to 0.

**Draft choices still to confirm with experts:**
- the R-ladder route values
- the product-life scale (0–2)
- the $5–$500 per kg productivity range
- the 0.01 zero floor
- the levels: **Circular Starter** 0–39, **Circular Grower** 40–69, **Circular Leader** 70–100. These are not from the research.

**Not used yet:**
- Water circularity, because small businesses rarely track it.
- The research's finance link. It should be estimated by regression, not hard-coded. The Funding page's estimates are placeholders.

The global benchmark shown next to circular inflow (6.9%) is from the Circularity Gap Report 2025.

## Accounting (`src/lib/accounting.ts`)

- **Profit & loss** is cash-basis: revenue minus expenses in the chosen period, grouped by category. Loans, investment and grants are listed separately as financing (not revenue).
- **Balance sheet**:
  - Cash = opening cash balance (entered once) + all cash inflows − all cash outflows.
  - Stock is valued at unit cost.
  - The owner adds other assets (equipment, vehicles) and liabilities (loans, unpaid bills).
  - Owner’s equity = assets − liabilities.
- **Cash flow** shows cash inflows, cash outflows and the closing cash balance for the last 6 months. *Cash runway* = cash balance ÷ average monthly expenses over the last 3 months.
- **Break-even units** = monthly fixed costs (rent, wages, marketing; averaged from the last 3 months and editable) ÷ profit per unit (price − unit cost, averaged over what sold, or one product).

## Importing transactions

**Revenue & expenses → Import CSV / Excel** reads a `.csv` or `.xlsx` file in the browser (nothing is uploaded):

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

- **Recycled and reused materials share** (the main part of the circularity score) = recycled + reused material weight in units sold ÷ total material weight sold. Units come from `Transaction.productId` / `quantity`, and weights come from each product's `materials`. With no sales there is no share (shown as "—").
- **Reorder point** = `ceil(avgDailySales × supplier.avgLeadTimeDays + safetyStock)`. The lead time is pulled automatically from the linked supplier.
- **Reliability score** = `0.3 × leadTimeScore + 0.5 × onTimeDeliveryRate + 0.2 × certificationScore`
  - leadTimeScore is 100 at ≤ 5 days and falls linearly to 0 at 45 days.
  - certificationScore is 35 points per certification, capped at 100.
- **Funding terms**: the score, max eligibility and APR are all driven by the circularity rate, average supplier sustainability and net margin. Any change to circularity elsewhere in the app flows through to them.
- **Revenue vs profit chart** (Revenue & expenses page) uses an accrual basis: recurring costs are spread across the period they cover, and financing inflows (grants, loans) are left out. The dashboard and reports use the simpler cash-basis profit described above.

## Project layout

```
src/
  types.ts                 data model (Product, Supplier, Transaction, Customer, …)
  data/defaults.ts         the empty profile a new account starts with
  lib/metrics.ts           business calculations (circularity, stock, suppliers, funding)
  lib/score.ts             the circularity score (Circular Innovation Score, 5 pillars)
  lib/accounting.ts        profit & loss, balance sheet, cash flow, break-even
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

## Testing

```bash
npm run test:e2e      # 80 browser checks across 8 suites
npm run i18n:check    # every language has every text
```

See [`tests/README.md`](tests/README.md) for what each suite covers and how to run the accounts suite.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes `dist/` to the `gh-pages` branch. GitHub Pages serves that branch at https://samanthascales.github.io/TokumaDashboard/. If the site doesn't appear, open **Settings → Pages** and set the source to **Deploy from a branch → `gh-pages` / root**.
