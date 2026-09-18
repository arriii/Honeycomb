# Mopec-Style Repository Workflow

## Branch flow

```text
feature branch
    ↓
local test
    ↓
push branch
    ↓
pull request
    ↓
review
    ↓
merge into dev
    ↓
integration test
    ↓
merge into main
```

## Example task

Issue:
`Build Personal Honeycomb Profile`

Branch:
`feature/profile`

AI coding prompt:
> Read the repository first. Explain which files control the profile screen and local state. Do not edit anything yet. Then propose the smallest set of changes needed to add separate fields for known allergies, suspected triggers, personal avoids, and tolerated exposures.

After review:
> Implement only the approved changes. Do not modify unrelated files.

## Good habits for Mopec later
- Ask AI to explain the repo before editing.
- Give one bounded task at a time.
- Review the diff.
- Run the code.
- Test normal and failure cases.
- Commit with a clear message.
- Never put secrets or patient data in Git.
