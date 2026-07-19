# NetworX Notion OS — Workspace Map

**Created:** 2026-06-24 via Notion MCP  
**Hub:** [NetworX](https://app.notion.com/p/38b7fab2671481aeb2f3faf0cf4a5515)  
**Seeded rows:** ~109 (8 initiatives, 12 decisions, 30 features, 25 timeline, 17 docs, 8 risks, 5 markets, 4 releases)

---

## Hub pages

| Page | URL |
|------|-----|
| **NetworX** (root) | https://app.notion.com/p/38b7fab2671481aeb2f3faf0cf4a5515 |
| Executive Dashboard | https://app.notion.com/p/38b7fab267148123a0adfe5d7d439547 |
| Engineering Dashboard | https://app.notion.com/p/38b7fab2671481b9a62bc934c0ec6156 |
| Executive Brief | https://app.notion.com/p/38b7fab2671481a2a6ccec24ef61bace |
| Monetization & Subscriptions | https://app.notion.com/p/38b7fab2671481dd8b0cfa54565214a1 |
| Product Surfaces | https://app.notion.com/p/38b7fab26714814d9e27eb0f0250d791 |
| How to use this workspace | https://app.notion.com/p/38b7fab26714811a94f4ca9350fe7e42 |
| Archive: RadioApp Notion | https://app.notion.com/p/38b7fab2671481b28a4ecb038a16dfea |

---

## Databases

| Database | URL | Data source ID | Prefix |
|----------|-----|----------------|--------|
| Initiatives | https://app.notion.com/p/6dc55aa9c77d4f9481483236f3ddef25 | `2c1e0a16-9b18-48af-a815-3486b11f8e92` | INI |
| Features | https://app.notion.com/p/d099756664f94faab58224797dbc21b0 | `db93483d-f43e-4264-9ea5-328921fe7127` | FEAT |
| Decisions | https://app.notion.com/p/258f665571a84ccab3361f007e426f9b | `aaa5e114-a076-4e61-9a64-8c79f44d2d25` | DEC |
| Releases | https://app.notion.com/p/ae67f771ac81491d9b41ce66d9909ba5 | `d41ddeeb-fe8a-4323-b42c-5136248f3924` | REL |
| Timeline | https://app.notion.com/p/d21fd12c2d494c4095889fbcc3008728 | `34a11125-4592-4ac0-9215-9653b70311f9` | TL |
| Doc Registry | https://app.notion.com/p/841567f00b964c3fa7598820f2de047e | `53c9afc7-f194-4e15-9816-18a72047c5e9` | DOC |
| Risks | https://app.notion.com/p/d0f95be12b1346a5babf5a1fb93e8f33 | `0bbf9e07-74dd-4847-a1fd-0220fd53d0c4` | RSK |
| Markets and Events | https://app.notion.com/p/3617836b0fce4002ade164cc3e368e03 | `5b176eca-c520-43c8-a73a-8e0b777bf66f` | EVT |

---

## Relations

- **Initiatives** ↔ Features, Decisions, Releases, Timeline, Risks, Markets (dual-sync)
- **Features** ↔ Decisions, Releases, Doc Registry
- **Decisions** ↔ Timeline

**Rollups:** Initiatives `Feature count`, `Release count`  
**Formulas:** Timeline `Quarter`; Releases `Is shipped`; Risks `Risk score`

---

## View types (all 10 used)

| Type | Where |
|------|-------|
| table | All DBs; Executive linked views |
| board | Features, Decisions, Risks; Engineering dashboard |
| list | Timeline, Doc Registry |
| calendar | Releases, Markets and Events |
| timeline | Initiatives, Timeline |
| gallery | Releases (shipped) |
| form | Decisions (Submit decision) |
| chart | Decisions (By domain donut) |
| map | Markets and Events (Launch map) |
| dashboard | Initiatives (KPI overview) |

See [networx-notion-views.md](./networx-notion-views.md) for DSL details.

---

## Linked dashboard views

**Executive Dashboard** — Accepted decisions, Upcoming releases, Open risks, Recent milestones  
**Engineering Dashboard** — Features board, Doc registry, Release calendar

---

## Onboarding

1. **New decision?** Use Decisions → Submit decision form, or duplicate exemplar **Hard live sync**.
2. **New release?** Add Releases row; link Initiative; set Play status.
3. **New repo doc?** Add Doc Registry row with GitHub path URL.
4. **Templates (UI):** Open exemplar row → **••• → Use as template** for each database.

Recommended exemplars for templates:

- Decisions: [Hard live sync](https://app.notion.com/p/38b7fab2671481af81d9d8c90fd2aea3)
- Releases: [1.0.12](https://app.notion.com/p/38b7fab267148158a152fe8f80398b94)
- Features: [Hard live sync across devices](https://app.notion.com/p/38b7fab2671481a3af68e7a1f0d8a1d5)

---

## Archive

Legacy RadioApp workspace (Jan 2026): [notion-workspace-created.md](./notion-workspace-created.md)

---

## MCP limitations

- Database templates: create in Notion UI after seeding (see above)
- Synced blocks: create source first, then reference by URL
- Table cell merge: UI only
- Decisions rollup on Features relation: not supported via MCP (skipped)
