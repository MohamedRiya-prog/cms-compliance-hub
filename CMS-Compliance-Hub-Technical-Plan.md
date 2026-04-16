# CMS Compliance Hub — Technical Specification & Implementation Plan

**Version:** 1.1  
**Date:** April 14, 2026  
**Author:** Riyaz / CMS Global  
**Status:** Planning  
**Changelog:**  
v1.2 — Latest 2026 dependencies, Awwwards-level UI/animation stack, design system spec  
v1.1 — Added Opus model requirement, output consistency strategy, reference site analysis (Gulf O Flex Assist), revised cost estimates, design direction notes

---

## 1. Project Overview

### What Is It?
CMS Compliance Hub is an internal web application for Century Mechanical Systems Factory LLC (Excelair). It allows the CMS sales and estimation team to upload HVAC project specifications and generate clause-by-clause compliance tables comparing those specs against the Excelair product catalog.

### Key Decisions

| Decision | Choice |
|----------|--------|
| App Name | CMS Compliance Hub |
| Users | Internal CMS/Excelair team only |
| Compliance Engine | Claude Opus API (no separate rule engine — Claude is the engine) |
| AI Model | Claude Opus 4.6 (`claude-opus-4-6`) — Sonnet tested and rejected (insufficient accuracy) |
| Output Consistency | Temperature 0 + structured JSON + post-processing validation + result caching |
| Input Formats | PDF, Word (.docx), Excel (.xlsx), paste text |
| Architecture | Project-based — users create projects, reports live under projects |
| Conversational Re-verification | Yes — chat panel alongside compliance table |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | Email + password via Supabase Auth |

### Core User Flow
1. User logs in
2. Creates a project (e.g., "Al Maktoum Airport Terminal 2")
3. Uploads a specification document (PDF/DOCX/XLSX) or pastes text
4. System extracts HVAC sections, maps to Excelair products
5. Claude generates clause-by-clause compliance table
6. User reviews the interactive table, can chat with Claude to re-verify any row
7. User exports the final table as .xlsx

---

## 2. Tech Stack (Latest Versions — April 2026)

### Frontend
- **Framework:** Next.js 16 (App Router) with React 19 and TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (New York style variant)
- **Animation Stack:**
  - Framer Motion 12 — primary animation library (page transitions, component enter/exit, layout animations, gesture-based interactions)
  - GSAP 3.15 — complex sequenced animations (timeline-based chart animations, scroll-triggered reveals, staggered data table entries)
  - Lenis — buttery smooth scrolling across the entire app
  - MagicUI — pre-built animated dashboard components (animated counters, shimmer cards, aurora backgrounds, gradient borders)
- **State Management:** React 19 Server Components + `useOptimistic` for real-time table edits; Zustand 5 for client-side state
- **Data Fetching:** Server Actions + TanStack React Query 5 for client-side caching
- **Charts:** Recharts with Framer Motion layered animations for compliance stats
- **Icons:** Lucide React 1.8
- **Page Transitions:** next-transition-router + Framer Motion AnimatePresence

### Backend
- **API:** Next.js Route Handlers (App Router `/app/api/...`)
- **AI Engine:** Anthropic Claude Opus API via `@anthropic-ai/sdk`
- **Document Parsing:**
  - PDF: `pdf-parse` for text extraction, or Claude API native PDF input for complex layouts
  - Word: `mammoth` for .docx to structured text
  - Excel: `SheetJS (xlsx)` for reading specification schedules
- **Excel Export:** `ExcelJS` for generating color-coded .xlsx compliance tables
- **Validation:** Zod 4 for schema validation (API inputs, Claude JSON output, forms)
- **File Upload:** Supabase Storage (S3-compatible)

### Infrastructure
- **Hosting:** Vercel Pro (300s serverless function timeout for Opus API calls)
- **Database:** Supabase PostgreSQL with Prisma 7 ORM
- **Auth:** Supabase Auth via `@supabase/ssr` (email + password)
- **File Storage:** Supabase Storage
- **Environment:** Node.js 22+

### Dependency Manifest (Pinned Latest — April 2026)
```json
{
  "dependencies": {
    "next": "^16.2.3",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "tailwindcss": "^4.2.2",
    "framer-motion": "^12.38.0",
    "gsap": "^3.15.0",
    "lenis": "^1.3.21",
    "@anthropic-ai/sdk": "^0.89.0",
    "@supabase/supabase-js": "^2.103.0",
    "@supabase/ssr": "^0.10.2",
    "prisma": "^7.7.0",
    "@prisma/client": "^7.7.0",
    "exceljs": "^4.4.0",
    "mammoth": "^1.12.0",
    "xlsx": "^0.18.5",
    "@tanstack/react-query": "^5.99.0",
    "zustand": "^5.0.12",
    "zod": "^4.3.6",
    "lucide-react": "^1.8.0",
    "recharts": "^2.15.0",
    "next-transition-router": "^0.5.0"
  }
}
```

### shadcn/ui Setup
```bash
npx shadcn@latest init
# Select: New York style, CSS variables, Tailwind CSS v4
# All components customized with Framer Motion entrance/exit animations
```

---

## 3. Database Schema (Supabase PostgreSQL)

### Entity Relationship

```
User (Supabase Auth)
 └── Project
      ├── SpecDocument (uploaded files)
      └── ComplianceReport
           ├── ComplianceRow[]
           └── ChatMessage[]
```

### Tables

