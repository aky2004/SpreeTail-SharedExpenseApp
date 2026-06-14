# SpreeTail — SCOPE & Anomaly Log

This document details:
1. Every anomaly detected in `expenses_export.csv` and the programmatic policies applied to resolve them.
2. The complete PostgreSQL database schema design for tracking time-varying memberships, expenses, splits, and settlements.

---

## 1. CSV Anomaly Log & Resolution Policies

Our importer ingests the CSV file exactly as provided. We detected **15 distinct data problems** across the 43 rows, resolved using the following documented policies:

| Anomaly Type | Description / CSV Rows Affected | Resolution Policy & Implementation Action |
|---|---|---|
| **DUPLICATE_EXACT** | **Row 5 & 6**: Marina Bites dinners logged twice (same date, payer, amount, description). | **Skip 2nd entry**. The duplicate row is excluded from expenses, and logged in `import_anomalies` as skipped. |
| **DUPLICATE_FUZZY** | **Row 24 & 25**: Thalassa dinners logged by Aisha (2400) and Rohan (2450) on March 11. | **Import both, flag for review**. A duplicate pair is created in `duplicate_pairs` for side-by-side comparison. The user must resolve it in the UI ("Keep both", "Keep A only", "Keep B only"). |
| **SETTLEMENT_AS_EXPENSE** | **Row 14**: "Rohan paid Aisha back" (5000 INR).<br>**Row 38**: "Sam deposit share" (15000 INR). | **Skip expense, record as settlement**. Detected by keywords ("paid back", "deposit share"). We skip creating an expense and instead insert a settlement row in the `settlements` table. |
| **POST_DEPARTURE_EXPENSE** | **Row 36**: Meera included in "Groceries BigBasket" on April 2, after she left the group (March 28). | **Exclude member, recalculate split**. Meera is removed from the split list, and the bill is split among the remaining active members. |
| **PRE_JOIN_EXPENSE** | **Row 38**: Sam included in a transaction before his join date. | **Exclude member, recalculate split** (or skip if it is a settlement). Sam is excluded from any expense split occurring before he joined. |
| **INVALID_DATE_FORMAT** | **Row 16**: `01/03/2026` (DD/MM/YYYY).<br>**Row 27**: `Mar 14` (missing year). | **Normalize formatting**. DD/MM/YYYY is parsed. "Mar 14" is matched with the surrounding year context (2026) to form `2026-03-14`. |
| **AMBIGUOUS_DATE** | **Row 34**: `04/05/2026` (is this April 5 or May 4?). | **Resolve via surrounding context**. The row is sandwiched between March 28 and April 1. Since May 4 is out of order, we assume **April 5** (MM/DD/YYYY) and flag the ambiguity. |
| **MISSING_PAYER** | **Row 13**: "House cleaning supplies" (780 INR) has an empty `paid_by` field. | **Assign default, flag for review**. We assign the group creator or first member as the payer, and set `requires_review = true` so the user can reassign it. |
| **NEGATIVE_AMOUNT** | **Row 26**: "Parasailing refund" (-30 USD). | **Import as refund split**. The negative split credits the participating members and debits the payer. |
| **SPLIT_PERCENTAGE_SUM** | **Row 15 & 32**: Pizza and Brunch percentages sum to 110% (30% + 30% + 30% + 20%). | **Proportional normalization**. We scale the percentages proportionally so they sum to exactly 100% (e.g. 27.27%, 27.27%, 27.27%, 18.18%). |
| **NAME_VARIANT** | **Row 11**: `Priya S` paid.<br>**Row 9**: `priya` (lowercase).<br>**Row 27**: `rohan ` (trailing spaces). | **Fuzzy match**. Trim spaces and perform lowercase comparison. For "Priya S", Levenshtein distance <= 2 is used to resolve the variant to "Priya". |
| **UNKNOWN_MEMBER** | **Row 5 & 23**: `Dev` and `Dev's friend Kabir` are not in the group. | **Auto-add member, flag for review**. We check if they exist as database users. If not, we create placeholder user accounts (e.g., `kabir.groupid@spreetail.com`) and add them to the group. |
| **ZERO_AMOUNT** | **Row 31**: "Dinner order Swiggy" (0 INR). | **Skip row**. We exclude the row from the import list since it has no financial value. |
| **MISSING_CURRENCY** | **Row 28**: "Groceries DMart" has an empty currency field. | **Default to INR**. The record is normalized to INR. |
| **AMOUNT_FORMATTING** | **Row 7**: `"1,200"` (quotes and commas).<br>**Row 10**: `899.995` (3 decimals).<br>**Row 29**: ` 1450 ` (spaces). | **Normalize amount string**. Strip commas and quotes, parse as float, and round to 2 decimal places (e.g. 899.995 -> 900.00). |
| **CONFLICTING_SPLIT_META** | **Row 12**: "Aisha birthday cake" has type `unequal` (resolved to `exact` based on details).<br>**Row 42**: type is `equal` but share details are given. | **Metadata resolution**. We map `unequal` to `exact` splits, and for Row 42, we prioritize `split_type = equal` and ignore the extra details. |

