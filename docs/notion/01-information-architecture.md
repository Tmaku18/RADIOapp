# Notion Workspace Information Architecture

Single source of truth for product, engineering, ops, and launch for the Radio Streaming Platform.

---

## Top-Level Navigation

Create these top-level pages in Notion. Use them as parent pages for all child content.

| Page | Purpose |
|------|---------|
| **Home / Executive Brief** | What we're building, current status, top risks, next milestones. |
| **Product** | PRDs, user stories, UX flows, roadmap, pricing and subscriptions. |
| **Engineering** | Architecture, data model, API, radio logic spec, testing, releases. |
| **Operations** | Runbooks, incident response, monitoring, customer support, moderation SOPs. |
| **Business & Growth** | Artist acquisition, partnerships, marketing calendar, launch plan. |

---

## Hierarchy (Recommended)

```
Home / Executive Brief
├── Current status
├── Top risks
├── Next milestones
└── Quick links (Product, Engineering, Ops, Business)

Product
├── Roadmap (database)
├── PRDs (database)
├── User Stories / Tasks (database)
├── UX flows
└── Pricing & subscriptions

Engineering
├── System diagram
├── Architecture overview
├── Data model / Schema catalog
├── API contract registry (database)
├── Radio logic spec
├── Radio logic test cases (database)
├── Database migrations (database)
├── Testing & quality
└── Release history

Operations
├── Runbooks
├── Incident response
├── Monitoring & alerts
├── Customer support triage
└── Moderation SOP

Business & Growth
├── Artist onboarding pipeline (database)
├── Stripe & monetization (database)
├── Analytics KPI catalog (database)
├── Content moderation queue (database)
├── Marketing calendar
└── Launch plan
```

---

## Cross-Links

- **Roadmap** items should link to **PRDs** and **User Stories**.
- **Bugs** should link to **API** or **Runbooks** when relevant.
- **Radio Logic Test Cases** link to **Radio logic spec** and **Testing Procedures**.
- **Database Migrations** link to **Schema catalog**.
- **Incident reports** link to **Runbooks** and **Monitoring**.

---

## Usage

1. In Notion, create a new page for each top-level item above.
2. Create subpages or databases under each section as listed in **02-database-definitions.md** and **03-page-templates.md**.
3. Use **04-doc-mapping.md** to copy or link content from this repo into the right Notion pages.
