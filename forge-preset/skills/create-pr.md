# Create Pull Request

Create a GitHub pull request for Chore Champions.

## Context

- **Plan file**: `{{PLAN_FILE}}`
- **Session dir**: `{{SESSION_DIR}}`
- **Base ref**: `{{BASE_REF}}`

## Instructions

1. Read the plan file to understand what was implemented.
2. Read `{{SESSION_DIR}}/pipeline-report.md` for step results (if it exists).
3. Stage and commit all changes (if not already committed).
   - Use conventional commit messages.
   - End commit message with: `Co-Authored-By: Claude <noreply@anthropic.com>`
4. Push the branch to the remote.
5. Create a PR using `gh pr create` with:
   - A concise title (under 70 chars) summarizing the change
   - Body format:

```markdown
## Summary
<2-3 bullet points describing what changed>

## Test plan
- [ ] Unit tests pass (`npm test`)
- [ ] DB integration tests pass (`npm run test:db`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Smoke tests pass (`npm run pw:smoke`)
- [ ] Visual tests pass (`npm run pw:visual`)

Closes #<issue_number>
```

6. If the plan references an issue number, include `Closes #N` in the PR body.

## Output

Write the PR URL to `{{SESSION_DIR}}/pr-url.txt`.

After creating the PR: `forge execute pass create_pr`
If the PR cannot be created: `forge execute fail create_pr "reason"`
