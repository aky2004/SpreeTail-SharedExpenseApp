# SpreeTail — AI Usage Log

This document records the AI tools, key prompt templates, and debugging/compilation corrections resolved during the development of the SpreeTail shared expenses application.

---

## 1. AI Tools & Key Prompts

* **Primary AI Tool**: Gemini 3.5 Flash (High) (via Antigravity IDE).
* **Key Prompts Used**:
  - *"Scaffold Vite React with TypeScript and configure Tailwind CSS v4."*
  - *"Create a pure getActiveMembersOnDate date-gating function."*
  - *"Implement a pure calculateGroupBalances cashflow-minimization engine."*
  - *"Build a CSV import preview and confirm transaction handler."*

---

## 2. Concrete Cases of AI Corrections

### Case 1: Malformed JSX Closing Tag in Sidebar Layout
* **AI Error**: During the generation of `frontend/src/components/layout/Sidebar.tsx`, the AI produced a malformed closing HTML tag:
  ```tsx
  </</aside>
  ```
* **How Caught**: Running the frontend build script (`npm run build`) triggered TypeScript compiler errors:
  ```bash
  src/components/layout/Sidebar.tsx(185,7): error TS1003: Identifier expected.
  src/components/layout/Sidebar.tsx(186,3): error TS1109: Expression expected.
  ```
* **Correction**: Corrected the closing tag to a valid `</aside>`.

---

### Case 2: Missing Payer Field in TypeScript Type Interface
* **AI Error**: The backend route handler `/api/expenses/group/:groupId` parsed `paid_by_user_id` from the request body to allow CSV logs to set custom payers. However, the shared `CreateExpenseRequest` interface in `backend/src/types/index.ts` did not declare this field, leading to compiler failures.
* **How Caught**: Running `npm run build` in the `/backend` folder failed with:
  ```bash
  src/routes/expenses.ts(75,7): error TS2353: Object literal may only specify known properties, and 'paid_by_user_id' does not exist in type 'CreateExpenseRequest'.
  src/services/expense.service.ts(160,22): error TS2339: Property 'paid_by_user_id' does not exist on type 'CreateExpenseRequest'.
  ```
* **Correction**: Appended `paid_by_user_id?: number` to `CreateExpenseRequest` inside `backend/src/types/index.ts`.

---

### Case 3: Relative Import Depth Path Errors
* **AI Error**: Pages inside `frontend/src/pages/` (Login, Register, Onboarding) were generated with incorrect relative imports referring to `AuthContext` and `api/client` via two levels up (`../../`):
  ```typescript
  import { useAuth } from '../../context/AuthContext';
  ```
* **How Caught**: TypeScript compilation failed, reporting:
  ```bash
  src/pages/Login.tsx(3,25): error TS2307: Cannot find module '../../context/AuthContext' or its corresponding type declarations.
  ```
* **Correction**: Changed the relative import paths to one level up (`../context/AuthContext` and `../api/client`) since the pages folder is a direct child of the `src` folder.

---

### Case 4: Strict Compiler Warnings on Unused Icon Imports
* **AI Error**: The template generators for `Dashboard.tsx`, `Balances.tsx`, and `Expenses.tsx` imported several icons from `lucide-react` (such as `DollarSign`, `TrendingUp`, `TrendingDown`, `Info`) that were not referenced in the final rendering logic.
* **How Caught**: Frontend build failed with strict `TS6133` unused declaration errors.
  ```bash
  src/pages/Dashboard.tsx(280,47): error TS6133: 'entry' is declared but its value is never read.
  src/pages/Balances.tsx(12,3): error TS6133: 'ChevronRight' is declared but its value is never read.
  ```
* **Correction**: Removed all unused icon imports and changed mapping arguments from `(entry, index)` to `(_, index)`.
