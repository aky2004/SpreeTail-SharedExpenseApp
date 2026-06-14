# SpreeTail — Decision Log

This document records the key technical design decisions made during the development of the SpreeTail shared expenses application, including alternatives considered and final justifications.

---

## 1. Raw SQL (`pg`) vs Drizzle ORM
* **Context**: We needed a PostgreSQL database interface that handles nested splits, settlements, date-gating, and import logs.
* **Options Considered**: 
  1. *Drizzle ORM*: Typescript-first ORM with migration schemas.
  2. *Raw SQL (`pg` connection pool)*: Hand-written SQL queries in TypeScript services.
* **Decision**: **Raw SQL (`pg`)**.
* **Justification**: For a live interview/session, raw SQL is highly traceable and easy to debug. It shows complete control over relational queries (e.g. joins, subqueries for balances, and transactions during import) without hiding behavior behind an ORM abstraction layer.

## 2. Hardcoded Historical Currency Rates vs Live Rates API
* **Context**: Flatmates recorded Goa trip expenses in USD, EUR, and GBP. We needed exchange rates to convert to INR.
* **Options Considered**:
  1. *Live Exchange Rate API*: Query external APIs (like ExchangeRate-API) during import.
  2. *Hardcoded Historical Rates*: Lock in specific exchange rates in `currency.service.ts` (e.g. 1 USD = 83.00 INR, 1 EUR = 90.50 INR, 1 GBP = 105.00 INR).
* **Decision**: **Hardcoded Historical Rates**.
* **Justification**: Using live exchange rates would cause the import results to change every time the CSV is ingested (due to real-time market fluctuations). Hardcoding historical rates ensures **deterministic, reproducible import results** that perfectly match the original context of the spreadsheet, preventing balance drift.

## 3. Enforcing Date-Gating: Creation-Time vs Query-Time
* **Context**: Meera moved out on March 28; Sam joined on April 15. Sam should not pay for March bills, and Meera should not pay for April bills.
* **Options Considered**:
  1. *Query-Time Filtration*: Write complex SQL queries during balance calculations to exclude splits if date falls outside membership.
  2. *Creation-Time Validation*: Validate active membership when logging expenses or running imports, generating warnings/excluding members *before* inserting split rows.
* **Decision**: **Creation-Time Validation**.
* **Justification**: Creation-time validation is cleaner and keeps the database states accurate. Since splits only exist in `expense_splits` for members active on the expense date, the balance calculation engine (`calculateGroupBalances`) remains a fast, pure function that simply sums existing splits without needing complex date-range join filters.

## 4. Duplicate Pair Ingestion: Automatic Merging vs UI Review
* **Context**: Row 5 & 6 (Marina Bites) and Row 24 & 25 (Thalassa Dinner) represent duplicate or conflicting entries.
* **Options Considered**:
  1. *Automatic De-duplication*: Silently merge or drop rows based on Levenshtein thresholds.
  2. *Interactive UI Review Wizard*: Ingest both rows, flag them in the database, and show them side-by-side in the importer interface.
* **Decision**: **Interactive UI Review Wizard**.
* **Justification**: Merging duplicates automatically can result in silent guessing errors. An interactive wizard gives the user complete control (Meera's requirement: "must approve every deletion") to decide whether to "Keep both" or "Keep A/B only" before executing the database transactions.

## 5. Unknown CSV Members: Blocking Import vs Auto-Creation
* **Context**: Names like "Dev" or "Kabir" appear in CSV split lists but are not registered users in the group.
* **Options Considered**:
  1. *Block Ingestion*: Reject the CSV import until the user manually creates accounts.
  2. *Fuzzy Matching + Auto-Creation*: Fuzzy match variations (e.g. "Priya S" -> "Priya") and automatically create placeholder users (e.g., `kabir.groupid@spreetail.com`) for completely new names.
* **Decision**: **Fuzzy Matching + Auto-Creation**.
* **Justification**: Ingesting a CSV should be frictionless. Auto-creating placeholder users keeps the import running to completion while ensuring that all balance splits and who-owes-whom cash flows are tracked accurately.
