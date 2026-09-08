# Expense Tracker

A household expense tracking application built with React, TypeScript, and Supabase. Track your daily expenses, categorize them, and visualize spending patterns with interactive charts.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **Date Utilities**: date-fns

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A Supabase account (free tier available at [supabase.com](https://supabase.com))

### Installation

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and set up the database:
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Open the SQL Editor in your Supabase dashboard
   - Copy the contents of `supabase/schema.sql` and run it to create the tables

3. Configure Supabase connection:
   - **In-App / QR Code:** You can connect directly in the app without editing `.env`. Launch the app and click **Connect Database** or scan the desktop app's QR code from your mobile device.
   - **Environment Variables (Optional):** You can also define default credentials in `.env`:
   
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Enable email/password authentication in Supabase:
   - In the Supabase dashboard, go to Authentication → Providers
   - Enable Email

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (TypeScript + Vite) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint for code quality |

## Project Structure

```
expense_tracker/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── charts/       # Chart visualization components
│   │   │   ├── CategoryPieChart.tsx    # Pie chart for category breakdown
│   │   │   ├── ExpenseLineChart.tsx    # Line chart for expense trends
│   │   │   └── MonthlyBarChart.tsx     # Bar chart for monthly totals
│   │   ├── CategoryBadge.tsx     # Category display badge
│   │   ├── CategoryForm.tsx      # Form for creating/editing categories
│   │   ├── CategoryList.tsx      # List of all categories
│   │   ├── DateRangePicker.tsx   # Date range selection component
│   │   ├── ExpenseForm.tsx       # Form for adding/editing expenses
│   │   ├── ExpenseList.tsx       # Table of expenses
│   │   ├── ExpenseRow.tsx        # Single expense row component
│   │   ├── Layout.tsx            # Main app layout wrapper
│   │   ├── Modal.tsx             # Reusable modal component
│   │   ├── SetupBanner.tsx       # Banner for initial setup guidance
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   └── SummaryCard.tsx       # Dashboard summary card
│   ├── hooks/            # Custom React hooks
│   │   ├── useCategories.ts      # Category CRUD operations
│   │   └── useExpenses.ts        # Expense CRUD operations
│   ├── lib/              # Utilities and configurations
│   │   ├── supabase.ts           # Supabase client initialization
│   │   └── utils.ts              # Helper functions
│   ├── pages/            # Page components (routes)
│   │   ├── Categories.tsx        # Category management page
│   │   ├── Dashboard.tsx         # Main dashboard with charts
│   │   └── Expenses.tsx          # Expense list and management
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts              # Shared interfaces and types
│   ├── App.tsx           # Root component with routing
│   ├── main.tsx          # Application entry point
│   ├── index.css         # Global styles and Tailwind imports
│   └── vite-env.d.ts     # Vite environment type declarations
├── supabase/
│   └── schema.sql        # Database schema and seed data
├── dist/                 # Production build output
├── index.html            # HTML entry point
├── package.json          # Dependencies and scripts
├── tailwind.config.js    # Tailwind CSS configuration
├── postcss.config.js     # PostCSS configuration
├── tsconfig.json         # TypeScript configuration
├── tsconfig.node.json    # TypeScript config for Node
└── vite.config.ts        # Vite build configuration
```

## Directory Guide

### `/src/components`

Reusable UI components. When adding new components:
- Keep components focused on a single responsibility
- Place shared/generic components here
- Put chart-related components in the `charts/` subdirectory

### `/src/components/charts`

Data visualization components using Recharts:
- `CategoryPieChart.tsx` - Shows expense distribution by category
- `ExpenseLineChart.tsx` - Displays expense trends over time
- `MonthlyBarChart.tsx` - Monthly expense comparison

### `/src/hooks`

Custom React hooks for data fetching and state management:
- `useCategories.ts` - Fetch, create, update, and delete categories
- `useExpenses.ts` - Fetch, create, update, and delete expenses

To add new data operations, follow the existing hook patterns.

### `/src/lib`

Shared utilities and configurations:
- `supabase.ts` - Supabase client setup (uses environment variables)
- `utils.ts` - Helper functions (formatting, calculations, etc.)

### `/src/pages`

Route-level page components:
- `Dashboard.tsx` - Overview with charts and summaries
- `Expenses.tsx` - Full expense list with filtering
- `Categories.tsx` - Manage expense categories

Add new pages here and register routes in `App.tsx`.

### `/src/types`

TypeScript interfaces and types:
- `Category` - Category data structure
- `Expense` - Expense data structure
- `ExpenseFormData` / `CategoryFormData` - Form data types
- `DateRange` - Date filtering type
- `ChartDataPoint` - Chart data structure

### `/supabase`

Database-related files:
- `schema.sql` - Complete database schema with tables, indexes, and seed data

## Modifying the Project

### Adding a New Page

1. Create a new component in `src/pages/`
2. Add the route in `src/App.tsx`:
   ```tsx
   <Route path="new-page" element={<NewPage />} />
   ```
3. Add navigation link in `src/components/Sidebar.tsx`

### Adding a New Data Type

1. Define the TypeScript interface in `src/types/index.ts`
2. Add the database table in `supabase/schema.sql`
3. Create a custom hook in `src/hooks/` for data operations
4. Build UI components as needed

### Customizing Categories

Default categories are seeded in `supabase/schema.sql`. You can:
- Modify the seed data before running the schema
- Add/edit categories through the Categories page in the app
- Icons use [Lucide React](https://lucide.dev/icons/) icon names

### Styling

The project uses Tailwind CSS. Customize styles in:
- `tailwind.config.js` - Theme extensions, colors, fonts
- `src/index.css` - Global styles and custom CSS
- Individual component files using Tailwind classes

## Database Schema

### Tables

**categories**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Category name (unique per household) |
| icon | VARCHAR(50) | Lucide icon name |
| color | VARCHAR(7) | Hex color code |
| is_default | BOOLEAN | Whether it's a default category |
| household_id | UUID | Owning household; `NULL` for the shared read-only defaults |
| category_type | VARCHAR(20) | expense, income, or both |
| created_at | TIMESTAMPTZ | Creation timestamp |

Custom categories belong to one household and are invisible to others. The 14
built-in defaults have `household_id IS NULL`, are readable by everyone, and
cannot be edited or deleted by anyone.

**households**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(150) | Household name |
| invite_code | TEXT | Unique 8-character join code; rotatable by an admin |
| created_at | TIMESTAMPTZ | Creation timestamp |

**members**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_id | UUID | Foreign key to households |
| user_id | UUID | Supabase auth user id |
| name | VARCHAR(120) | Member display name |
| role | VARCHAR(20) | admin or member |
| created_at | TIMESTAMPTZ | Creation timestamp |

**expenses**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| amount | DECIMAL(10,3) | Expense amount (positive) |
| description | TEXT | Optional description |
| category_id | UUID | Foreign key to categories |
| date | DATE | Expense date |
| member_id | UUID | Foreign key to members |
| visibility | VARCHAR(20) | private or household |
| created_at | TIMESTAMPTZ | Creation timestamp |

**income**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| amount | DECIMAL(10,3) | Income amount (positive) |
| description | TEXT | Optional description |
| category_id | UUID | Foreign key to categories |
| date | DATE | Income date |
| member_id | UUID | Foreign key to members |
| visibility | VARCHAR(20) | private or household |
| created_at | TIMESTAMPTZ | Creation timestamp |

### Access rules

Row Level Security is enforced on every table, and the policies are the only
thing standing between the publishable anon key and your data.

- **Private rows** are visible only to the member who created them.
- **Household rows** are visible to everyone in the household, but only the
  owner can edit or delete them. Sharing an expense shares the *view*, not
  control of the record.
- **Transfers** are always private.
- **Categories** are per-household; the built-in defaults are read-only.
- **Anonymous (signed-out) requests can read and write nothing.**

### Joining a household

Membership is created through two `SECURITY DEFINER` functions rather than
direct inserts, so the client cannot choose its own role or join a household
without a valid code:

| Function | Purpose |
|----------|---------|
| `create_household_with_member(p_household_name, p_display_name)` | Creates a household and its first member (admin) in one transaction |
| `join_household_with_code(p_invite_code, p_display_name)` | Joins an existing household as a plain member |
| `rotate_household_invite()` | Admin-only; issues a fresh code and invalidates the old one |

Invite codes are 8 characters from an unambiguous alphabet (no `O`/`0`, no
`I`/`1`). Codes from before this change were the raw household UUID; those are
still accepted so existing invitations keep working until they are rotated.

## Gold

Gold is an account you transfer money into and out of, alongside bank, cash and
savings. Buying gold deducts from the source account and records what you
physically received; the Savings page then values those holdings in dinars at
the current rate and folds them into your total.

Holdings are derived from the transfer ledger in **fine grams** (24k-equivalent
weight), so there is no stored balance that can drift. Supported items:

| Item | Weight | Carat | Fine gold |
|------|--------|-------|-----------|
| English lira | 8 g | 21k | 7.000 g |
| Rashadi lira | 7 g | 21k | 6.125 g |
| Other, by weight and carat | you enter | 24/22/21/18/14k | derived |

Coin weights and carat follow how gold is actually traded in Jordan, which
differs slightly from the original mint standards (a British sovereign is struck
at 7.98805 g / 22k). Local convention is what the money changes hands on.

Purity is `karat / 24`, with 24k treated as 1.0 rather than 0.999, because the
price source derives its per-carat rates the same way — its 21k quote is exactly
0.875 of its 24k quote. Valuing an 8 g English lira through fine grams gives
647.22 JD against 647.20 JD from the dealer-style `8 g × 21k rate`, a 0.003%
difference that is just the source rounding its quote to two decimals.

The Savings page shows both sides: a per-item breakdown with counts and weights,
and the dinar value of each line. The transfer amount stays editable after the
market estimate is prefilled, because what you actually pay includes workmanship
(`أجرة`) and haggling.

### Price source

`supabase/functions/gold-price` fetches prices server-side, which is necessary
because no free gold API quotes JOD and the sources send no CORS headers. It
tries the Jordanian per-carat table first, then falls back to international spot
converted through the fixed 0.709 JOD/USD peg. Results are validated before
being stored — implausible values, inverted carat ordering and misaligned
columns are all rejected, so a broken page cannot overwrite a good price. If
both sources fail the last good price is kept and flagged as stale in the UI.

Deploy it once:

```bash
supabase login
supabase link --project-ref ijycfxuhtnkpnxymbmja
supabase functions deploy gold-price
```

Prices land in `gold_prices`, which every signed-in user can read and no client
can write — the function uses the service role key, which bypasses RLS. That
matters because these values price your holdings.

### Applying the schema

`supabase/schema.sql` is idempotent -- run it on a fresh project or over an
existing one. When upgrading an existing database it also migrates data:
backfills invite codes and attributes each pre-existing custom category to
whichever household actually used it. A custom category no expense or income
row references cannot be attributed; if you have more than one household those
are hidden rather than shared, and the script prints a `NOTICE` telling you how
to find and reassign them.

## License

This project is for personal/household use.

## Standalone Android APK

The Android client packages its interface inside the APK and connects directly
to the **same Supabase project** using the root `.env`. No running web app,
website, development server, Expo app, or additional backend is required.
Internet is needed only for Supabase sign-in, refreshing data, and saving.

Install `artifacts/pocket-expenses.apk` on your Android phone (Android 7.0 or
newer) and sign in with your existing household account. The app remembers your
session. It includes adding expenses with JOD precision, bank/cash accounts,
personal/household visibility, date and category, plus spending totals,
category breakdowns, and the 20 most recent expenses. Totals cover all matching
expenses. Refresh or return to the app to retrieve changes from another device.
The client uses existing accounts; account creation remains in the full app.

### Build the APK

Build-time requirements: Node.js 22+, Java 21, Android SDK Platform 36 and Android
build tools. The phone does not need these tools. Set `JAVA_HOME` and
`ANDROID_HOME` for your machine; macOS installations in the standard locations
are detected automatically.

```bash
npm ci
npm run android:apk
```

This builds the mobile bundle, copies it into the Android project, creates a
local signing key on the first build, runs the Android release build and lint,
and writes **`artifacts/pocket-expenses.apk`**. The first build downloads Gradle
and Android build dependencies. Only the Supabase publishable/anon key is
bundled; builds reject privileged keys. No database migration is required.

**Back up `android/.signing/` privately.** It is ignored by Git and contains the
key needed to install future updates over this APK. Increase `versionCode` in
`android/app/build.gradle` for new releases. Losing the key means future builds
cannot update the installed application without uninstalling it first.

`mobile/index.html` and `src/native/` are the Android entry point; the existing
web dashboard is built separately by `npm run build`. The Android client reuses
the expense hooks, form, and authentication provider. Capacitor loads bundled
assets from `dist-android`; **do not add `server.url`** to its configuration, as
that would introduce a dependency on a hosted site. No service worker is used.

### Automated Releases via GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/release-apk.yml`)
that builds the standalone APK and attaches it as a downloadable release asset.

1. Configure GitHub repository secrets (**Settings** -> **Secrets and variables** -> **Actions**):
   - `VITE_SUPABASE_URL`: Your Supabase HTTPS URL (e.g. `https://xxxx.supabase.co`).
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase publishable/anon key.
   - `ANDROID_SIGNING_KEYSTORE_BASE64` *(optional)*: Base64-encoded `android/.signing/pocket-expenses.jks` (`base64 -i android/.signing/pocket-expenses.jks | pbcopy`) to sign CI builds with your existing key.
   - `ANDROID_SIGNING_PASSWORD` *(optional)*: Contents of `android/.signing/password`.
2. Push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The workflow builds the signed APK and attaches `pocket-expenses.apk` directly to the GitHub Release for download.

