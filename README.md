# SpreeTail — Shared Expenses Application

SpreeTail is a shared expenses web application built to ingest, resolve, and audit shared flatmate ledger CSV sheets with time-varying group memberships.

---

## Technical Stack

* **Backend**: Node.js + Express + TypeScript + PostgreSQL (`pg` pool)
* **Frontend**: React (Vite) + TypeScript + Tailwind CSS (v4) + Recharts + Lucide Icons
* **Authentication**: JWT token pair (Access Token in localStorage + Refresh Token in HttpOnly secure cookie)

---

## Local Setup Instructions

### 1. Prerequisites
Ensure you have the following installed locally:
* **Node.js** (v18 or higher)
* **PostgreSQL** database server running locally

### 2. Database Setup
Create a local database named `spreetail` and load the schema:
```bash
# Create database
createdb spreetail

# Ingest schema
psql -d spreetail -f backend/src/db/schema.sql
```

### 3. Backend Setup
Navigate to the `/backend` folder, install dependencies, and configure your environment:
```bash
cd backend
npm install
```
Create a `.env` file inside `/backend` (see template below):
```env
PORT=3001
DATABASE_URL=postgresql://localhost:5432/spreetail
JWT_ACCESS_SECRET=your_jwt_access_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
FRONTEND_URL=http://localhost:5173
```
Run migrations (optional seed script if present) and start the development API server:
```bash
# Compile and run
npm run dev
```
The API server will run on `http://localhost:3001`.

### 4. Frontend Setup
Navigate to the `/frontend` folder, install dependencies, and configure your environment:
```bash
cd ../frontend
npm install
```
Create a `.env` file inside `/frontend`:
```env
VITE_API_URL=http://localhost:3001/api
```
Start the frontend development hot-reloading server:
```bash
npm run dev
```
The application interface will open on `http://localhost:5173`.

---

## Deployment Guide

### Backend (Railway)
1. Link your git repo to **Railway**.
2. Provision a **PostgreSQL** database on Railway.
3. Configure the Railway project environment variables (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`).
4. Railway will automatically pick up the start script: `npm run build && npm start`.

### Frontend (Vercel)
1. Link your repo to **Vercel**.
2. Select `/frontend` as the root directory.
3. Set the build command: `npm run build` and output directory: `dist`.
4. Set the environment variable: `VITE_API_URL=https://your-railway-app.railway.app/api`.
5. Deploy.
