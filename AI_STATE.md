# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: chore
- Epic: E7 Frontend Architecture / Infrastructure
- ID: C-build-arch-1
- Title: Three-environment build architecture
- Short summary: Move dev from Remote SSH to local Mac/Windows. Three envs: local dev (tunnel to homedev DB), test server (homedev:3001), prod (homedev:3000). Scripts, docs, and npm scripts updated. Manual server steps remain.

---

## Previous focus

- Type: bug
- Epic: E5 Integrations
- ID: F5-import-undo-fix
- Title: Undo import — history splits batches by source, modal shows wrong count
- Short summary: Done — GROUP BY import_batch only; MIN(created_by) dropped (UUID type incompatibility). All commits landed.
- State: done

---

## Task breakdown (current focus)

- [x] S1: Create scripts/tunnel.sh, scripts/prod-deploy.sh, update deploy.sh→deploy-test.sh and deploy.ps1→deploy-test.ps1
- [x] S2: Add start:local npm script + concurrently dep; update backend/.env.example
- [x] S3: Update PROJECT_LANDLORDGURU.md and docs/BACKEND-SETUP.md
- [ ] S4: Commit all changes
- [ ] S5: Manual server steps (user performs): rename dir, create DBs, set up PM2, update .env files, pm2 startup, Google OAuth

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12
- Next MVP candidates: F2-6, F2-7, F3-8, F3-12, F3-13, F3-17, F3-18, F4-1+F4-2, F5-7
- Post-MVP backlog added: F3-14 (year multi-select), F3-15 (multi-select filters), F3-16 (filter tooltip), E6 (tags & rules)

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md` (E3)
- `docs/epics/04-reporting-analytics.md` (E4)
- `docs/epics/05-integrations-data-import.md` (E5)
- `docs/epics/06-tags-rules.md` (E6 — new)
- `docs/epics/07-frontend-architecture.md` (E7)

---

## Next step

Commit all changes (S4), then hand off manual server steps checklist to user (S5).

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-03
  - Outcome: 235/235 tests passing.

---

## Files touched this session

- `AI_STATE.md`
- `docs/ai_state_archive.json`
- `deploy.sh` → `deploy-test.sh` (renamed + updated target to landlordguru-test)
- `deploy.ps1` → `deploy-test.ps1` (renamed + updated target to landlordguru-test)
- `scripts/tunnel.sh` (new)
- `scripts/prod-deploy.sh` (new)
- `backend/package.json` (added start:local script + concurrently dev dep)
- `backend/package-lock.json`
- `backend/.env.example` (rewritten for three environments)
- `PROJECT_LANDLORDGURU.md` (rewrote Development and Deployment sections)
- `docs/BACKEND-SETUP.md` (rewrote setup guide for local dev + deployment)

---

## Automation log (latest only)

- 2026-05-03 18:00:00 [build-arch]
  - branch: main
  - last_commit: 2fddd17
  - changed_files: deploy-test.sh, deploy-test.ps1, scripts/tunnel.sh, scripts/prod-deploy.sh, backend/package.json, backend/package-lock.json, backend/.env.example, PROJECT_LANDLORDGURU.md, docs/BACKEND-SETUP.md, AI_STATE.md, docs/ai_state_archive.json
  - git_status: M AI_STATE.md, M PROJECT_LANDLORDGURU.md, M backend/.env.example, M backend/package-lock.json, M backend/package.json, RM deploy.ps1->deploy-test.ps1, RM deploy.sh->deploy-test.sh, M docs/BACKEND-SETUP.md, ?? scripts/prod-deploy.sh, ?? scripts/tunnel.sh

- 2026-05-03 17:33:13 [Stop]
  - branch: main
  - last_commit: 2fddd17 chore: update epic docs and AI state after import-undo bug fix session
  - changed_files: AI_STATE.md,backend/.env.example backend/package.json,backend/package-lock.json deploy-test.ps1,deploy-test.sh docs/ai_state_archive.json,docs/BACKEND-SETUP.md PROJECT_LANDLORDGURU.md
  - git_status:
     M AI_STATE.md
     M PROJECT_LANDLORDGURU.md
     M backend/.env.example
     M backend/package-lock.json
     M backend/package.json
    RM deploy.ps1 -> deploy-test.ps1
    RM deploy.sh -> deploy-test.sh
     M docs/BACKEND-SETUP.md
     M docs/ai_state_archive.json
    ?? .claude/hooks/checkpoint.sh
    ?? scripts/prod-deploy.sh
    ?? scripts/tunnel.sh

- 2026-05-03 17:36:36 [Stop]
  - branch: main
  - last_commit: 2fddd17 chore: update epic docs and AI state after import-undo bug fix session
  - changed_files: AI_STATE.md,backend/.env.example backend/package.json,backend/package-lock.json deploy-test.ps1,deploy-test.sh docs/ai_state_archive.json,docs/BACKEND-SETUP.md PROJECT_LANDLORDGURU.md
  - git_status:
     M AI_STATE.md
     M PROJECT_LANDLORDGURU.md
     M backend/.env.example
     M backend/package-lock.json
     M backend/package.json
    RM deploy.ps1 -> deploy-test.ps1
    RM deploy.sh -> deploy-test.sh
     M docs/BACKEND-SETUP.md
     M docs/ai_state_archive.json
    ?? .claude/hooks/checkpoint.sh
    ?? scripts/prod-deploy.sh
    ?? scripts/tunnel.sh

- 2026-05-03 17:37:07 [Stop]
  - branch: main
  - last_commit: 2fddd17 chore: update epic docs and AI state after import-undo bug fix session
  - changed_files: AI_STATE.md,backend/.env.example backend/package.json,backend/package-lock.json deploy-test.ps1,deploy-test.sh docs/ai_state_archive.json,docs/BACKEND-SETUP.md PROJECT_LANDLORDGURU.md
  - git_status:
     M AI_STATE.md
     M PROJECT_LANDLORDGURU.md
     M backend/.env.example
     M backend/package-lock.json
     M backend/package.json
    RM deploy.ps1 -> deploy-test.ps1
    RM deploy.sh -> deploy-test.sh
     M docs/BACKEND-SETUP.md
     M docs/ai_state_archive.json
    ?? .claude/hooks/checkpoint.sh
    ?? scripts/prod-deploy.sh
    ?? scripts/tunnel.sh

- 2026-05-03 17:38:14 [Stop]
  - branch: main
  - last_commit: 2fddd17 chore: update epic docs and AI state after import-undo bug fix session
  - changed_files: AI_STATE.md,backend/.env.example backend/package.json,backend/package-lock.json deploy-test.ps1,deploy-test.sh docs/ai_state_archive.json,docs/BACKEND-SETUP.md PROJECT_LANDLORDGURU.md
  - git_status:
     M AI_STATE.md
     M PROJECT_LANDLORDGURU.md
     M backend/.env.example
     M backend/package-lock.json
     M backend/package.json
    RM deploy.ps1 -> deploy-test.ps1
    RM deploy.sh -> deploy-test.sh
     M docs/BACKEND-SETUP.md
     M docs/ai_state_archive.json
    ?? .claude/hooks/checkpoint.sh
    ?? scripts/prod-deploy.sh
    ?? scripts/tunnel.sh

- 2026-05-03 17:38:50 [Stop]
  - branch: main
  - last_commit: 2fddd17 chore: update epic docs and AI state after import-undo bug fix session
  - changed_files: AI_STATE.md,backend/.env.example backend/package.json,backend/package-lock.json deploy-test.ps1,deploy-test.sh docs/ai_state_archive.json,docs/BACKEND-SETUP.md PROJECT_LANDLORDGURU.md,scripts/prod-deploy.sh scripts/tunnel.sh
  - git_status:
     M AI_STATE.md
     M PROJECT_LANDLORDGURU.md
     M backend/.env.example
    M  backend/package-lock.json
    M  backend/package.json
    R  deploy.ps1 -> deploy-test.ps1
    R  deploy.sh -> deploy-test.sh
     M docs/BACKEND-SETUP.md
     M docs/ai_state_archive.json
    A  scripts/prod-deploy.sh
    A  scripts/tunnel.sh
    ?? .claude/hooks/checkpoint.sh
