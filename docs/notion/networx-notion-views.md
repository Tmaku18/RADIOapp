# NetworX Notion — Views Reference

Which view types are used where in the NetworX OS. Configure via Notion MCP `notion-create-view` DSL (see `notion://docs/view-dsl-spec`).

---

## View type matrix

| Type | Database | View name | Configure (DSL) |
|------|----------|-----------|-----------------|
| table | All | All rows | Default |
| table | Features | Active | `FILTER "Status" != "Done"` |
| board | Features | By Status | `GROUP BY "Status"` |
| board | Decisions | By Status | `GROUP BY "Status"` |
| board | Risks | By Status | `GROUP BY "Status"` |
| list | Timeline | Chronological | `SORT BY "Date" DESC` |
| list | Doc Registry | All docs | `SORT BY "Doc title" ASC` |
| calendar | Releases | Release calendar | `CALENDAR BY "Release date"` |
| calendar | Markets and Events | Event calendar | `CALENDAR BY "Date"` |
| timeline | Initiatives | Roadmap | `TIMELINE BY "Start" TO "End"` |
| timeline | Timeline | Milestones | `TIMELINE BY "Date" TO "End date"` |
| gallery | Releases | Shipped | `FILTER "Play status" = "Shipped"` |
| form | Decisions | Submit decision | `FORM OPEN; FORM PERMISSIONS reader` |
| chart | Decisions | By domain | `GROUP BY "Domain"; CHART donut AGGREGATE count` |
| map | Markets and Events | Launch map | `MAP BY "Location"` |
| dashboard | Initiatives | KPI overview | `CHART number AGGREGATE count` |

---

## Linked views on dashboards

### Executive Dashboard (`parent_page_id` + `data_source_id`)

| Linked view | Source DB | Filter |
|-------------|-----------|--------|
| High-impact decisions | Decisions | `FILTER "Business impact" = "High"` (via Initiative rollup where applicable) |
| Upcoming releases | Releases | `FILTER "Play status" = "In review"` |
| Open risks | Risks | `FILTER "Status" != "Closed"` |
| Q2 timeline | Timeline | Date range filter Jun 2026 |

### Engineering Dashboard

| Linked view | Source DB | Configure |
|-------------|-----------|-----------|
| Features by surface | Features | Board `GROUP BY "Status"` |
| Doc registry | Doc Registry | List |
| Recent milestones | Timeline | `SORT BY "Date" DESC` |
| Release calendar | Releases | Calendar |

---

## DSL quick reference

```
FILTER "Status" = "In Progress"
SORT BY "Date" ASC
GROUP BY "Domain"
CALENDAR BY "Release date"
TIMELINE BY "Start" TO "End"
MAP BY "Location"
CHART donut AGGREGATE count
FORM OPEN
SHOW "Name", "Status"
```

Full spec: fetch MCP resource `notion://docs/view-dsl-spec`.
