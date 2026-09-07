# FinTrack

Personal finance dashboard. Single source of truth for all your accounts.

## Stack

- **Backend:** Node.js 22 + TypeScript + Express
- **Database:** PostgreSQL 16
- **Frontend:** React 18 + Vite 7
- **AI:** Anthropic API (category suggestions), Claude Haiku 4.5
- **Market data:** Yahoo Finance (quotes), Bank of Canada (FX)
- **Testing:** Vitest 5
- **Infrastructure:** Docker + Docker Compose

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 22+ (only for running tooling outside Docker)

### Setup

1. **Configure environment**

   ```bash
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY to .env (optional, only used for
   # category suggestions; everything else works without it)
   ```

2. **Start the stack**

   ```bash
   docker compose up -d
   ```

3. **Run migrations**

   ```bash
   docker compose exec backend npm run migrate
   ```

4. **Seed default categories**

   ```bash
   docker compose exec backend npm run seed
   ```

5. **Open the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

6. **To stop the stack**

   ```bash
   docker compose down
   ```

### Query the database directly

```bash
docker compose exec db psql -U fintrack -d fintrack
```

## Testing

Both projects use Vitest. Tests live in a top-level `tests/` directory,
mirroring the `src/` layout, and cover pure logic only. Repository code is
mostly SQL, where mocking the driver would prove nothing.

```bash
docker compose exec backend npm test         # run once
docker compose exec backend npm run test:watch
docker compose exec backend npm run typecheck  # includes tests/

docker compose exec frontend npm test
docker compose exec frontend npm run typecheck
```

The build config (`tsconfig.json`) only covers `src/`, so `npm run typecheck`
uses `tsconfig.test.json` to cover tests as well.

### Rebuilding after a dependency change

`package.json` changes need a rebuild, since dependencies are baked into the
image. Only renew the anonymous `node_modules` volume **after** a successful
build, or the container starts with no dependencies and crash-loops:

```bash
docker compose build backend
docker compose up -d --force-recreate --renew-anon-volumes backend
```

## Using the app

Navigation is split by domain, because banking and investments are different
data models that only meet at net worth.

### Dashboard

Net worth across everything: bank balances plus investment holdings. Bank
accounts need an opening balance set here before their balance is meaningful,
since balances are derived from that baseline plus subsequent transactions.

### Banking

**Accounts** manages chequing, savings and credit accounts. Investment accounts
are deliberately excluded; they live under Portfolio.

**Transactions** has two views:

- *List* is the full transaction table with date range, account and
  uncategorized filters, plus pagination.
- *Review groups* clusters uncategorized transactions by merchant so one
  decision covers many rows. Categorizing a group can also save a rule, so
  future imports of that merchant categorize themselves. Person-to-person
  transfers are grouped by counterparty but never bulk-assigned or turned into
  rules, because the same person may send money for different reasons.
  *Suggest categories* asks Claude for a category per merchant; suggestions
  appear as a chip you click to accept and are never auto-applied.

**Import** takes a CSV export and detects the parser from the account's
institution and type. Transfers between your own accounts are paired
automatically after each import, so a credit card payment is not double counted
as spending.

**Rules** lists the merchant patterns that auto-categorize transactions.
Patterns match as case-insensitive substrings. *Apply to existing* backfills
them across transactions that are still uncategorized.

### Investments

**Portfolio** shows holdings across all investment accounts: a total value
header, a consolidated position table (the same security held in several
accounts is combined, which is where real concentration shows up), per-account
breakdowns, and allocation by sector and asset class.

Two valuations exist side by side. Holdings snapshots record what a statement
said on a given date, including the broker's own cost basis. *Refresh prices*
fetches current quotes and revalues `units x latest price`. The header shows
the live figure with the date of the oldest price behind it, and the statement
figure appears alongside when the two differ.

Securities with no public ticker, such as group-plan funds, keep their
statement price and are reported as unquotable rather than as failures. If the
quote feed is unavailable, nothing is written and the app falls back to
statement values.

## Project Structure

```
fintrack/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── categorization/   # normalization, merchant grouping, rules, transfer pairing
│   │   ├── classifier/       # Claude category suggestions (no DB access)
│   │   ├── investments/      # portfolio valuation, market quotes (quotes.ts has no DB access)
│   │   ├── parsers/          # bank and credit card CSV parsers
│   │   ├── repositories/     # accounts, transactions, categories
│   │   ├── routes/           # accounts, categories, transactions, import, net-worth
│   │   ├── db/               # pool and category seed
│   │   ├── migrations/
│   │   └── index.ts          # Express app
│   └── tests/                # mirrors src/, pure logic only
└── frontend/
    ├── src/
    │   ├── api/client.ts     # typed API client, single source of request logic
    │   ├── components/ui/    # shadcn-style primitives
    │   ├── lib/              # pure helpers
    │   └── pages/            # Dashboard, Accounts, Transactions, Import, Rules, Portfolio
    └── tests/                # mirrors src/
```

`classifier/index.ts` and `investments/quotes.ts` deliberately import no
database code. They take data in and return results, so either could be
extracted into a separate service without untangling anything. The route layer
is the only place that wires them to the database.

## Schema

| Table            | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `accounts`       | All financial accounts (bank, credit, investment)          |
| `transactions`   | Every cash movement, with a transfer pair link             |
| `categories`     | Nested spending categories, each with an income/expense/transfer kind |
| `merchant_rules` | Learned pattern to category mappings                       |
| `securities`     | Per-security facts: description, sector, asset class, quote ticker |
| `holdings`       | Positions per account per date, with cost basis            |
| `account_cash`   | Uninvested cash per account per date                       |
| `prices`         | Security prices over time, from statements or market data  |
| `exchange_rates` | CAD/USD (and future currencies)                            |

Category `kind` is set on the root and inherited by descendants. Only leaf
categories are assignable; parents exist to roll their children up. Anything
with a `transfer` kind is excluded from income and spending totals.

`holdings.book_value_cad` is a generated column
(`market_value_cad - unrealized_gain_cad`). Brokers compute unrealized gain
against a cost base built with purchase-date exchange rates, so backing it out
recovers a tax-correct CAD cost basis without needing a transaction ledger.

## Build Phases

- [x] **Phase 1** Foundation: Docker, schema, basic UI
- [x] **Phase 2** First real data: CSV import, account balances
- [x] **Phase 3** AI categorization: merchant grouping, rules, Claude suggestions
- [x] **Phase 4** Credit cards: Amex + BMO importers, transfer pairing
- [ ] **Phase 5** Investments: holdings and prices done; statement importers pending
- [ ] **Phase 6** Views: net worth done; spending and income breakdowns pending
- [ ] **Phase 7** Data projection and visualisation
