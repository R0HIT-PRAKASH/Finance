# FinTrack

Personal finance dashboard — single source of truth for all your accounts.

## Stack

- **Backend:** Node.js + TypeScript + Express
- **Database:** PostgreSQL
- **Frontend:** React + Recharts
- **AI:** Anthropic API (Phase 3)
- **Infrastructure:** Docker + Docker Compose

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local development outside Docker)

### How to query DB directly

`docker compose exec db psql -U fintrack -d fintrack`

### Setup

1. **Clone and configure environment**

   ```bash
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY to .env
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

## Project Structure

```
fintrack/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.ts          # Postgres connection
│   │   │   ├── migrate.ts       # Schema migrations
│   │   │   └── seed.ts          # Default category tree
│   │   ├── routes/
│   │   │   ├── accounts.ts
│   │   │   └── categories.ts
│   │   └── index.ts             # Express app
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── client.ts        # Typed API client
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   └── Accounts.tsx
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── Dockerfile
    ├── package.json
    └── vite.config.ts
```

## Schema

| Table            | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `accounts`       | All financial accounts (bank, credit, investment) |
| `transactions`   | Every cash movement                               |
| `holdings`       | Security positions per account per date           |
| `prices`         | Security prices over time                         |
| `exchange_rates` | CAD/USD (and future currencies)                   |
| `categories`     | Nested spending categories                        |
| `merchant_rules` | Learned merchant → category mappings              |

## Build Phases

- [x] **Phase 1** — Foundation: Docker, schema, basic UI
- [ ] **Phase 2** — First real data: CSV import, account balances
- [ ] **Phase 3** — AI categorization: Anthropic API integration
- [ ] **Phase 4** — Credit cards: Amex + BMO importers
- [ ] **Phase 5** — Investments: Holdings, prices, exchange rates
- [ ] **Phase 6** — Views: Net worth, spending, portfolio
