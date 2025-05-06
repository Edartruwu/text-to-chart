-- 1. Buyers / Customers
CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  name            TEXT      NOT NULL,
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  tax_id          TEXT,                             -- VAT/TIN number
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Invoices
CREATE TABLE invoices (
  id                SERIAL PRIMARY KEY,
  invoice_number    VARCHAR(50)   NOT NULL UNIQUE,   -- e.g. "INV-2025-0001"
  invoice_date      DATE          NOT NULL,
  due_date          DATE,
  customer_id       INTEGER       NOT NULL
      REFERENCES customers(id)
      ON DELETE RESTRICT,
  
  subtotal          NUMERIC(12,2) NOT NULL,          -- sum of line totals
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0, -- any invoice‐level discount
  tax               NUMERIC(12,2) NOT NULL DEFAULT 0, -- VAT or sales tax
  shipping          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL,          -- subtotal – discount + tax + shipping
  
  payment_terms     TEXT,                            -- e.g. "Net 30"
  payment_method    TEXT,                            -- e.g. "Bank Transfer", "Credit Card"
  bank_details      JSONB,                           -- { "bank": "...", "iban": "...", ... }
  
  notes             TEXT,                            -- free‐form (“Thank you”, returns policy, etc.)
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Line‐Items on each Invoice
CREATE TABLE invoice_items (
  id             SERIAL PRIMARY KEY,
  invoice_id     INTEGER       NOT NULL
      REFERENCES invoices(id)
      ON DELETE CASCADE,
  description    TEXT          NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