---

## 2. PostgreSQL Database Schema

We designed a normalized, relational database schema with referential integrity constraints, check constraints, and optimized indexes:

```sql
-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    avatar_url      VARCHAR(500),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    invite_code     VARCHAR(10) UNIQUE NOT NULL,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. GROUP MEMBERS TABLE
-- Tracks time-varying membership. joined_at and left_at date-gate transactions.
CREATE TABLE IF NOT EXISTS group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       DATE NOT NULL,
    left_at         DATE,  -- NULL means currently active in group
    UNIQUE(group_id, user_id, joined_at)
);

-- 4. EXPENSES TABLE
-- Stores original currency, exchange rate, and converted INR value.
CREATE TYPE split_type_enum AS ENUM ('equal', 'percentage', 'exact', 'shares');

CREATE TABLE IF NOT EXISTS expenses (
    id                  SERIAL PRIMARY KEY,
    group_id            INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    paid_by_user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    description         VARCHAR(500) NOT NULL,
    amount_original     NUMERIC(12,2) NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
    amount_inr          NUMERIC(12,2) NOT NULL,
    exchange_rate       NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
    expense_date        DATE NOT NULL,
    split_type          split_type_enum NOT NULL DEFAULT 'equal',
    notes               TEXT,
    created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted          BOOLEAN DEFAULT FALSE
);

-- 5. EXPENSE SPLITS TABLE
CREATE TABLE IF NOT EXISTS expense_splits (
    id                  SERIAL PRIMARY KEY,
    expense_id          INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    share_amount_inr    NUMERIC(12,2) NOT NULL,
    split_value         NUMERIC(12,4),  -- stores %, amount, or shares depending on split_type
    UNIQUE(expense_id, user_id)
);

-- 6. SETTLEMENTS TABLE
-- Records direct payments between members to settle debts.
CREATE TABLE IF NOT EXISTS settlements (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    payer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payee_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_inr      NUMERIC(12,2) NOT NULL,
    settled_at      DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (payer_id != payee_id)
);

-- 7. IMPORT LOGS TABLE
CREATE TYPE import_status_enum AS ENUM ('pending', 'previewing', 'confirmed', 'failed');

CREATE TABLE IF NOT EXISTS import_logs (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    imported_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    imported_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_rows      INTEGER DEFAULT 0,
    imported_rows   INTEGER DEFAULT 0,
    skipped_rows    INTEGER DEFAULT 0,
    anomaly_count   INTEGER DEFAULT 0,
    status          import_status_enum DEFAULT 'pending'
);

-- 8. IMPORT ANOMALIES TABLE
CREATE TABLE IF NOT EXISTS import_anomalies (
    id              SERIAL PRIMARY KEY,
    import_log_id   INTEGER NOT NULL REFERENCES import_logs(id) ON DELETE CASCADE,
    row_number      INTEGER NOT NULL,
    column_name     VARCHAR(100),
    anomaly_type    VARCHAR(50) NOT NULL,
    original_value  TEXT,
    resolved_value  TEXT,
    action_taken    VARCHAR(100) NOT NULL,
    requires_review BOOLEAN DEFAULT FALSE,
    resolved_by     INTEGER REFERENCES users(id),
    resolved_at     TIMESTAMP WITH TIME ZONE
);

-- 9. DUPLICATE PAIRS TABLE
CREATE TYPE duplicate_status_enum AS ENUM ('pending', 'kept_both', 'deleted_a', 'deleted_b', 'merged');

CREATE TABLE IF NOT EXISTS duplicate_pairs (
    id                  SERIAL PRIMARY KEY,
    import_log_id       INTEGER NOT NULL REFERENCES import_logs(id) ON DELETE CASCADE,
    row_a_number        INTEGER NOT NULL,
    row_b_number        INTEGER NOT NULL,
    similarity_reason   TEXT NOT NULL,
    status              duplicate_status_enum DEFAULT 'pending',
    action_taken_by     INTEGER REFERENCES users(id),
    action_taken_at     TIMESTAMP WITH TIME ZONE
);

-- 10. REFRESH TOKENS TABLE
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked      BOOLEAN DEFAULT FALSE
);

-- INDEXES
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_dates ON group_members(group_id, joined_at, left_at);
CREATE INDEX idx_expenses_group ON expenses(group_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by_user_id);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX idx_settlements_group ON settlements(group_id);
CREATE INDEX idx_import_anomalies_log ON import_anomalies(import_log_id);
CREATE INDEX idx_duplicate_pairs_log ON duplicate_pairs(import_log_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```
