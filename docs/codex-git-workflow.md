# Project Git workflow

codex-project-git-workflow: initialized

Use `.codex/project-git-workflow.json` with the global project-git-workflow wrappers.
The user authorized committing and pushing all current project changes on 2026-09-07.
Review tracked and untracked changes before staging; keep credentials and generated output ignored.
Validate with `git diff --check`, `npm run build`, `npm test`, and `npm test --prefix api`.
Frontend changes additionally require the browser smoke workflow before release.
Use conventional commit messages and push the current branch with `git push -u origin HEAD`.
Do not force push or perform destructive resets without explicit authorization.
Keep deployment and validation documentation current.
