# Architectural Decision Log

This log outlines the significant engineering, architectural, and design decisions made during the development of SpreeTail. It details the alternatives considered, the tradeoff analysis, and the rationale for the final choices to provide context for future maintenance and scalability.

---

## 1. Frontend Architecture & Framework
- **Decision**: React with Vite and TypeScript.
- **Alternatives Considered**: Next.js (App Router), plain JavaScript with Create React App (CRA).
- **Rationale**: 
  - *Why not CRA?* CRA is effectively deprecated, slow to compile, and lacks native ESM support.
  - *Why not Next.js?* While Next.js offers excellent SSR and SEO capabilities, SpreeTail is an authenticated, highly interactive Dashboard Application. The core complexity lies in client-side state transitions (specifically the multi-step CSV ingestion wizard and the interactive Duplicate Resolution UI). A Single Page Application (SPA) architecture built with Vite provides blazing fast Hot Module Replacement (HMR) during development, smaller deployment footprints, and a highly responsive UX without the overhead of server-side hydration.
  - *Why TypeScript?* The anomaly detection engine returns highly complex, deeply nested JSON structures representing various edge cases. TypeScript was mandatory to ensure interface consistency between the Express backend and React frontend, preventing runtime `undefined` errors.

## 2. Styling System & UI/UX Approach
- **Decision**: Vanilla CSS with a custom "Obsidian Ink" design system utilizing CSS Variables.
- **Alternatives Considered**: Tailwind CSS, Material-UI, Bootstrap.
- **Rationale**: 
  - *Why not Material-UI/Bootstrap?* These frameworks often impose a generic, "cookie-cutter" look that is difficult to override for premium aesthetics.
  - *Why not Tailwind CSS?* Tailwind is industry-standard for rapid prototyping. However, the explicit project requirements demanded a highly customized, premium, minimal, and sleek aesthetic ("not too vibrant"). Relying on global CSS variables (`--color-bg-base`, `--color-accent`) combined with targeted vanilla CSS allowed for precise, granular control over hardware-accelerated glassmorphism effects (`backdrop-filter`), bespoke micro-animations (`.animate-fade-in`, `.hover-lift`), and hover transitions. Attempting to achieve this exact level of custom animation and layered box-shadow depth with Tailwind utility classes would have resulted in unreadable JSX files.

## 3. CSV Parsing Architecture (The Ingestion Engine)
- **Decision**: Server-Side parsing using Node.js (`csv-parse`) in a transaction-safe environment.
- **Alternatives Considered**: Client-side parsing using `PapaParse` directly in the browser.
- **Rationale**: 
  - *Why not Client-Side?* Parsing the CSV in the browser is faster for the user initially and saves server bandwidth. However, SpreeTail's anomaly detection engine requires deep, contextual database knowledge to validate the data. For instance, determining if an expense is logged for a member *before* they officially joined the group requires checking their `joined_at` timestamp. Fuzzy-matching a misspelled name requires scanning the entire existing database of users. 
  - Doing this on the client would require downloading the entire group's user dataset and historical logs, posing a massive security risk and performance bottleneck. Server-side parsing allows direct, secure access to PostgreSQL to validate constraints, calculate Levenshtein distances securely, and create placeholder users atomically.

## 4. Duplicate Record Handling Policy
- **Decision**: Human-in-the-Loop interactive resolution for Fuzzy Duplicates.
- **Alternatives Considered**: Auto-deleting duplicates (Last-Write-Wins) or aggressively blocking/rejecting the entire CSV import.
- **Rationale**: 
  - Financial data requires strict auditability. Exact duplicates (same date, amount, payer, exact description) are safely auto-skipped by the engine as they are guaranteed to be export overlaps. 
  - However, "Fuzzy" duplicates (same date, payer, but a slight variation in description, e.g., "Uber" vs "Uber Ride") could genuinely be two separate purchases made at the same merchant on the same day. Auto-deleting them risks permanent financial data loss for the user. Blocking the import entirely frustrates the user and breaks the UX flow. 
  - The chosen solution stages the import, pauses the commit, and presents a UI wizard for the user to manually select "Keep Both", "Keep Row A", or "Keep Row B". This prioritizes data safety and user agency.

## 5. Database Engine Selection
- **Decision**: PostgreSQL.
- **Alternatives Considered**: MongoDB, Firebase/Firestore.
- **Rationale**: 
  - Expense tracking is inherently relational. Users belong to Groups, Expenses belong to Groups, Settlements link two Users together, and Expense Splits map exactly how much debt a specific User owes on a specific Expense.
  - NoSQL databases (MongoDB/Firestore) lack native `JOIN` capabilities, often requiring complex, manual data duplication (denormalization) to handle these queries efficiently. When a user updates their name or a group changes its currency, NoSQL requires cascading updates across thousands of expense documents.
  - PostgreSQL's robust relational model, strict ACID compliance, and ability to handle complex mathematical aggregation queries (calculating net balances across thousands of transactions) made it the objectively superior, enterprise-grade choice for a fintech application.

## 6. Handling "Unknown" Members in Historical CSVs
- **Decision**: Auto-create "Dummy" placeholder accounts bound to the group.
- **Alternatives Considered**: Rejecting the CSV row entirely, or dropping the unknown member from the split calculation.
- **Rationale**: 
  - Users frequently upload historical CSV ledgers containing names of roommates or friends who haven't officially registered on the SpreeTail app yet. 
  - Rejecting the row entirely breaks the historical integrity of the ledger. Dropping the unknown member from the split calculation corrupts the math (a $100 bill split 4 ways becomes $33.33 split 3 ways, which is factually incorrect). 
  - The decision to auto-generate a placeholder account (with a deterministic dummy email like `kabir.group3@spreetail.com`) allows the database constraints to remain intact and the math to remain perfectly balanced. When the real user registers later, their account can theoretically be merged with the placeholder.
