import pool from "./pool";
import dotenv from "dotenv";
dotenv.config();

const migrations = `
  CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('investment', 'credit', 'chequing', 'savings')),
    institution VARCHAR(255) NOT NULL,
    registered_type VARCHAR(50) CHECK (registered_type IN ('TFSA', 'RRSP', 'FHSA', 'DPSP', 'non-registered', 'none')),
    currency VARCHAR(10) NOT NULL DEFAULT 'CAD',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'CAD',
    merchant_name VARCHAR(255),
    description TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    categorization_source VARCHAR(20) CHECK (categorization_source IN ('ai', 'rule', 'manual')),
    categorization_confidence VARCHAR(10) CHECK (categorization_confidence IN ('high', 'low')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    security VARCHAR(100) NOT NULL,
    units NUMERIC(20, 6) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'CAD',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS prices (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    security VARCHAR(100) NOT NULL,
    price NUMERIC(20, 6) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'CAD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, security, currency)
  );

  CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL,
    rate NUMERIC(20, 8) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, from_currency, to_currency)
  );

  CREATE TABLE IF NOT EXISTS merchant_rules (
    id SERIAL PRIMARY KEY,
    merchant_name VARCHAR(255) NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL CHECK (source IN ('ai', 'manual')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_holdings_account_id ON holdings(account_id);
  CREATE INDEX IF NOT EXISTS idx_holdings_date ON holdings(date);
  CREATE INDEX IF NOT EXISTS idx_prices_security_date ON prices(security, date);
  CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running migrations...");
    await client.query(migrations);
    console.log("Migrations complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
