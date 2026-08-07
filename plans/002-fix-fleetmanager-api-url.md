# Plan 002: Remove hardcoded localhost API URL in FleetManager

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ca43d9d..HEAD -- frontend/src/components/admin/FleetManager.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ca43d9d`, 2026-08-07

## Why this matters

The `FleetManager` component hardcodes `http://localhost:3001` for its API requests, which breaks the admin dashboard in any hosted or production environment where the backend is not running on localhost. Moving to the `VITE_API_BASE_URL` environment variable enables deployment.

## Current state

- `frontend/src/components/admin/FleetManager.tsx` — The admin dashboard for managing the Apify fleet. It currently makes explicit `fetch('http://localhost:3001/api/...')` calls.

Excerpt from `frontend/src/components/admin/FleetManager.tsx`:
```tsx
      const res = await fetch('http://localhost:3001/api/admin/fleet', {
...
    const eventSource = new EventSource('http://localhost:3001/api/admin/fleet-logs-stream')
...
      await fetch(`http://localhost:3001/api/admin/fleet/${id}`, {
...
      const res = await fetch('http://localhost:3001/api/admin/trigger-harvester', {
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build | `cd frontend && npm run build` | exit 0, no typescript errors |

## Scope

**In scope**:
- `frontend/src/components/admin/FleetManager.tsx`

**Out of scope**:
- Other components (they already use `API_BASE_URL`).
- Backend API routes.

## Git workflow

- Branch: `advisor/002-fix-fleetmanager-api-url`
- Commit message: `fix: use VITE_API_BASE_URL instead of hardcoded localhost in FleetManager`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Define API_BASE_URL

At the top of `frontend/src/components/admin/FleetManager.tsx` (right after imports), define the `API_BASE_URL` constant.

```tsx
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
```

### Step 2: Replace hardcoded strings

In `frontend/src/components/admin/FleetManager.tsx`, replace all instances of `http://localhost:3001` with `${API_BASE_URL}`. Be sure to use template literals where needed.

For example:
```tsx
const res = await fetch(`${API_BASE_URL}/api/admin/fleet`, {
```
And:
```tsx
const eventSource = new EventSource(`${API_BASE_URL}/api/admin/fleet-logs-stream`)
```

**Verify**: `cd frontend && npm run build` → exits 0 without type errors.

## Test plan

- Verification: `cd frontend && npm run build` → ensures no TS or build errors were introduced.

## Done criteria

- [ ] `cd frontend && npm run build` exits 0
- [ ] `grep -rn "http://localhost:3001" frontend/src/components/admin/FleetManager.tsx` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- You encounter syntax errors resolving the template literals.

## Maintenance notes

- Any future admin components created in `frontend/src/components/admin/` must also utilize `API_BASE_URL` rather than hardcoding.
