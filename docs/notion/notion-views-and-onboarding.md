# Notion Views Setup & Onboarding

**Date:** 2026-01-31  
**Purpose:** Step-by-step instructions for App Production / Tasks / Projects views, plus project-category policies and onboarding note.

---

## 1. App Production: “By Project ID” view

**Where:** [App Production](https://www.notion.so/2f87fab26714800c8ea0c658208fd982) (Collab → doc hub)

**Steps:**

1. Open the **App Production** database.
2. Click **+ New** next to the existing view tabs (e.g. “All Docs”, “My Docs”, “By Category”).
3. Choose **Table** (or **Board** if you prefer cards).
4. Name the view **By Project ID**.
5. Click the **⋯** (or **Group**) in the toolbar and choose **Group** → **Project ID**.
6. Optionally: add a **Filter** → **Project ID** → **is empty** to quickly see uncategorized docs (or leave ungrouped “Empty” visible in the grouped view).
7. Save; use this view to see Radio App vs NBA ML docs and any rows missing **Project ID**.

---

## 2. Tasks: “Uncategorized” view

**Where:** [Tasks (private)](https://www.notion.so/2f87fab267148105a36bdd4261b54231)

**Steps:**

1. Open the **Tasks** database (private copy).
2. Click **+ New** to add a new view.
3. Choose **Table**.
4. Name the view **Uncategorized**.
5. Add a **Filter**:
   - **Project** → **is empty**
   - **And** → **Project ID** → **is empty**
6. Optionally sort by **Due** or **Created time**.
7. Use this view to backfill **Project** / **Project ID** on tasks that aren’t linked to a project.

---

## 3. Private Projects: default “By Project ID” view

**Where:** [Projects (private)](https://www.notion.so/2f87fab267148165b7cce3577c158b83)

**Steps:**

1. Open the **Projects** database (private copy).
2. Add a new view: **+ New** → **Table** (or **Board**).
3. Name it **By Project ID**.
4. **Group** by **Project ID** (toolbar → Group → Project ID).
5. Make it the default: drag this tab to the **first** position (leftmost), or in Notion’s database settings set this view as the one that opens by default if your workspace supports it.
6. Use this as the primary view so Radio App and NBA ML projects are clearly separated.

---

## 4. Naming: use “Radio App” and “NBA ML” consistently

- In **Project ID** (and any new project/category fields), use only:
  - **Radio App**
  - **NBA ML**
- Do not use ad-hoc labels like “Radio”, “NBA”, “NBA True Strength” in **Project ID**; keep that property for these two options so filters and views stay consistent.

---

## 5. New tracking databases: add Project ID

When you create a **new** tracking database (e.g. Decisions, PRDs, Runbooks, Changelog):

1. Add a property: **Project ID** (type **Select**).
2. Add options: **Radio App** (e.g. purple), **NBA ML** (e.g. blue).
3. Use the same option names so you can filter/group the same way across databases.

---

## 6. Onboarding note (short)

**New doc (in App Production)** → set **Project ID** (Radio App or NBA ML).  
**New task** → set **Project** (relation) and/or **Project ID**.  
**New goal** → set **Project ID** (and optionally **Projects** relation).

Keep this visible in the [Canonical Workspace Map](https://www.notion.so/2f87fab267148183b606f5fc31fba595) and in any “How we use Notion” or onboarding page.

---

## Quick links

| Item | Link |
|------|------|
| App Production | [Notion](https://www.notion.so/2f87fab26714800c8ea0c658208fd982) |
| Tasks (private) | [Notion](https://www.notion.so/2f87fab267148105a36bdd4261b54231) |
| Projects (private) | [Notion](https://www.notion.so/2f87fab267148165b7cce3577c158b83) |
| Canonical Workspace Map | [Notion](https://www.notion.so/2f87fab267148183b606f5fc31fba595) |
| Project categories review | [notion-workspace-review-project-categories.md](./notion-workspace-review-project-categories.md) |
