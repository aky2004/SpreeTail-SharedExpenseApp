# SpreeTail — Advanced Shared Expenses Platform

SpreeTail is a modern, full-stack shared finance application designed to handle complex group expenses, settlements, and large-scale historical data imports. It provides a robust ledger system capable of accurately splitting bills, tracking peer-to-peer repayments, and ingesting raw, unstructured CSV exports from external financial platforms.

The application features a sleek, premium "Obsidian Ink" aesthetic, prioritizing a clean, minimal user interface with subtle micro-animations to enhance the user experience without sacrificing performance.

## Key Features

1. **Intelligent CSV Ingestion Engine**: A powerful server-side parser that processes raw spreadsheet data, automatically detecting and resolving formatting issues, missing data, and ambiguous entries based on a strict set of anomaly resolution policies.
2. **Interactive Resolution Wizard**: A dedicated UI flow that halts the import process when fuzzy duplicates or unresolvable anomalies are found, requiring human-in-the-loop confirmation before committing financial data to the ledger.
3. **Dynamic Group Ledgers**: Real-time calculation of group balances and peer-to-peer settlement tracking.
4. **Premium UI/UX**: Custom-built CSS styling utilizing CSS variables, backdrop filters, and refined typography to create a polished, professional aesthetic.

## Architecture Overview

- **Frontend**: React, Vite, TypeScript, React Router, Lucide React (Icons).
- **Backend**: Node.js, Express, TypeScript, `csv-parse`.
- **Database**: PostgreSQL with the `pg` client.
- **Styling**: Vanilla CSS (No utility frameworks).

---

## Setup & Installation Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher.
- **PostgreSQL**: v14.0 or higher running locally or remotely.

### 1. Database Setup
1. Ensure your PostgreSQL service is active.
2. Connect to your local postgres instance and create a new database:
   ```bash
   createdb spreetail
   ```
3. Initialize the database schema by executing the provided SQL script:
   ```bash
   psql -d spreetail -f backend/src/db/schema.sql
   ```
4. Verify that tables such as `users`, `groups`, `expenses`, and `import_logs` have been created successfully.

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install the necessary Node dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables. Ensure the `DATABASE_URL` matches your local setup. The `.env` file should look like this:
   ```env
   PORT=3001
   DATABASE_URL="postgres://localhost:5432/spreetail"
   JWT_SECRET="your_secure_development_jwt_secret"
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The server should initialize and listen on `http://localhost:3001`.*

### 3. Frontend Setup
1. Open a new terminal session and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the necessary Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The client application will be accessible at `http://localhost:5173`. Vite will automatically proxy API requests to the backend.*

---

## AI Tools Utilized

This project was developed with the assistance of advanced AI pair-programming tools:
- **Antigravity IDE (powered by Gemini/Claude Models)**: Employed as the primary autonomous development agent to scaffold the architecture, implement the Node.js CSV parsing logic, design the custom CSS system, and debug complex integration issues.
- **Claude (Web Interface)**: Utilized externally to generate complex, edge-case laden sample CSV files (incorporating typographical errors, ambiguous dates, and formatting inconsistencies) to rigorously stress-test the backend anomaly detection engine.