#### `profiles` (extends Supabase auth.users)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'engineer',  -- 'engineer', 'admin'
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Al Maktoum Airport Terminal 2"
  client TEXT,                           -- "Dubai Aviation Engineering"
  location TEXT,                         -- "Dubai, UAE"
  project_number TEXT,                   -- internal reference
  description TEXT,
  status TEXT DEFAULT 'active',          -- 'active', 'archived'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_user ON projects(user_id);
```

#### `spec_documents` (uploaded specification files)
```sql
CREATE TABLE spec_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,               -- 'pdf', 'docx', 'xlsx', 'text'
  file_size INTEGER,
  storage_path TEXT NOT NULL,            -- Supabase Storage path
  extracted_text TEXT,                   -- parsed text content
  extracted_sections JSONB,              -- structured sections detected
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_specs_project ON spec_documents(project_id);
```

#### `compliance_reports`
```sql
CREATE TABLE compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  spec_document_id UUID REFERENCES spec_documents(id),
  title TEXT NOT NULL,                   -- "Section 2.6 — Fire Dampers"
  product_family TEXT NOT NULL,          -- 'BDD_PRD', 'EVFD', 'EFD', 'EFSD', 'ESD', etc.
  product_model TEXT,                    -- "EVFD-10D-B"
  status TEXT DEFAULT 'generating',      -- 'generating', 'review', 'approved', 'exported'
  summary JSONB,                         -- { total: 10, comply: 8, notComply: 1, noted: 1, notPartOfProposal: 0 }
  prompt_version TEXT,                   -- track which prompt version generated this
  generation_metadata JSONB,             -- { model, tokens_used, duration_ms, etc. }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reports_project ON compliance_reports(project_id);
