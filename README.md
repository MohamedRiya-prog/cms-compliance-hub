# CMS Compliance Hub

> **Internal HVAC specification compliance engine for Century Mechanical Systems (CMS) / Excelair**

A full-stack web application that automates the analysis of project specification documents against CMS product data, generating structured compliance reports powered by Claude AI.

---

## What it does

Engineers upload project specification PDFs or Word documents. The system extracts relevant clauses, compares them against CMS product technical data, and produces a structured compliance table — clause by clause — with statuses (Comply / Not Comply / Noted / Not Part of Proposal). Reports can be reviewed, edited, re-verified via AI chat, and exported to Excel.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI Engine | Claude claude-sonnet-4-6 (Anthropic) |
| ORM / Schema | Prisma 7 (schema reference) |
| Styling | Tailwind CSS v4 + oklch design tokens |
| Animation | Framer Motion |
| Export | ExcelJS |
| Document Parsing | Mammoth (DOCX), pdf-parse (PDF) |

---

## Features

### Projects
- Create projects with client, location, contractor, main contractor, consultant, and auto-generated reference numbers (`CMS-2026-001`)
- Contractor / consultant / main contractor fields backed by a searchable company database
- Company request flow — engineers can request unlisted companies, admins approve

### Compliance Reports
- Upload spec documents (PDF / DOCX)
- AI-generated compliance table with clause-by-clause analysis
- Filter rows by status
- Inline editing of product response, status, and remarks
- Re-verify individual clauses via AI chat panel
- Export to `.xlsx`

### Admin Tools
- **Products** — Markdown-based product data editor with live preview
- **Rules** — Global compliance rules applied to every report (admin-only)
- **Companies** — Paginated company database with CSV bulk import, role tagging (contractor / main contractor / consultant), and location data

### Access Control
- Role-based: `admin` vs `engineer`
- Admins: full access including Rules, Companies management, product editing
- Engineers: project work + read-only settings; can request company additions
- Mobile: read-only compliance view + export only (no generation workflow)

### Mobile
- Responsive layout with hamburger drawer navigation
- Compliance tables horizontally scrollable
- Generation features hidden on small screens; download always available

---

## Project Structure

```
cms-compliance-hub/
├── app/
│   ├── (auth)/              # Login & register pages
│   ├── (dashboard)/         # Main app — projects, reports, settings
│   └── api/                 # API routes
│       ├── companies/       # Company CRUD + import + request flow
│       ├── compliance/      # Report generation, chat, export, row edits
│       ├── documents/       # Upload & parse spec documents
│       ├── projects/        # Project CRUD + auto reference numbers
│       └── admin/           # Products & rules (admin only)
├── components/
│   ├── layout/sidebar.tsx   # Collapsible sidebar + mobile drawer
│   └── ui/                  # Reusable UI (SearchableSelect, etc.)
├── lib/
│   ├── prompt-builder.ts    # Assembles AI prompts from product data + rules
│   ├── document-parser.ts   # PDF / DOCX text extraction
│   ├── compliance-validator.ts
│   └── supabase/            # Server, client, admin Supabase clients
├── prisma/schema.prisma     # Database schema reference
└── scripts/seed.ts          # Product data seeder
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

### 1. Clone & install

```bash
git clone https://github.com/MohamedRiya-prog/cms-compliance-hub.git
cd cms-compliance-hub
npm install
```

### 2. Environment variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### 3. Database setup

Run the following in your Supabase SQL Editor to create the required tables:

```sql
-- See prisma/schema.prisma for the full schema
-- Key tables: profiles, projects, spec_documents, compliance_reports,
--             compliance_rows, chat_messages, product_data,
--             compliance_rules, compliance_examples,
--             companies, company_requests
```

### 4. Seed product data

```bash
npm run db:seed
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment

The app is deployed on [Vercel](https://vercel.com). On every push to `main`, Vercel automatically rebuilds and deploys.

**Required environment variables in Vercel:**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `ANTHROPIC_API_KEY` | Claude API key |

**After deploying**, add your Vercel URL to Supabase:
- **Authentication → URL Configuration → Site URL**
- **Redirect URLs** → `https://your-app.vercel.app/api/auth/callback`

---

## Database Schema Overview

```
profiles          — user roles (admin / engineer)
projects          — client projects with metadata
spec_documents    — uploaded PDF/DOCX files
compliance_reports — AI-generated compliance tables
compliance_rows   — individual clause rows
chat_messages     — AI chat history per report
product_data      — CMS product technical data (per family)
compliance_rules  — global rules applied to all reports
companies         — contractor / consultant / main contractor database
company_requests  — pending company addition requests
```

---

## Role Reference

| Action | Engineer | Admin |
|---|---|---|
| Create / view projects | ✅ | ✅ |
| Upload specs & generate reports | ✅ | ✅ |
| Edit compliance rows | ✅ | ✅ |
| Export reports | ✅ | ✅ |
| View Products | ✅ | ✅ |
| Edit Products | ❌ | ✅ |
| View / Edit Rules | ❌ | ✅ |
| Manage Companies | ❌ | ✅ |
| Request company addition | ✅ | ✅ |
| Approve company requests | ❌ | ✅ |

---

## Making a User Admin

```sql
UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
```

---

*Built for Century Mechanical Systems Factory LLC — internal use only*
