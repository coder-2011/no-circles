Linearly sync `master` with `dev` so `master` exactly matches `dev` commits with no merge commit.

Context:
- `master` is the production branch connected to Vercel.
- Goal: append `dev` commits linearly on top of `master` and move `master` to `dev` tip.

Workflow:
1. Confirm current state first:
   - `git branch --show-current`
   - `git status --short`
2. Rebase `dev` onto `master`:
   - `git checkout dev`
   - `git rebase master`
3. If any rebase conflict occurs:
   - Pause immediately.
   - Show conflicted files.
   - Ask for manual resolution before continuing.
4. Fast-forward `master` to `dev`:
   - `git checkout master`
   - `git merge dev --ff-only`
5. Push `master` to remote:
   - `git push origin master --force-with-lease`

Expected shell commands:
```bash
git checkout dev
git rebase master
git checkout master
git merge dev --ff-only
git push origin master --force-with-lease
```

Return:
- Rebase result (success or conflict details)
- Final `master` and `dev` commit SHAs
- Push result/ref update