```

#### `compliance_rows` (individual table rows)
```sql
CREATE TABLE compliance_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES compliance_reports(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  clause TEXT NOT NULL,                  -- "2.6 H"
  requirement TEXT NOT NULL,             -- verbatim from spec
  product_response TEXT,                 -- Excelair product data
  status TEXT NOT NULL,                  -- 'comply', 'not_comply', 'noted', 'not_part_of_proposal', 'header'
  remark TEXT,
  confidence TEXT DEFAULT 'high',        -- 'high', 'medium', 'low' (how confident Claude was)
  is_edited BOOLEAN DEFAULT false,       -- user manually edited this row
  original_response JSONB,              -- preserve Claude's original before user edits
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rows_report ON compliance_rows(report_id);
```

#### `chat_messages` (conversational re-verification)
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES compliance_reports(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                    -- 'user', 'assistant'
  content TEXT NOT NULL,
  referenced_row_id UUID REFERENCES compliance_rows(id), -- which row the user is asking about
  row_updates JSONB,                     -- if Claude suggested changes: { rowId, field, oldValue, newValue }
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_report ON chat_messages(report_id);
```

#### `product_data` (Excelair product catalog — admin-managed)
```sql
CREATE TABLE product_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family TEXT NOT NULL,                  -- 'BDD', 'PRD', 'EVFD', 'EFD', 'EFSD', 'ESD', etc.
  content TEXT NOT NULL,                 -- markdown content (same format as products.md)
  version INTEGER DEFAULT 1,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `compliance_rules` (the 23+ rules — admin-managed)
```sql
CREATE TABLE compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,                 -- full rules markdown
  version INTEGER DEFAULT 1,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `compliance_examples` (verified examples — admin-managed)
```sql
CREATE TABLE compliance_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,                 -- full examples markdown
  version INTEGER DEFAULT 1,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS)
```sql
-- Users can only see their own projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Cascade: reports, rows, chat visible if user owns the project
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own reports" ON compliance_reports
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- Similar policies for compliance_rows, chat_messages, spec_documents
-- Admin role can access product_data, compliance_rules, compliance_examples
```

---

## 4. Route Structure (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx                        ← sidebar + top nav
│   ├── page.tsx                          ← dashboard (project list)
│   ├── projects/
│   │   ├── new/page.tsx                  ← create project form
│   │   └── [projectId]/
│   │       ├── page.tsx                  ← project detail + reports list
│   │       ├── settings/page.tsx         ← edit project metadata
│   │       ├── upload/page.tsx           ← upload spec + preview sections
│   │       └── reports/
│   │           └── [reportId]/
│   │               └── page.tsx          ← compliance table + chat panel
│   └── settings/
│       ├── profile/page.tsx              ← user profile
│       ├── products/page.tsx             ← manage Excelair product data
│       └── rules/page.tsx                ← manage compliance rules
├── api/
│   ├── auth/
│   │   └── callback/route.ts
│   ├── projects/
│   │   └── route.ts                      ← CRUD
│   ├── compliance/
│   │   ├── generate/route.ts             ← trigger compliance generation
│   │   ├── export/route.ts               ← generate .xlsx download
│   │   └── [reportId]/
│   │       ├── rows/route.ts             ← update individual rows
│   │       └── chat/route.ts             ← streaming chat endpoint
│   ├── documents/
│   │   ├── upload/route.ts               ← file upload to Supabase Storage
│   │   └── parse/route.ts                ← extract text + detect sections
│   └── admin/
│       ├── products/route.ts             ← CRUD product data
│       └── rules/route.ts                ← CRUD rules
└── globals.css
```

---

## 5. Claude API Integration Design

### Model Selection & Consistency Strategy

**Why Opus, not Sonnet:** The compliance task requires holding 23 strict rules in working memory, cross-referencing a large product database, interpreting varied spec language, and making precise judgment calls (Comply vs Noted vs Not Comply). Testing with the Cowork skill confirmed that Opus produces reliable, accurate compliance tables while Sonnet produces inconsistent and less accurate results. For a compliance tool where a wrong status could affect a tender submission, accuracy is non-negotiable.

**Consistency guarantees (same spec → same output):**

1. **Temperature 0** — Set `temperature: 0` on all compliance generation calls. This makes Claude's sampling deterministic, producing near-identical output for the same input.

2. **Structured JSON output** — Force Claude to return a strict JSON schema rather than free-form text. This constrains the response format and eliminates wording variability:
   ```json
   {
     "rows": [
       {
         "clause": "2.6 H",
         "requirement": "Blades: roll-formed, interlocking, 0.85mm galvanized steel",
         "productResponse": "Blades: 24 gauge (0.70mm) galvanized steel, curtain style, out of airstream",
         "status": "not_comply",
         "remark": "Not comply — blade thickness 0.70mm (24 gauge); specification requires 0.85mm (22 gauge) minimum",
         "confidence": "high"
       }
     ]
   }
   ```

3. **Post-processing validation** — After Claude returns JSON, the backend runs automated rule checks:
   - Rule 1: Product Response contains no forbidden words ("standard", "optional", "available")
   - Rule 6: If status is "comply" with no conditions, remark must be exactly "Comply"
   - Rule 7: If status is "not_part_of_proposal", product response must be blank
   - Rule 20: Product Response contains no "not confirmed" language
   - Any violations get auto-corrected or flagged for review

4. **Result caching and deduplication** — When a spec is uploaded, the system computes a text hash of the extracted content. If a matching hash exists in the project (same spec uploaded before), the system prompts: "A report for this specification already exists — view it or generate fresh?" This prevents unnecessary re-generation and ensures the team works from a single source of truth.

5. **Prompt parity with skill** — The API system prompt uses the identical content from the Cowork skill — same rules.md, products.md, and examples.md stored in the database. No paraphrasing, no summarization. This ensures the API produces the same quality as the skill running in the Claude desktop app.

### System Prompt Architecture

The system prompt is assembled dynamically from the database for each compliance generation call:

```typescript
function buildSystemPrompt(productFamily: string): string {
  // Fetch from database (cached)
  const rules = await getComplianceRules();         // rules.md content
  const products = await getProductData(productFamily); // relevant product data
  const examples = await getComplianceExamples();   // verified examples

  return `
You are an HVAC Compliance Engineer assistant for Century Mechanical Systems 
Factory LLC (Excelair), UAE. Your function is to generate structured compliance 
data comparing project specifications against Excelair product datasheets.

## PRODUCT DATA
${products}

## COMPLIANCE RULES (ABSOLUTE — override everything)
${rules}

## VERIFIED EXAMPLES (follow this format exactly)
${examples}

## OUTPUT FORMAT
Return a JSON array of compliance row objects. Each object must have:
- clause: string (e.g., "2.6 H")
- requirement: string (verbatim from specification)
- productResponse: string (proposed value only, per Rule 1)
- status: "comply" | "not_comply" | "noted" | "not_part_of_proposal" | "header"
- remark: string (per Rule 6)
- confidence: "high" | "medium" | "low"

Return ONLY valid JSON. No markdown, no explanation outside the array.
  `;
}
```

### Compliance Generation Flow

```typescript
// POST /api/compliance/generate
async function generateCompliance(req: Request) {
  const { specText, productFamily, specDocumentId, projectId } = await req.json();

  // 1. Build the system prompt with latest product data + rules
  const systemPrompt = await buildSystemPrompt(productFamily);

  // 2. Call Claude API
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Generate a compliance table for the following specification section:\n\n${specText}`
      }
    ]
  });

  // 3. Parse and validate JSON response
  const rows = parseAndValidateRows(response.content[0].text);

  // 4. Create report + rows in database
  const report = await createReport({
    projectId,
    specDocumentId,
    productFamily,
    rows,
    promptVersion: currentPromptVersion,
    generationMetadata: {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  });

  return Response.json(report);
}
```

### Conversational Re-verification Flow

```typescript
// POST /api/compliance/[reportId]/chat (streaming)
async function chatAboutReport(req: Request) {
  const { message, referencedRowId } = await req.json();
  const { reportId } = params;

  // 1. Load report context
  const report = await getReportWithRows(reportId);
  const chatHistory = await getChatHistory(reportId);
  const systemPrompt = await buildSystemPrompt(report.productFamily);

  // 2. Build conversation with full context
  const messages = [
    {
      role: "user",
      content: `Here is the compliance table I generated:\n${formatTableAsText(report.rows)}\n\nOriginal specification:\n${report.specText}`
    },
    { role: "assistant", content: "I have the compliance table and specification context. How can I help?" },
    ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
    {
      role: "user",
      content: referencedRowId
        ? `Regarding clause ${getRow(referencedRowId).clause}: ${message}`
        : message
    }
  ];

  // 3. Stream response
  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: systemPrompt + `\n\nIf the user asks you to update a row, respond with the updated row data in this JSON format at the end of your message:\n[UPDATE_ROW]{"rowId":"...","clause":"...","productResponse":"...","status":"...","remark":"..."}[/UPDATE_ROW]`,
    messages,
  });

  // 4. Return streaming response (handle row updates on the client)
  return new Response(stream.toReadableStream());
}
```

---

## 6. Document Parsing Pipeline

### Architecture

```
Upload → Detect Type → Parse → Extract Text → Detect HVAC Sections → Preview
```

### Section Detection Logic

```typescript
// Detect HVAC sections from extracted text
const SECTION_PATTERNS = [
  { pattern: /backdraft.*damper|pressure.*relief.*damper/i, family: 'BDD_PRD', label: 'Backdraft & Pressure Relief Dampers' },
  { pattern: /barometric.*relief.*damper/i, family: 'PRD', label: 'Barometric Relief Dampers' },
  { pattern: /(?:^|\n)\s*\d+\.\d+.*fire\s+damper/i, family: 'EVFD', label: 'Fire Dampers' },
  { pattern: /motorized.*fire.*damper/i, family: 'EFD', label: 'Motorized Fire Dampers' },
  { pattern: /smoke\s+damper/i, family: 'ESD', label: 'Smoke Dampers' },
  { pattern: /combination.*fire.*smoke|fire.*smoke.*damper/i, family: 'EFSD', label: 'Combination Fire & Smoke Dampers' },
  { pattern: /volume.*control.*damper|balancing.*damper/i, family: 'EVCD', label: 'Volume Control Dampers' },
  { pattern: /sound.*attenuator|duct.*silencer/i, family: 'SA', label: 'Sound Attenuators' },
  { pattern: /ventilation.*louver|exhaust.*louver|fresh.*air.*louver/i, family: 'FAL', label: 'Fresh Air Louvers' },
];

