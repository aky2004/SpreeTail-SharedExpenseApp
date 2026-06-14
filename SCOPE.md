# Application Scope & Data Architecture

This document defines the boundaries of the CSV ingestion anomaly engine, detailing every data discrepancy tracked by the system, the policy utilized to resolve it, and the underlying PostgreSQL database schema that supports the application.

## 1. CSV Ingestion Anomaly Detection Log

The core of SpreeTail's import engine (`import.service.ts`) is designed to handle dirty, real-world data from varied external sources. It parses files iteratively and applies the following resolution policies:

### Date Anomalies
| Anomaly Type | Detection Logic | Resolution Policy | Post-Action Status |
|--------------|-----------------|-------------------|--------------------|
| **Missing Date / Invalid Format** | Regex checking fails to match standard dates (`YYYY-MM-DD`, `DD/MM/YYYY`, `MMM DD`). | Assumes chronological ordering. The engine falls back to the last successfully parsed date in the loop. | Auto-fixed. Logs action: `defaulted_to_previous_date`. |
| **Ambiguous Date** | Identifies dates like `04/05/2026` where month and day are uncertain. | Inspects the contextual date variables (the surrounding rows) to determine if a DD/MM or MM/DD interpretation prevents massive chronological jumping. | Auto-fixed, but flags for manual review to ensure context assumption was correct. |

### Financial Anomalies
| Anomaly Type | Detection Logic | Resolution Policy | Post-Action Status |
|--------------|-----------------|-------------------|--------------------|
| **Missing/Zero Amount** | Amount parses to `0`, `NaN`, or is blank. | Zero-amount expenses hold no value in a shared ledger and break percentage split math. | Row skipped entirely. |
| **Amount Formatting** | Amount string contains commas, leading/trailing whitespace, or exceeds 2 decimal precision. | Strips non-numeric characters and enforces strict 2-decimal rounding (`Math.round(val * 100) / 100`). | Auto-fixed. Logs action: `rounded_to_2dp` or `stripped_formatting`. |
| **Negative Amount** | Parsed numerical amount is `< 0`. | Identifies the entry as a refund or credit rather than an expense. | Converts to absolute (positive) value, tags row as `is_refund`, flags for review. |
| **Missing Currency** | Currency column is empty. | SpreeTail operates natively on INR. | Auto-fixed. Defaults to `INR`. |

### Member & Identity Anomalies
| Anomaly Type | Detection Logic | Resolution Policy | Post-Action Status |
|--------------|-----------------|-------------------|--------------------|
| **Missing Payer** | `paid_by` column is empty. | Every expense requires a payer for balance tracking. | Assigns the expense to the default group creator. Flags for manual review. |
| **Unknown Payer / Split Member** | Name string fails direct DB lookup. Followed by a Levenshtein Distance calculation (threshold ≤ 2). | Corrects minor typos (e.g., "Devv" -> "Dev"). If the distance > 2, it assumes a completely unregistered user, generates a dummy email, inserts them into the `users` and `group_members` tables instantly. | Typos are auto-fixed (`fuzzy_matched_variant`). New dummy creations are flagged for review (`created_unknown_member`). |
| **Pre-join / Post-departure Expense** | Compares expense date against the `joined_at` and `left_at` timestamps of the target members. | Members cannot legally be charged for expenses incurred before they joined or after they left the group. | Excludes the invalid member from the split calculation for that specific row. |

### Semantic Anomalies
| Anomaly Type | Detection Logic | Resolution Policy | Post-Action Status |
|--------------|-----------------|-------------------|--------------------|
| **Settlement as Expense** | NLP substring detection on the description column (looks for `paid back`, `settlement`, `deposit`). | Settlements represent the transfer of existing debt, not the creation of new shared debt. Mixing them corrupts group balances. | Skips row from the expense ledger, queues it for insertion into the peer-to-peer `settlements` table. Flags for review. |
| **Conflicting Split Meta** | Detects colloquial terms ("share", "unequal") instead of strict enums (`equal`, `percentage`, `exact`, `shares`). | Maps conversational terms to supported strict backend enums. | Auto-fixed. Defaulted to closest strict enum. |
| **Split Percentage Sum Error** | Validates that all defined percentages sum precisely to 100%. | Math errors or rounding errors in external CSVs are common. | Proportionally normalizes the percentages to perfectly equal 100% using a weight multiplier. Flags for review. |

