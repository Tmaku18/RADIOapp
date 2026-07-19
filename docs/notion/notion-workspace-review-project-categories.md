# Notion Workspace Review: Project Categories & Organization

**Date:** 2026-01-31  
**Scope:** Ensure everything has a project category and is correctly linked to **Radio App** or **NBA (NBA ML)**; explore additional organizational structure.

---

## Summary

- **Project category** is implemented as **Project ID** (select: **Radio App** | **NBA ML**) across the main tracking and doc databases.
- Radio-related pages in **App Production** that were missing **Project ID** have been set to **Radio App**.
- The **📻 Radio App — Canonical Workspace Map** was updated with a **Project category (required)** section and reminder to set Project ID on new items.

---

## Where Project ID Exists

| Location | Property | Options | Notes |
|----------|----------|---------|--------|
| **Projects** (Collab & Private) | Project ID | Radio App, NBA ML | Every project row should have this set. |
| **Tasks** (Private) | Project ID + Project (relation) | Radio App, NBA ML | Tasks link to Projects; Project ID allows filtering without relation. |
| **Goals** (Private) | Project ID + Projects (relation) | Radio App, NBA ML | Same pattern as Tasks. |
| **📻 App Production** (Collab) | Project ID | Radio App, NBA ML | Every doc row (Radio App, Deliverables Verification, Technical Architecture, etc.) should have this set. |

---

## Updates Applied (via Notion MCP)

The following **App Production** pages were updated to **Project ID = Radio App**:

1. 📻 Radio App (project doc)
2. 📻 Radio App — Canonical Workspace Map
3. 📻 Private — Radio App & Docs
4. Deliverables Verification (Repo vs README)
5. 📻 Technical Architecture (Repo)
6. 📻 Implementation History (Repo Plans)
7. 📻 Home / Executive Brief
8. 📻 Live Chat + Up Next Notifications (Future Implementation)
9. 🗄️ Archive (from Collab duplicates)

**Canonical Workspace Map** content was extended with:

- A **Project category (required)** section stating that every page in App Production and every row in Projects, Tasks, and Goals must have **Project ID** set to **Radio App** or **NBA ML**, and to set it when adding new docs/tasks.

---

## Correct Linking: Radio vs NBA

- **Radio App:** All planning, engineering, and tracking live under **📻 Private — Radio App & Docs** and the **App Production** docs tagged **Radio App**. Canonical tracking: **Projects**, **Tasks**, **Goals** (private copies) with **Project ID = Radio App** where applicable.
- **NBA (NBA ML):** Master hub is **NBA True Strength — Project (Master)**; Productivity Pack project entry is **NBA True Strength (ML)**. Use **Project ID = NBA ML** in Projects/Tasks/Goals and in **App Production** for any NBA-related docs.

Ensure:

- Every **Projects** row has **Project ID** = **Radio App** or **NBA ML**.
- Every **Tasks** row has **Project** (relation) and/or **Project ID** set.
- Every **Goals** row has **Project ID** and optionally **Projects** relation.
- Every **App Production** doc has **Project ID** set so the “By Project” behavior is reliable.

---

## Additional Organizational Structure Recommendations

1. **App Production: “By Project ID” view**  
   Add a table or board view grouped by **Project ID** so you can quickly see Radio vs NBA docs and spot any uncategorized rows.

2. **Tasks: “Uncategorized” filter**  
   Add a saved view that shows tasks where **Project** is empty and **Project ID** is empty, so you can backfill or fix linking.

3. **Projects database: “By Project ID” default**  
   In the private Projects database, consider a default view grouped or filtered by **Project ID** so Radio App and NBA ML are clearly separated.

4. **Naming consistency**  
   Use **“Radio App”** and **“NBA ML”** consistently (already in use). Avoid ad-hoc labels like “Radio” or “NBA” only in new databases.

5. **New databases**  
   When adding new tracking (e.g. Decisions, PRDs, Runbooks), add a **Project ID** (select: Radio App, NBA ML) property so everything stays project-scoped.

6. **Template / onboarding**  
   In the Canonical Workspace Map or a short “How we use Notion” page, document: “New doc in App Production → set Project ID. New task → set Project and/or Project ID. New goal → set Project ID.”

7. **Optional: Area vs Project**  
   If you later split by area (e.g. Product, Engineering, Ops), keep **Project ID** for Radio vs NBA and add a separate **Area** or **Category** property; don’t overload Project ID with both dimensions.

---

## Verification Checklist

- [x] Projects (Collab & Private) have **Project ID** schema (Radio App, NBA ML).
- [x] Tasks (Private) have **Project ID** and **Project** relation.
- [x] Goals (Private) have **Project ID** and **Projects** relation.
- [x] App Production has **Project ID**; key Radio docs set to **Radio App**.
- [x] Canonical Workspace Map updated with project-category reminder.
- [x] **Views & onboarding:** Step-by-step instructions for App Production “By Project ID”, Tasks “Uncategorized”, and Projects “By Project ID” default → see **[notion-views-and-onboarding.md](./notion-views-and-onboarding.md)**.
- [ ] **Do in Notion:** Create the three views using the guide above (views cannot be created via API/MCP).
- [ ] Periodically: Audit Projects/Tasks/Goals/App Production for empty **Project ID** and fix.

---

## References

- **Views & onboarding (step-by-step):** [notion-views-and-onboarding.md](./notion-views-and-onboarding.md)
- **📻 Radio App — Canonical Workspace Map:** [Notion](https://www.notion.so/2f87fab267148183b606f5fc31fba595)
- **📻 Private — Radio App & Docs:** [Notion](https://www.notion.so/2f87fab26714812a9e86c1619708f6c0)
- **Private Projects DB:** [Notion](https://www.notion.so/2f87fab267148165b7cce3577c158b83)
- **Private Tasks DB:** [Notion](https://www.notion.so/2f87fab267148105a36bdd4261b54231)
- **Private Goals DB:** [Notion](https://www.notion.so/2f87fab26714810a9b3ff1be4fc6aec5)
- **App Production (doc hub):** [Notion](https://www.notion.so/2f87fab26714800c8ea0c658208fd982)