function detectSections(text: string): DetectedSection[] {
  // Split by section numbers (e.g., 2.2, 2.3, 2.6)
  // Match each section against patterns
  // Return array of { sectionNumber, title, family, text, startLine, endLine }
}
```

### Parser Implementations

```typescript
// PDF
import pdfParse from 'pdf-parse';
async function parsePDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

// Word
import mammoth from 'mammoth';
async function parseDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Excel
import * as XLSX from 'xlsx';
async function parseXLSX(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  // Convert relevant sheets to text
  return workbook.SheetNames
    .map(name => XLSX.utils.sheet_to_txt(workbook.Sheets[name]))
    .join('\n\n');
}
```

---

## 7. Excel Export Design

The export must match the formatting the team is already accustomed to from the skill output:

```typescript
import ExcelJS from 'exceljs';

async function generateComplianceExcel(report: ComplianceReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(report.title);

  // Column widths
  sheet.columns = [
    { header: 'Clause', key: 'clause', width: 12 },
    { header: 'Requirement', key: 'requirement', width: 45 },
    { header: 'Product Response', key: 'productResponse', width: 40 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Remark', key: 'remark', width: 40 },
  ];

  // Header row styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };

  // Add rows with color coding
  report.rows.forEach(row => {
    const excelRow = sheet.addRow({
      clause: row.clause,
      requirement: row.requirement,
      productResponse: row.productResponse,
      status: formatStatus(row.status),
      remark: row.remark,
    });

    // Color coding
    const fillColor = {
      comply: 'FFC6EFCE',        // green
      not_comply: 'FFFFC7CE',    // red
      noted: 'FFFFEB9C',         // yellow
      not_part_of_proposal: 'FFD9D9D9', // grey
      header: 'FFD6E4F0',       // light blue
    }[row.status];

    excelRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.alignment = { wrapText: true, vertical: 'top' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
  });

  // Summary row
  const summary = report.summary;
  sheet.addRow({});
  sheet.addRow({
    clause: `Total clauses reviewed: ${summary.total}`,
    requirement: `Comply: ${summary.comply}`,
    productResponse: `Not Comply: ${summary.notComply}`,
    status: `Noted: ${summary.noted}`,
    remark: `Not Part of Proposal: ${summary.notPartOfProposal}`,
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return await workbook.xlsx.writeBuffer();
}
```

---

## 8. Design System — Awwwards-Level UI

### Design Philosophy

The app should feel like a premium engineering instrument — precise, beautiful, and effortless. Every interaction should have purpose. Animations serve clarity (guiding attention, confirming actions, showing state changes), not decoration. The goal is a tool so polished that using it feels like a competitive advantage.

**Reference inspirations:** Linear (primary — dark theme, app shell, animations, data layout), Vercel Dashboard (developer tools), Raycast (productivity). Full dark theme throughout — no light mode.

### Theme & Color System

```css
/* CSS Variables — Tailwind CSS v4 */
:root {
  /* Brand — inspired by Linear's purple-blue accent on deep dark */
  --brand-primary: oklch(0.65 0.18 270);      /* Linear-style purple-blue */
  --brand-secondary: oklch(0.72 0.15 250);     /* Lighter blue accent */
  --brand-glow: oklch(0.65 0.18 270 / 0.15);  /* Soft glow for hover states */

  /* Compliance Status Colors (designed for dark backgrounds) */
  --status-comply: oklch(0.72 0.19 155);       /* Vibrant green — pops on dark */
  --status-not-comply: oklch(0.68 0.22 25);    /* Bright red — high contrast on dark */
  --status-noted: oklch(0.78 0.16 85);         /* Warm amber */
  --status-not-part: oklch(0.55 0.02 260);     /* Muted grey */

  /* Surfaces — Full Dark Theme (Linear-inspired) */
  --surface-0: oklch(0.13 0.005 260);          /* Page background — near-black, not pure black */
  --surface-1: oklch(0.17 0.008 260);          /* Card/panel background */
  --surface-2: oklch(0.21 0.01 260);           /* Elevated cards, hover states */
  --surface-3: oklch(0.25 0.012 260);          /* Active/selected states */
  --surface-glass: oklch(0.17 0.008 260 / 0.8); /* Glassmorphism overlay with backdrop-blur */

  /* Text — high contrast for dark backgrounds */
  --text-primary: oklch(0.93 0.005 260);       /* Near-white, slightly warm */
  --text-secondary: oklch(0.65 0.01 260);      /* Medium grey */
  --text-muted: oklch(0.45 0.01 260);          /* Subtle grey for metadata */

  /* Borders — subtle on dark */
  --border-subtle: oklch(0.22 0.005 260);      /* Barely visible dividers */
  --border-default: oklch(0.28 0.008 260);     /* Standard borders */
  --border-active: oklch(0.35 0.01 260);       /* Focused/active borders */

  /* Shadows & Glows — glow effects replace drop shadows on dark */
  --shadow-sm: 0 1px 3px oklch(0 0 0 / 0.3);
  --shadow-md: 0 4px 16px oklch(0 0 0 / 0.4);
  --shadow-lg: 0 12px 48px oklch(0 0 0 / 0.5);
  --shadow-glow: 0 0 30px var(--brand-glow);
  --shadow-status-comply: 0 0 12px oklch(0.72 0.19 155 / 0.2);   /* Green glow */
  --shadow-status-not-comply: 0 0 12px oklch(0.68 0.22 25 / 0.2); /* Red glow */
}
```

### Typography

```css
/* Font Stack — Geist (by Vercel) for that premium SaaS feel */
--font-sans: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs: 0.75rem;     /* 12px — metadata, timestamps */
--text-sm: 0.875rem;    /* 14px — secondary text, table cells */
--text-base: 1rem;      /* 16px — body text */
--text-lg: 1.125rem;    /* 18px — section headers */
--text-xl: 1.25rem;     /* 20px — page subtitles */
--text-2xl: 1.5rem;     /* 24px — page titles */
--text-3xl: 2rem;        /* 32px — dashboard hero numbers */
--text-4xl: 2.5rem;     /* 40px — login/onboarding hero */

/* Tracking */
--tracking-tight: -0.02em;   /* Headlines */
--tracking-normal: -0.01em;  /* Body */
```

### Animation System

#### Global Smooth Scrolling (Lenis)
```typescript
// Initialize in root layout — every scroll feels buttery
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});
```

#### Page Transitions (Framer Motion + next-transition-router)
```typescript
// Every route change has a smooth crossfade with slight vertical shift
const pageVariants = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -4, filter: 'blur(2px)', transition: { duration: 0.2 } },
};
```

#### Component Entrance Animations
```typescript
// Staggered list items (project cards, table rows, chat messages)
const containerVariants = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};
```

#### Micro-Interactions Catalog

| Element | Animation | Timing |
|---------|-----------|--------|
| **Buttons** | Scale to 0.97 on press, spring back on release; subtle glow on hover | 150ms spring |
| **Cards** | Lift with shadow increase on hover; border glow with brand color | 200ms ease-out |
| **Status badges** | Pulse once on status change (green flash for Comply, red for Not Comply) | 400ms |
| **Table rows** | Slide in from left with stagger; row hover with surface-2 glow + subtle left border accent matching status color | 50ms stagger, 200ms hover |
| **Table status cells** | Status pill with soft glow matching status color (green glow for Comply, red glow for Not Comply) — pops on dark background | 300ms on status change |
| **Chat messages** | Fade in + slide up; typing indicator with animated dots | 300ms spring |
| **Sidebar nav** | Active item has animated gradient underline; smooth collapse/expand | 250ms spring |
| **Dropzone** | Border dashes animate on drag-over; scale up slightly; pulsing glow | 200ms |
| **Progress bars** | Smooth width transition with gradient shimmer effect | 500ms ease-in-out |
| **Modals/Dialogs** | Scale from 0.95 + fade in with backdrop blur | 200ms spring |
| **Toast notifications** | Slide in from top-right with spring physics; auto-dismiss with shrinking progress bar | 300ms spring |
| **Number counters** | Animated count-up on dashboard stats (compliance %, report count) | 800ms ease-out |
| **Tab switches** | Animated indicator bar slides to active tab | 200ms spring |
| **Skeleton loaders** | Shimmer effect with gradient sweep (not just opacity pulse) | Continuous, 1.5s cycle |

#### GSAP ScrollTrigger (Dashboard)
```typescript
// Dashboard stat cards animate in on scroll with staggered timeline
gsap.timeline({ scrollTrigger: { trigger: '.stats-grid', start: 'top 80%' }})
  .from('.stat-card', { y: 40, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out' })
  .from('.stat-value', { textContent: 0, duration: 1, snap: { textContent: 1 }, ease: 'power2.out' }, '-=0.3');
```

### Layout Structure

```
app/(auth)/layout.tsx                    ← Dark theme, centered, minimal
app/(dashboard)/layout.tsx               ← Light theme, sidebar + main
├── AnimatedSidebar (collapsible, 240px → 64px)
│   ├── Logo (animated on hover — subtle rotate/glow)
│   ├── NavLinks (animated active indicator)
│   ├── ProjectQuickSwitch (command palette style)
│   └── UserMenu (avatar + dropdown)
├── TopBar (breadcrumbs + search + notifications)
└── MainContent (AnimatePresence for page transitions)
    └── {children}
```

### Page Components (Detailed)

#### Login Page — Cinematic Entry
```
LoginPage (same dark base as entire app, with subtle aurora gradient animation)
├── BackgroundAurora (animated gradient mesh — GSAP or CSS)
├── LoginCard (glassmorphism, centered, subtle float animation)
│   ├── Logo (large, with glow effect)
│   ├── Title ("Welcome to CMS Compliance Hub")
│   ├── EmailInput (with floating label animation)
│   ├── PasswordInput (with floating label animation)
│   ├── LoginButton (gradient, magnetic hover effect, loading spinner)
│   └── RegisterLink
└── FooterText ("Century Mechanical Systems Factory LLC")
```

#### Dashboard — Bento Grid Layout
```
DashboardPage
├── WelcomeHeader ("Good morning, Riyaz" + animated wave emoji)
├── StatsRow (animated counters — Framer Motion)
│   ├── TotalProjects (number counter animation)
│   ├── ComplianceRate (circular progress ring, animated)
│   ├── ReportsThisMonth (number counter)
│   └── PendingReviews (number counter with pulse if > 0)
├── BentoGrid
│   ├── ProjectCards[] (hover: lift + shadow + border glow)
│   │   ├── ProjectName + Client
│   │   ├── MiniComplianceChart (tiny donut chart, animated on visible)
│   │   ├── ReportCount badge
│   │   └── LastUpdated timestamp
│   ├── RecentActivityFeed (staggered entrance)
│   └── QuickActions ("New Project", "Upload Spec" — magnetic buttons)
└── FloatingActionButton ("+" → New Project, with spring animation)
```

#### Report View — The Hero Page
```
ReportViewPage
├── ReportHeader
│   ├── Breadcrumbs (animated trail)
│   ├── Title + StatusBadge (animated status change)
│   ├── ActionButtons (Export, Approve — with loading states)
│   └── ComplianceSummaryChips (animated count-up, color-coded)
├── ResizableSplitLayout (drag handle with snap points)
│   ├── LeftPanel — Compliance Table
│   │   ├── FilterPills (animated toggle, active state glow)
│   │   ├── ComplianceTable
│   │   │   ├── HeaderRow (sticky, frosted glass with backdrop-blur on dark surface)
│   │   │   ├── DataRows[] (staggered entrance, row hover highlight)
│   │   │   │   ├── ClauseCell
│   │   │   │   ├── RequirementCell (expandable on click)
│   │   │   │   ├── ProductResponseCell (editable, click to expand)
│   │   │   │   ├── StatusCell (color-coded pill, click to change)
│   │   │   │   └── RemarkCell (editable)
│   │   │   └── SummaryRow (totals with animated counters)
│   │   └── TableFooter (pagination or virtual scroll)
│   └── RightPanel — Chat (collapsible with smooth animation)
│       ├── ChatHeader ("Re-verify with Claude" + collapse toggle)
│       ├── SelectedRowContext (shows which row is referenced, animated badge)
│       ├── SuggestedQuestions (animated pills, disappear after first message)
│       ├── ChatMessages[] (staggered entrance, markdown rendered)
│       │   ├── UserMessage (right-aligned, brand color)
│       │   └── AssistantMessage (left-aligned, with typing indicator)
│       ├── UpdateSuggestion (if Claude suggests a row change — animated card with Accept/Reject)
│       └── ChatInput (auto-resize textarea, send button with loading)
└── ReportFooter (metadata: generated at, prompt version, model used)
```

### Component Library

#### From shadcn/ui (customized with animations):
Button, Input, Textarea, Select, Badge, Card, Dialog, Sheet, Table, Tabs, DropdownMenu, Toast, Skeleton, Avatar, Command, Tooltip, Popover, Separator, ScrollArea, ResizablePanelGroup

#### Custom Animated Components:
- `AuroraBackground` — Animated gradient mesh for login/onboarding
- `MagneticButton` — Button that subtly follows cursor on hover
- `AnimatedCounter` — Number count-up with easing
- `ComplianceDonut` — Mini donut chart with animated segments
- `GlowCard` — Card with gradient border glow on hover
- `ShimmerSkeleton` — Skeleton with gradient sweep animation
- `TypewriterText` — Text that types out character by character
- `FloatingLabel` — Input label that animates up on focus
- `StatusPulse` — Pulsing dot indicator for live/active states
- `ResizablePanel` — Drag-to-resize split layout with snap
- `StreamingText` — Text that renders word-by-word (for Claude responses)
- `ProgressRing` — Circular progress with animated stroke
- `CommandPalette` — Cmd+K search overlay with fuzzy matching

---

## 9. Key API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/[id]` | Get project with reports |
| PATCH | `/api/projects/[id]` | Update project metadata |
| DELETE | `/api/projects/[id]` | Delete project (cascade) |
| POST | `/api/documents/upload` | Upload spec file to Supabase Storage |
| POST | `/api/documents/parse` | Parse uploaded file, extract text + sections |
| POST | `/api/compliance/generate` | Generate compliance report (Claude API) |
| GET | `/api/compliance/[reportId]` | Get report with all rows |
| PATCH | `/api/compliance/[reportId]/rows/[rowId]` | Update individual row (user edit) |
| POST | `/api/compliance/[reportId]/chat` | Chat with Claude about report (streaming) |
| GET | `/api/compliance/[reportId]/export` | Download .xlsx file |
| GET | `/api/admin/products` | List product data entries |
| PUT | `/api/admin/products/[family]` | Update product data |
| GET | `/api/admin/rules` | Get current rules |
| PUT | `/api/admin/rules` | Update rules |

---

## 10. Security & Access Control

### Authentication Flow
1. User navigates to app → redirected to `/login` if not authenticated
2. Login with email + password via Supabase Auth
3. Session managed via Supabase Auth cookies (httpOnly, secure)
4. Middleware checks session on all `(dashboard)` routes

### Authorization
- All data is user-scoped via RLS (users only see their own projects)
- Admin role required for `/settings/products` and `/settings/rules`
- API routes validate session before processing

### API Key Security
- Anthropic API key stored as Vercel environment variable
- Never exposed to client — all Claude calls happen server-side
- Supabase service role key used server-side only

---

## 11. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=https://compliance.cmsglobal.com
```

---

## 12. Vercel Configuration

### `vercel.json`
```json
{
  "functions": {
    "app/api/compliance/generate/route.ts": {
      "maxDuration": 120
    },
    "app/api/compliance/*/chat/route.ts": {
      "maxDuration": 60
    },
    "app/api/documents/parse/route.ts": {
      "maxDuration": 30
    }
  }
}
```

### Recommended Vercel Plan
**Pro plan** — needed for:
- Serverless function timeout up to 300s (compliance generation can be slow for large specs)
- Higher bandwidth for file uploads
- Edge middleware for auth checks

---

## 13. Prompt Versioning Strategy

Since Claude is the engine, the prompt is the most critical piece of code. Every change to the prompt can affect output quality.

### How It Works
1. Product data, rules, and examples are stored in the database with version numbers
2. Each compliance report records which version of each component generated it
3. When product data or rules change, the version increments
4. Old reports are never retroactively changed — they preserve historical accuracy
5. Users can optionally "re-generate" a report with the latest prompt version and compare

### Version Tracking
```typescript
interface PromptVersion {
  productDataVersion: number;
  rulesVersion: number;
  examplesVersion: number;
  systemPromptHash: string;  // hash of the assembled prompt
}
```

---

## 14. Phase 1 MVP — Detailed Task Breakdown

### Sprint 1: Foundation (Week 1-2)
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure Tailwind CSS + shadcn/ui
- [ ] Set up Supabase project (database + auth + storage)
- [ ] Create Prisma schema and run migrations
- [ ] Implement Supabase Auth (register, login, logout)
- [ ] Build auth middleware for protected routes
- [ ] Create dashboard layout (sidebar + top nav)
- [ ] Deploy to Vercel with environment variables

### Sprint 2: Projects & Upload (Week 3-4)
- [ ] Build project CRUD (create, list, detail, edit, delete)
- [ ] Build dashboard page with project cards
- [ ] Implement file upload to Supabase Storage
- [ ] Build document parsing pipeline (PDF, DOCX, XLSX, text)
- [ ] Build section detection logic
- [ ] Create upload page with drag-and-drop + text paste
- [ ] Build section preview and mapping UI

### Sprint 3: Compliance Engine (Week 5-6)
- [ ] Seed product data, rules, and examples into database
- [ ] Build system prompt assembly function
- [ ] Implement Claude API compliance generation endpoint
- [ ] Build compliance report creation flow (generate → store rows)
- [ ] Handle streaming progress updates during generation
- [ ] Build interactive compliance table component
- [ ] Implement row-level inline editing
- [ ] Add status filtering and summary bar

### Sprint 4: Chat & Export (Week 7-8)
- [ ] Build chat panel component with streaming responses
- [ ] Implement chat API endpoint with report context
- [ ] Handle row update suggestions from chat (parse [UPDATE_ROW] tags)
- [ ] Build Excel export with ExcelJS (color-coded, formatted)
- [ ] Add report status workflow (generating → review → approved → exported)
- [ ] Polish UI, error handling, loading states
- [ ] Testing and bug fixes
- [ ] Initial production deployment

### Phase 1 Deliverable
A working internal app where the CMS team can:
1. Log in with email/password
2. Create and manage projects
3. Upload specs (PDF/DOCX/XLSX/text) and auto-detect HVAC sections
4. Generate compliance tables via Claude
5. Review and edit tables interactively
6. Chat with Claude to re-verify specific rows
7. Export final tables as formatted .xlsx files

---

## 15. Phase 2 Features (Post-MVP)

- Product data admin UI (edit Excelair specs through the web)
- Rules admin UI (edit compliance rules without code changes)
- Project sharing between team members
- Report versioning and comparison (re-run and diff)
- Batch processing (multiple specs at once)
- Dashboard analytics (compliance trends, common non-compliance areas)

---

## 16. Phase 3 Features (Future)

- Smart clause memory (learn from corrections)
- Compliance templates for common spec patterns
- PDF annotation overlay (highlight clauses in original PDF)
- Multi-language support (Arabic specs)
- Webhook notifications (report ready)
- Mobile-responsive design optimizations

---

## 17. Reference Site Analysis — Gulf O Flex Assist

**URL:** https://gulfoflexassist.com/  
**What it is:** A public-facing MEP platform by Rubber World Industry (Gulf O Flex insulation). Offers AI compliance generation, thickness/carbon calculators, an MEP academy, and an AI chat assistant.  
**Tech stack:** Laravel + PHP + MySQL + OpenAI + Docker

### Design & Layout Observations

**Homepage:** Dark theme (charcoal/navy background), orange primary accent color. Hero section with a typing animation cycling through tool names, a PDF upload dropzone, and animated stat cards (accuracy rate, speed per page). Right side shows a mockup image and a terminal-style "AI processing" animation with fake CPU/memory stats. Below: module cards, CTA section, tech stack logos, footer.

**Compliance page (/compliance/review):** Switches to a light theme. Header shows "My Compliance Statements" with a session expiry timer (guest users get ~48 hours). Below: a "Previous Reports" list (empty state for guests) and an "Upload Document" card. A purple banner promotes premium features (permanent storage, analytics, project management) behind login.

**AI Chat page (/chat-ai):** Left sidebar with "New Conversation" button and recent conversation history. Main area shows the AI assistant intro with 4 quick-action cards (Thickness Calculator, Compliance Reports, Product Selection, Installation Guide). Chat input at the bottom with attachment support.

**Calculator page (/calculators):** Light theme, form-based with color-coded input cards (green for confirmed, yellow for pending, pink for required fields). Clean accordion-style layout.

### What to Adopt for CMS Compliance Hub

- **AI Chat layout pattern** — Left sidebar for conversation history + main chat area with quick-start action cards. Adapt this for our report-level chat panel with suggested questions ("Show all non-compliant rows", "Explain PRD specs", "Can we upgrade the frame thickness?")
- **Stats/metrics cards** — Use on the project dashboard for compliance rates, reports generated, processing time
- **Light theme for data-heavy pages** — Reading color-coded compliance tables on dark backgrounds strains the eyes. Use a clean light theme for the main working interface
- **Session-based access pattern** — Their guest session timer is smart UX for public tools. Not needed for our internal app, but the concept of "session context" applies to our chat

### What to Do Differently / Better

- **Project hierarchy** — Gulf O Flex has a flat report list. CMS Compliance Hub organizes reports under projects with metadata (client, location, project number). This is a major UX advantage for teams managing multiple tenders
- **Integrated chat + table** — Gulf O Flex separates chat and compliance into different modules. Our split-panel design (table on left, chat on right, click a row to ask about it) is a significant differentiator
- **Precision over breadth** — Gulf O Flex accepts any MEP PDF for generic compliance analysis. CMS Compliance Hub is laser-focused on Excelair products with 23 strict rules and verified examples. Depth beats breadth for an internal tool
- **No marketing fluff in the app** — Their terminal animation and fake CPU stats are marketing theater. Our internal app should dedicate every pixel to the workflow — upload, generate, review, chat, export
- **Dark theme only for login/onboarding** — Use dark theme for the login screen and onboarding flow (modern, premium feel), then switch to light theme for the working app. Or offer a toggle

### Design Direction Summary

| Aspect | Direction |
|--------|-----------|
| Primary theme | Full dark theme everywhere — Linear-inspired, near-black not pure black |
| Brand color | Purple-blue accent (Linear-style) — deliberately avoiding orange (too similar to Gulf O Flex) |
| Typography | Geist (by Vercel) — premium SaaS feel with tight tracking; Geist Mono for code/data |
| Layout | Collapsible animated sidebar (240px → 64px) + main content with page transitions |
| Data tables | Staggered row entrance, frosted glass sticky header, row hover glow, inline editing |
| Chat panel | Resizable split panel integrated with table — click a row to reference it in chat |
| Cards | Glow border on hover, lift shadow, animated counters, mini donut charts |
| Animations | Framer Motion (primary) + GSAP (scroll/timeline) + Lenis (smooth scroll) |
| Loading states | Shimmer skeletons with gradient sweep, not opacity pulse |
| Overall feel | Linear-inspired — dark, fast, precise engineering tool with Awwwards-level polish |

---

## 18. Risk & Considerations (Updated)

| Risk | Mitigation |
|------|------------|
| Claude API latency for large specs | Stream responses, show progress, process sections in parallel |
| Claude output inconsistency | Temperature 0 + structured JSON + post-processing validation + result caching |
| Opus cost higher than Sonnet | ~$0.18/report vs ~$0.02 — justified by accuracy requirements; Sonnet tested and rejected |
| Vercel serverless timeout | Pro plan (300s), break large specs into section-level calls |
| PDF parsing quality varies | Offer text paste as fallback, consider Claude's native PDF input for complex layouts |
| Product data becomes stale | Phase 2 admin UI, plus version tracking so old reports stay accurate |
| Cost of Claude API calls | Monitor token usage per report, cache system prompts, use sonnet (not opus) for generation |

---

## 19. Estimated Costs (Monthly)

| Service | Plan | Estimated Cost |
|---------|------|----------------|
| Vercel | Pro | $20/month |
| Supabase | Pro | $25/month |
| Anthropic API (Opus) — Compliance generation | Pay-per-use | ~$18/month (100 reports) |
| Anthropic API (Opus) — Chat re-verification | Pay-per-use | ~$10-30/month (depends on chat volume) |
| Domain | Annual | ~$12/year |
| **Total** | | **~$75-100/month** |

### API Cost Breakdown (Opus)

**Compliance generation:** ~8,000 input tokens (system prompt with rules + products + examples + spec text) + ~4,000 output tokens per report.
- Opus pricing: $15/M input, $75/M output
- Per report: (8,000 × $15/1M) + (4,000 × $75/1M) = $0.12 + $0.30 = **~$0.42/report**
- At 100 reports/month: **~$42/month**

**Chat re-verification:** ~10,000 input tokens (report context + conversation history) + ~500 output tokens per message.
- Per message: (10,000 × $15/1M) + (500 × $75/1M) = $0.15 + $0.04 = **~$0.19/message**
- At 200 messages/month: **~$38/month**

**Total API estimate: ~$80/month** at moderate usage (100 reports + 200 chat messages).

**Cost optimization levers:**
- Cache system prompts using Anthropic's prompt caching (reduces input token cost by up to 90% on repeated calls)
- Result caching — same spec doesn't regenerate, saving the full API cost
- Chat context pruning — summarize older messages instead of sending full history
