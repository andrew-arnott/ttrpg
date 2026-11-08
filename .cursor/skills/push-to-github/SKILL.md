---
name: push-to-github
description: Branch, commit and push the ttrpg repo from a cloud agent using GH_TOKEN, without building on a stale main. Use whenever you need to fetch, push or publish changes to andrew-arnott/ttrpg.
---

# Push to GitHub from a cloud agent

The repo is https://github.com/andrew-arnott/ttrpg (public, so cloning needs no credentials). Pushing uses a token
from the `GH_TOKEN` environment variable. Never print the token or write it into a file or remote URL.

## Clone and branch

```bash
git clone https://github.com/andrew-arnott/ttrpg && cd ttrpg
npm ci
git checkout -b cursor/<short-topic>      # follow any branch naming the session instructions give
```

A cloud agent may start in a different, empty repository that is unrelated to this one. If so, clone this repo
somewhere like `/tmp/ttrpg` and work there, and say so in your summary.

## Fetch, with the token, and check it worked

Local `main` goes stale and a failed `git pull` can pass unnoticed, so always fetch explicitly and read the result:

```bash
AUTH="http.extraheader=Authorization: Basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)"
git -c credential.helper= -c "$AUTH" fetch origin main
git log --oneline origin/main | head -3
```

If you are about to build on `main`, `git reset --hard origin/main` first (only when you have nothing uncommitted).

## Commit

Run the full check first (see `AGENTS.md`). One commit per logical change, with a message that says what changed and
why. Do not amend or force-push unless asked.

## Push

```bash
set -o pipefail
git -c credential.helper= -c "$AUTH" fetch origin main
git merge-base --is-ancestor origin/main HEAD && echo "fast-forward ok"
git -c credential.helper= -c "$AUTH" push origin HEAD:main HEAD:refs/heads/cursor/<short-topic>
```

The owner has allowed pushing straight to `main` for this toy project; each push to `main` deploys the site. The
`merge-base` check makes sure the push is a fast-forward. If `main` has moved, rebase onto it and re-run the checks.
If the owner has asked for pull requests, push only the branch and open a **draft** PR instead, and post its link
whenever you push an update.

## After pushing

Tell the owner what shipped and link the branch or PR. If the deploy workflow matters to the task, check that the
run succeeded rather than assuming it did.
