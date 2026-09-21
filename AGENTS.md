# AGENTS.md

## Stack & Layout
- Single-package Node + TypeScript CLI (`gitlab-tools` / `gtlz` bin, `src/main/index.ts` is `#!/usr/bin/env node` entry, `yargs` + `commandDir`).
- Commands are files in `src/main/infrastructure/cli/`: `clone`, `config`, `log`, `report`, `topics`, `workspace` (aliases `ws`, `w`). Subcommands: `cli/config/` (`create`, `list`, `use`, `edit`, `remove`, `test`), `cli/workspace/` (`fetch`, `merge`, `publish` alias `pub`, `pull`, `status`, `switch`).
- Services in `src/main/services/` (`Cloner`, `Publisher`, `Workspace` / `resolveWorkspaceCopies`, `GitCliHandlers/*`, `ProcessGitRemoteExecutor`); GitLab HTTP client in `src/main/infrastructure/clients/gitlab/Client.ts`; shared utils/DTOs in `src/main/common/`.
- Tests in `src/test/` run via `ts-jest`.
- New `workspace <verb>` commands follow `switch.ts` / `pull.ts` / `fetch.ts`: `argvTo*Options` + `check*Args` + `builder` + `handler` (loop over `resolveWorkspaceCopies`, `✔ <rel>` / `✖ <rel>: <stderr>` per copy, `exitCode = 1` on failures). Git handlers use structured `*Options` + `AbstractGitCliHandlerWithCwd` (exec with `cwd`) + `quoteArg` from `GitSwitchCliHandler`; only `GitCloneCliHandler` still uses legacy raw-flags `AbstractGitCliHandler` with `git -C`.

## Build / Run
- **Rebuild (required after any src change):** `npm run rebuild` (= `rm -Rf ./build/* && tsc && chmod +x ./build/main/index.js && touch .env`). Do not substitute bare `tsc`. On Windows run in Git Bash (plain `cmd` fails on `rm -Rf`).
- **Run locally:** `node . --help`, or `gitlab-tools --help` after `npm run install-globally`. Built output is `build/main/index.js`.
- Env: `GITLAB_HOST` + `GITLAB_TOKEN` (or `--host`/`--token` flags) required except `config`, `log`, and `workspace status|switch` (checked in `src/main/index.ts`). Precedence: repo `.env` overrides `~/.config/gitlab-tools/<profile>.conf` (active profile name from `~/.config/gitlab-tools/profile`). `.env` is gitignored and created empty by `rebuild`.
- Global `--port` defaults to 443 (GitLab API), but `clone` and `workspace publish` override it to 22 (SSH).

## Test / Lint / Coverage
- `npm test` — all tests. Single test: `npx jest src/test/Publisher.test.ts` or `npx jest -t "test name"`.
- `npm run test:watch`, `npm run test:coverage`. Coverage thresholds only on `Publisher.ts`, `GitRemoteCliHandler.ts`, `GitPushAllCliHandler.ts`.
- `src/main/infrastructure/cli/config/test.ts` is a yargs command, not a jest suite (ignored in `jest.config.js`); `ora` is mocked via `src/test/__mocks__/ora.cjs`.
- `WorkspaceMerge.test.ts` has 5 failing tests on a clean tree (pre-existing, verified via `git stash`) — do not chase them.
- `npm run lint` is `eslint ./src/** --fix` — no eslint config file in repo.

## Gotchas
- `publish` lives at `workspace publish` (alias `pub`), not top-level — `readme.md`'s `gitlab-tools publish …` examples are stale. Single non-nested copy → `--root-group` optional (personal projects); multiple/nested copies → required. `--existing` default `replace` (`skip` | `rename` | `replace`).
- `workspace` copy selection: `--repos/-r` on the parent (paths relative to `--dir`), else `--all`/`-a` or `--interactive`/`-i` (mutually exclusive, cannot combine with `--repos`). `--dir`/`-d` defaults to CWD and lives on the parent `workspace` command. Positionals differ per subcommand: `switch [branch]`, `pull [remote] [branch..]`, `fetch [remote] [refspec..]`, `merge <from> [to]`.
- `--all`/`-a` always means copy selection; the git `--all` flag is exposed via separate `--pull-all` / `--fetch-all` options. `--append` (fetch) has no `-a` alias — it is reserved by workspace.
- `clone --existing` is only `skip` | `drop` (fetch/pull were moved to `workspace fetch` / `workspace pull`). `clone --query-path`/`--qp` is regex; escape shell chars `! ( ) ; $` with backslash.
- Logs are JSON lines in `os.tmpdir()` as `gitlab-tools-*.log.json`, not `./out`; the `log` command reads from there.
- Retry is broken for `git clone` when the target dir already exists (second `clone` fails).
- `GITLAB_TOKEN` is masked in display output (first 4 chars + `********`) unless `--unmasked`.
- Do not commit `build/`, `coverage/`, `out/`, `data/`, `.env`, `package-lock.json`, `node_modules` (gitignored).
