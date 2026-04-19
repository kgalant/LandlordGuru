# MVP Feature Roadmap

This document defines the recommended implementation order for MVP features, organized by dependency wave. All features shown are marked `[MVP]` in their respective epic docs.

---

## Wave 1: Foundation (Blocking Everything)

| Feature | Epic | Status | Notes |
|---------|------|--------|-------|
| **F1-6** Workspace settings | E1 | Planned | Required by F2-1, F2-3, F2-9. Defines `reporting_currency` and `max_account_depth` settings. |

---

## Wave 2: Core Data Features (Parallel Tracks)

Start these three in parallel once F1-6 is complete. All depend only on F1-6.

| Priority | Feature | Epic | Status | Notes |
|----------|---------|------|--------|-------|
| **1** | **F2-1** Property CRUD | E2 | Done | Highest priority — unblocks F3-1 (Transaction CRUD). |
| **2** | **F2-4** Account CRUD | E2 | Planned | Unblocks account management UI. F2-3 (Account schema) is complete. |
| **3** | **F2-9** Currency rate management | E2 | Planned | Required by F3-1 for multi-currency transactions. Can be parallel to F2-1. |

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
| **F3-1** Transaction CRUD API | E3 | F2-1, F2-9 | Planned | ⭐ Core user feature. Backend REST API for creating, reading, updating transactions. |

---

## Wave 5: Transaction Supporting Features

Start these after F3-1 ships. Can be done in parallel.

| Feature | Epic | Depends On | Status | Notes |
|---------|------|-----------|--------|-------|
| **F3-2** Transaction list UI | E3 | F3-1 | Planned | Frontend view with filtering, sorting, bulk select. |
| **F3-3** Category validation | E3 | F3-1 | Planned | Backend validation for category taxonomy (income, expense, etc.). |
| **F3-6** Reconciliation marking | E3 | F3-1 | Planned | Mark transactions as verified against bank statements. |

---

## Notes

- **Dependency graph**: Each feature lists all blocking dependencies. No feature should be started until its "Depends On" items are complete.
- **Parallel work**: Features in the same wave with no interdependencies (e.g., F2-1, F2-4, F2-9) can be worked on in parallel.
- **Status updates**: As features are completed, mark their status as `Done` and move any newly-unblocked features up in priority.
- **E1 scope**: E1 features (F1-1 through F1-9) are handled separately; this roadmap assumes F1-6 is available or will be completed as a prerequisite.
