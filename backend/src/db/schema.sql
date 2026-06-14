-- EXPensio Database Schema
-- Shared expenses application with time-varying group membership

-- Enable UUID extension (optional, using SERIAL for simplicity and traceability)
-- All monetary amounts stored in paisa (INR * 100) would be ideal,
-- but we use NUMERIC(12,2) for readability in the live session.

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    avatar_url      VARCHAR(500),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    invite_code     VARCHAR(10) UNIQUE NOT NULL,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GROUP MEMBERS TABLE
-- Tracks time-varying membership. joined_at and left_at
-- are DATE (not timestamp) because membership is date-gated
-- for expense calculations (Sam's requirement).
-- ============================================
CREATE TABLE IF NOT EXISTS group_members (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       DATE NOT NULL,
    left_at         DATE,  -- NULL means still active
    UNIQUE(group_id, user_id, joined_at)  -- allow rejoin with different joined_at
);

-- ============================================
-- EXPENSES TABLE
-- Stores both original currency amount and INR conversion.
-- Priya's requirement: USD must not be treated as INR.
-- ============================================
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

-- ============================================
-- EXPENSE SPLITS TABLE
-- Each row = one member's share of an expense.
-- share_amount_inr is the computed INR amount owed.
-- split_value stores the raw input (%, exact amount, or share count).
-- ============================================
CREATE TABLE IF NOT EXISTS expense_splits (
    id                  SERIAL PRIMARY KEY,
    expense_id          INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    share_amount_inr    NUMERIC(12,2) NOT NULL,
    split_value         NUMERIC(12,4),  -- stores %, amount, or shares depending on split_type
    UNIQUE(expense_id, user_id)
);

-- ============================================
-- SETTLEMENTS TABLE
-- Records direct payments between members to settle debts.
-- ============================================
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

-- ============================================
-- IMPORT LOGS TABLE
-- One row per CSV import operation.
-- ============================================
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

-- ============================================
-- IMPORT ANOMALIES TABLE
-- Each detected problem during CSV import.
-- ============================================
CREATE TABLE IF NOT EXISTS import_anomalies (
    id              SERIAL PRIMARY KEY,
    import_log_id   INTEGER NOT NULL REFERENCES import_logs(id) ON DELETE CASCADE,
    row_number      INTEGER NOT NULL,
    column_name     VARCHAR(100),
    anomaly_type    VARCHAR(50) NOT NULL,
    original_value  TEXT,
    resolved_value  TEXT,
    action_taken    VARCHAR(100) NOT NULL,  -- 'imported', 'skipped', 'flagged', 'normalized'
    requires_review BOOLEAN DEFAULT FALSE,
    resolved_by     INTEGER REFERENCES users(id),
    resolved_at     TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- DUPLICATE PAIRS TABLE
-- Tracks suspected duplicate expense rows from import.
-- Meera's requirement: must approve every deletion.
-- ============================================
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

-- ============================================
-- REFRESH TOKENS TABLE
-- For JWT refresh token management.
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked      BOOLEAN DEFAULT FALSE
);

-- ============================================
-- INDEXES for query performance
-- ============================================
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
