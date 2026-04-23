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

3. Configure environment variables:
   - Copy `.env` and update with your Supabase credentials:
   
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
| name | VARCHAR(100) | Category name (unique) |
| icon | VARCHAR(50) | Lucide icon name |
| color | VARCHAR(7) | Hex color code |
| is_default | BOOLEAN | Whether it's a default category |
| created_at | TIMESTAMPTZ | Creation timestamp |

**households**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(150) | Household name |
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

## License

This project is for personal/household use.
