# Splittrack 💸 — Multi-Currency Group Expense Tracker & Settlement Engine

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Turso](https://img.shields.io/badge/Turso-libSQL-4AB8A1?style=for-the-badge&logo=sqlite)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.35-C5F74F?style=for-the-badge)
![Vercel Ready](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel)

**Splittrack** is a high-performance, modern web application designed for tracking group expenses, managing shared balances, and calculating optimal debt settlement transactions. Built with Next.js App Router, Tailwind CSS, NextAuth.js, and Drizzle ORM paired with Turso libSQL.

---

## ✨ Features

- 👥 **Group & Project Hub**: Create isolated projects for group trips, housemates, events, and shared budgets.
- 💰 **Smart Debt Simplification**: Built-in settlement engine computes the minimal number of peer-to-peer transfers required to clear all balances.
- 🌍 **Multi-Currency Support**: Support for major global currencies (USD, EUR, GBP, INR, CAD, AUD, etc.) with explicit currency notices and formatting.
- 📊 **Export Reports**: Instant export of transactions, group totals, and person balance sheets to Microsoft Excel (`.xlsx`) and CSV formats.
- ⚡ **Serverless-Ready Database**: Utilizes **Turso (libSQL)** for ultra-fast, edge-compatible HTTP queries on Vercel, with seamless automatic fallback to local disk-based SQLite (`expense-tracker.db`) for offline development.
- 🔒 **Enterprise-Grade Security**: NextAuth JWT authentication, strict passkey hashing with `bcryptjs`, zero hardcoded credentials, and automated `.gitignore` rules for environment variables and SQLite databases.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router & Server Actions)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with CSS Variable design system
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (Credentials Provider with JWT sessions)
- **Database**: [Turso (libSQL)](https://turso.tech/) + [Drizzle ORM](https://orm.drizzle.team/)
- **Testing**: [Vitest](https://vitest.dev/) for unit testing calculations and balance logic
- **Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/jeevesh2515/expense-tracker.git
cd expense-tracker
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to create your local `.env.local`:

```bash
cp .env.example .env.local
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. In local development mode, the app automatically initializes a SQLite database file at `./data/expense-tracker.db`.

---

## 🌐 Deploying to Vercel

### Step 1: Create a Turso Database (Recommended for Production)

1. Install the Turso CLI or log into [Turso Dashboard](https://turso.tech).
2. Create a new database and auth token:
   ```bash
   turso db create expense-tracker
   turso db tokens create expense-tracker
   ```

### Step 2: Push to Vercel

1. Import the repository `jeevesh2515/expense-tracker` in the [Vercel Dashboard](https://vercel.com/new).
2. Add the following **Environment Variables** in your Vercel Project Settings:

| Environment Variable | Description | Example / Value |
| :--- | :--- | :--- |
| `NEXTAUTH_SECRET` | Secret key used to encrypt NextAuth JWT tokens | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical URL of your deployment | `https://your-app-name.vercel.app` |
| `TURSO_DATABASE_URL` | Turso libSQL Database Connection URL | `libsql://expense-tracker-username.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso libSQL Authentication Token | `your-turso-auth-token` |

3. Click **Deploy**. Vercel will automatically build and publish your web application!

---

## 🔒 Security & Privacy

- **No Exposed Secrets**: All sensitive credentials (`AUTH_SECRET`, `TURSO_AUTH_TOKEN`, database files) are strictly ignored by `.gitignore` and kept out of version control.
- **Environment Isolation**: Production tokens exist solely in Vercel's secure environment settings.
- **Safe Fallbacks**: Build scripts safely fall back to local disk mode during static compilation to prevent build-time crashes if environment variables are temporarily missing.

---

## 🧪 Testing

Run the automated test suite for debt settlement algorithms and calculations:

```bash
npm run test
```

To run a full production build check locally:

```bash
npm run build
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
