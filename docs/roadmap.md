# MVP Feature Roadmap

This document defines the recommended implementation order for MVP features, organized by dependency wave. All features shown are marked `[MVP]` in their respective epic docs.

---

## Wave 1: Foundation (Blocking Everything)

| Feature | Epic | Status | Notes |
|---------|------|--------|-------|
| **F1-6** Workspace settings | E1 | Done | Defines `reporting_currency` and `max_account_depth` settings. Required by F2-9 and future features. |

---

## Wave 2: Core Data Features (Parallel Tracks)

Start these three in parallel once F1-6 is complete. All depend only on F1-6.

| Priority | Feature | Epic | Status | Notes |
|----------|---------|------|--------|-------|
| **1** | **F2-1** Property CRUD | E2 | Done | Highest priority — unblocks F3-1 (Transaction CRUD). |
| **2** | **F2-4** Account CRUD | E2 | Done | Unblocks account management UI. F2-3 (Account schema) is complete. |
| **3** | **F2-9** Currency rate management | E2 | Done | Required by F3-1 for multi-currency transactions. Can be parallel to F2-1. |

---

## Wave 3: UI and Hierarchy Management

Start these after their dependencies complete.

| Feature | Epic | Depends On | Status | Notes |
|---------|------|-----------|--------|-------|
| **F2-2** Property list UI | E2 | F2-1 | Planned | Frontend view for properties; ready after F2-1 ships. |
| **F2-6** Account hierarchy management UI | E2 | F2-4 | Planned | Tree view for account structure; ready after F2-4 ships. |
| **F2-7** Account linked-items view | E2 | F2-4, F2-6 | Planned | Shows transactions and properties linked to an account; needs both F2-4 and F2-6. |

---

## Wave 4: Core Transaction Feature

| Feature | Epic | Depends On | Status | Notes |
|---------|------|-----------|--------|-------|
| **F3-1** Transaction CRUD API | E3 | F2-1, F2-9 | Done | ⭐ Core user feature. Backend REST API for creating, reading, updating transactions. |

---

## Wave 5: Transaction Supporting Features

Start these after F3-1 ships. Can be done in parallel.

| Feature | Epic | Depends On | Status | Notes |
|---------|------|-----------|--------|-------|
| **F3-2** Transaction list UI | E3 | F3-1 | Done | Frontend view with filtering, sorting, bulk select. |
| **F3-3** Category validation | E3 | F3-1 | Done | Backend validation for category taxonomy (income, expense, etc.). |
| **F5-3** Auto-categorisation rules backend | E5 | F3-1 | Done | Rules API (GET/POST/PATCH/DELETE /api/rules); client-side matching already implemented. |
| **F3-6** Reconciliation marking | E3 | F3-1 | Planned | Mark transactions as verified against bank statements. |
| **F1-9a** Transaction category management | E1 | F1-6, F3-3 | Planned | Workspace owners can add custom categories. Uses generic `workspace_enum_values` table — forward-compatible with F1-9. F3-3 validation becomes dynamic (queries DB). |

---

## Wave 6: Frontend Architecture (DataTable migrations)

Can be done in parallel with Wave 3. Each migration step is independent once F7-1 is done.

| Feature | Epic | Depends On | Status | Notes |
|---------|------|-----------|--------|-------|
| **F7-1** DataTable component — core build | E7 | — | Done | Reusable table component with sort, filter, pagination, bulk actions, column visibility. |
| **F7-2** Migrate transactions table | E7 | F7-1 | Done | Reference migration. All columns sortable; sort params wired to backend. |
| **F7-3** Migrate rules table | E7 | F7-1 | Done | Simpler: no filter bar, no pagination, no bulk ops. |
| **F7-4** Migrate report tables | E7 | F7-1 | Done | Three read-only tables: category breakdown ×2 and P&L by property. Column visibility enabled. |
| **F7-5** Migrate dashboard mini-table | E7 | F7-1 | Done | Minimum config — no controls. "View all" in DataTable actions. |

---

## Notes

- **Dependency graph**: Each feature lists all blocking dependencies. No feature should be started until its "Depends On" items are complete.
- **Parallel work**: Features in the same wave with no interdependencies (e.g., F2-1, F2-4, F2-9) can be worked on in parallel.
- **Status updates**: As features are completed, mark their status as `Done` and move any newly-unblocked features up in priority.
- **E1 scope**: E1 features (F1-1 through F1-9) are handled separately; this roadmap assumes F1-6 is available or will be completed as a prerequisite.
