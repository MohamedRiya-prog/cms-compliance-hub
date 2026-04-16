# CMS Compliance Hub

**The fastest way to check if CMS / Excelair products comply with project specifications.**

Upload a spec document, select your product family, and get a full compliance table in minutes — reviewed clause by clause, exportable to Excel, and ready to share with your team.

---

## Getting Started

### 1. Log in
Visit the app and sign in with your CMS email. If you don't have an account, use the Register link on the login page. Contact your admin if you need access.

### 2. Create a Project
Click **New Project** from the dashboard. Fill in the project details:

- **Project Name** — required
- **Client** — the end client or building owner
- **Location** — city / country
- **Contractor / Main Contractor / Consultant** — select from the dropdown (searchable). If a company isn't listed, you can request it to be added.
- **Project Number** — auto-generated in `CMS-2026-001` format, no need to fill this in.

---

## Generating a Compliance Report

### Step 1 — Upload a Spec Document
Inside your project, click **Upload Spec**. You can upload:
- PDF files
- Word documents (`.docx`)

The system will extract the relevant specification text automatically.

### Step 2 — Generate the Report
After uploading, select the **product family** (e.g. BDD, EVFD, FAL) and click **Generate**. The AI engine analyses the specification against CMS product data and produces a compliance table.

> Generation typically takes 30–60 seconds depending on document length.

### Step 3 — Review the Table
Each row in the table represents one specification clause. Each row has:

| Column | Description |
|---|---|
| **Clause** | The spec clause reference |
| **Requirement** | What the spec requires |
| **Product Response** | How the CMS product responds to that requirement |
| **Status** | Comply / Not Comply / Noted / Not Part of Proposal |
| **Remark** | Additional notes |

Click any cell in **Product Response**, **Status**, or **Remark** to edit it directly.

---

## Filtering & Navigation

Use the filter bar above the table to show only:
- **All** — every clause
- **Comply** — clauses the product meets
- **Not Comply** — clauses that need attention
- **Noted** — clauses flagged for review
- **Not Part of Proposal** — out-of-scope items

---

## Re-verifying with AI

Click the **chat icon** (top right of the report) to open the AI assistant panel.

- Click any row in the table to reference it in the chat
- Ask Claude to re-verify the clause, suggest an alternative response, or explain the product data
- If Claude suggests an update to a row, you'll see an **Accept / Dismiss** card — accept it to apply the change instantly

---

## Exporting

When the report is ready, click **Export** to download a formatted `.xlsx` Excel file containing the full compliance table.

> On mobile devices, only the Export button is available. Generating new reports and using the chat panel require a desktop browser.

---

## Managing Projects

From the **Dashboard**, you can see all your active projects with their compliance rate at a glance. Click any project to open it and view its reports and uploaded documents.

---

## Settings

### Profile
Update your display name from **Settings → Profile**.

### Products *(all users — view only for engineers)*
Browse CMS product technical data organised by product family. Admins can edit the data directly in the markdown editor.

---

## For Admins

### Rules
**Settings → Rules** — edit the global compliance rules that are applied to every generated report. Only visible to admins.

### Companies
**Settings → Companies** — manage the list of contractors, main contractors, and consultants used in project dropdowns.

- **Add** companies one at a time using the Add Company button
- **Import** hundreds at a time using a CSV file (use the Download Template button for the correct format)
- **Tag** each company with its role(s) — Contractor, Main Contractor, Consultant. You can click the role badges directly in the table to toggle them on/off
- **Review requests** — when an engineer can't find a company in the dropdown, they can request it. Pending requests appear in the **Requests** tab with Approve / Reject options

### Making Someone an Admin
Run this in your Supabase SQL Editor:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'paste-user-uuid-here';
```
The user's UUID can be found in **Supabase → Authentication → Users**.

---

## Tips

- **Project numbers** are assigned automatically — no need to track them manually
- **Compliance rate** is shown on each project card on the dashboard so you can spot issues at a glance
- **Edited rows** are marked with a small badge so you always know what was changed from the original AI output
- **Low confidence** rows are flagged — these are clauses where the AI was less certain and should be reviewed carefully
- On mobile, you can browse projects and download existing reports from anywhere

---

*CMS Compliance Hub — Century Mechanical Systems Factory LLC — Internal Use Only*
