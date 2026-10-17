# Automatic releases

This follows the smart speaker plugin's release rules. On pushes to `main`, Release Plugin builds each unreleased non-documentation commit in mainline order. Batch pushes and commits arriving during a build each receive their own package. Markdown-only (`.md` / `.mdx`) or `docs/` commits consume no version and are not backfilled by manual runs; mixed code/documentation commits release normally. Generated version metadata commits do not release again.

Versions use Beijing time and `YYYY.M.D.N`, starting each day at `.0` and increasing beyond the highest existing tag suffix. Three-part `D` and four-part `D.0` compare equally, so migration starts at `.1` if that date already has a three-part tag. Existing tags and Releases remain intact; allocated numbers are never reused. Version inputs cannot overwrite existing packages.

Each source commit runs `npm ci`, build, built-manifest and artifact hash validation, type checking, and all tests in an isolated worktree. Tags and ZIPs are published only after all checks pass. `Source commit`, the package's `plugin.json.releaseSource`, and the tag's parent commit identify the source. Mainline metadata commits synchronize the version, download URL, and package hashes. This plugin has no separate frontend project and does not run the speaker plugin's Vue frontend commands.

If publication succeeds but pushing mainline metadata fails, a rerun recovers the existing package for that source without duplicating publication. Failed quality checks do not skip the source commit. Workflow runs are serialized; manually running Release Plugin resumes the queue.

Migration from the manual workflow starts with the pre-migration HEAD checkpoint `52f75bb20765fcf65e8b594b59bf8001a3f7bfad`. The first new automation commit is the first queued source; older history is not backfilled. Its package still contains all code already present at the checkpoint. This seed is for migration and does not claim that the old SHA was separately released. After the first package, the workflow updates `releaseSource` to the actual published source.

Local verification:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run validate
```

`validate` reads `dist/_build/plugin.json` and checks hashes of the actual entry and static assets, independent of the not-yet-published hashes in the mainline manifest. Release tests use local bare Git remotes and simulated GitHub Releases. They cover batch pushes, arriving commits, date changes, documentation skipping, failure resumption, metadata recovery, migration checkpoints, and tag/source consistency without publishing to real GitHub.
