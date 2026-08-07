# Plan 001: Wire the "View PDF" button in Document Vault

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ca43d9d..HEAD -- frontend/src/components/ProfileHub.tsx`
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

The "View PDF" button in the Profile Hub's Document Vault currently has no click handler. As a result, users cannot view or download the resumes and cover letters that the Ghost Worker generates for them. Fixing this restores access to a core product feature.

## Current state

- `frontend/src/components/ProfileHub.tsx` — Profile and memory hub UI; contains the dead button (lines 298-300).

Excerpt from `frontend/src/components/ProfileHub.tsx`:
```tsx
                      <td className="px-6 py-4 text-right">
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-[#0A0A0A] hover:bg-gray-100 rounded-sm text-xs font-medium transition-colors">
                          <Download size={12} /> View PDF
                        </button>
                      </td>
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build | `cd frontend && npm run build` | exit 0, no typescript errors |

## Scope

**In scope**:
- `frontend/src/components/ProfileHub.tsx`

**Out of scope**:
- Any backend storage logic or API changes. 
- Modifying other tabs in the Profile Hub.

## Git workflow

- Branch: `advisor/001-fix-view-pdf-button`
- Commit message: `fix: wire View PDF button in Document Vault to open file_path url`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace button with anchor tag

In `frontend/src/components/ProfileHub.tsx`, change the `<button>` for "View PDF" to an `<a>` tag that links to `doc.file_path` and opens in a new tab.

```tsx
                        <a 
                          href={doc.file_path} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-[#0A0A0A] hover:bg-gray-100 rounded-sm text-xs font-medium transition-colors"
                        >
                          <Download size={12} /> View PDF
                        </a>
```

**Verify**: `cd frontend && npm run build` → exits 0 without type errors.

## Test plan

- Manual Verification: Go to the Dashboard, navigate to the Profile Hub -> Document Vault, and click the "View PDF" button. It should open the PDF link in a new browser tab.
- Verification: `cd frontend && npm run build` → ensures no TS or build errors were introduced.

## Done criteria

- [ ] `cd frontend && npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- `doc.file_path` type causes a typescript error.
- You discover the assumption that `doc.file_path` contains a valid URL is false (though per our DB schema, it should be a public URL).

## Maintenance notes

- If we switch to private S3/Supabase storage buckets in the future, this anchor link will need to be replaced with a function that fetches a signed URL before redirecting.