### Duplication Anomalies
| Anomaly Type | Detection Logic | Resolution Policy | Post-Action Status |
|--------------|-----------------|-------------------|--------------------|
| **Exact Duplicates** | Matches `Date` + `Payer` + `Amount` + `Exact Description` against already processed rows. | Identical consecutive or historical rows are almost always user export errors. | Skips row automatically. |
| **Fuzzy Duplicates** | Matches `Date` + `Payer` + Levenshtein `Description` (≤ 3). Amount may vary slightly. | Identifies potential double-entries (e.g., "Uber to Airport" and "Uber Airport trip"). | Halts the import process. Places the items in a staging table (`duplicate_pairs`) and requires human resolution via the UI wizard (Keep Both, Keep A, Keep B). |

---

## 2. Database Schema

SpreeTail relies on a strict, relational PostgreSQL database to guarantee financial integrity. Below is the comprehensive schema design.

### Core Tables
- **`users`**
  - `id` (SERIAL PRIMARY KEY)
  - `name` (VARCHAR)
  - `email` (VARCHAR UNIQUE)
  - `password_hash` (VARCHAR)
  - *Purpose*: Core identity tracking. Includes auto-generated "dummy" accounts created during CSV ingestion.

- **`groups`**
  - `id` (SERIAL PRIMARY KEY)
  - `name` (VARCHAR)
  - `currency` (VARCHAR, Default 'INR')
  - `created_by` (INT FOREIGN KEY to `users(id)`)
  - *Purpose*: Defines collaborative workspaces.

- **`group_members`**
  - `id` (SERIAL PRIMARY KEY)
  - `group_id` (INT FOREIGN KEY to `groups(id)`)
  - `user_id` (INT FOREIGN KEY to `users(id)`)
  - `joined_at` (TIMESTAMP)
  - `left_at` (TIMESTAMP NULL)
  - *Constraints*: UNIQUE(`group_id`, `user_id`, `joined_at`).
  - *Purpose*: Join table tracking temporal group participation. Critical for validating `Pre-join / Post-departure Expense` anomalies.

### Ledger Tables
- **`expenses`**
  - `id` (SERIAL PRIMARY KEY)
  - `group_id` (INT FOREIGN KEY to `groups(id)`)
  - `paid_by_user_id` (INT FOREIGN KEY to `users(id)`)
  - `amount_original` (DECIMAL)
  - `currency` (VARCHAR)
  - `amount_inr` (DECIMAL)
  - `exchange_rate` (DECIMAL)
  - `description` (TEXT)
  - `expense_date` (DATE)
  - `split_type` (VARCHAR - `equal`, `percentage`, `exact`, `shares`)
  - *Purpose*: The core shared liability ledger.

- **`expense_splits`**
  - `id` (SERIAL PRIMARY KEY)
  - `expense_id` (INT FOREIGN KEY to `expenses(id)`)
  - `user_id` (INT FOREIGN KEY to `users(id)`)
  - `split_value` (DECIMAL NULL)
  - `amount_inr` (DECIMAL)
  - *Purpose*: Records exactly how much debt is allocated to each member per expense based on the `split_type` math.

- **`settlements`**
  - `id` (SERIAL PRIMARY KEY)
  - `group_id` (INT FOREIGN KEY to `groups(id)`)
  - `payer_id` (INT FOREIGN KEY to `users(id)`)
  - `payee_id` (INT FOREIGN KEY to `users(id)`)
  - `amount_inr` (DECIMAL)
  - `settled_at` (DATE)
  - *Purpose*: Tracks peer-to-peer repayments intended to zero-out ledger debts.

### Ingestion Auditing Tables
- **`import_logs`**
  - `id` (SERIAL PRIMARY KEY)
  - `group_id` (INT FOREIGN KEY to `groups(id)`)
  - `file_name` (VARCHAR)
  - `status` (VARCHAR - `previewing`, `completed`, `failed`)
  - `imported_by` (INT FOREIGN KEY to `users(id)`)
  - *Purpose*: Master record for a CSV upload session.

- **`import_anomalies`**
  - `id` (SERIAL PRIMARY KEY)
  - `import_log_id` (INT FOREIGN KEY to `import_logs(id)`)
  - `row_number` (INT)
  - `anomaly_type` (VARCHAR)
  - `original_value` (TEXT)
  - `resolved_value` (TEXT NULL)
  - `action_taken` (VARCHAR)
  - `requires_review` (BOOLEAN)
  - *Purpose*: Granular auditing. Records every single auto-fix applied during ingestion for historical transparency.

- **`duplicate_pairs`**
  - `id` (SERIAL PRIMARY KEY)
  - `import_log_id` (INT FOREIGN KEY to `import_logs(id)`)
  - `row_a_number` (INT)
  - `row_b_number` (INT)
  - `similarity_reason` (TEXT)
  - `status` (VARCHAR - `pending`, `kept_both`, `deleted_a`, `deleted_b`)
  - *Purpose*: Staging table. Holds fuzzy duplicates hostage until a user explicitly resolves them via the frontend UI.
