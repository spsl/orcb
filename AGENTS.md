# Design System

All UI work — layout, color, typography, spacing, component selection, UX behavior — must follow [`docs/STYLEGUIDE.md`](./docs/STYLEGUIDE.md). Use the tokens defined in `src/renderer/src/assets/main.css` (the canonical source) and the shadcn primitives in `src/renderer/src/components/ui/`. Don't invent new color values, font sizes, or shadow tiers when a documented one already covers the role. When STYLEGUIDE.md is silent, follow the resolution order in its final section.

## Electron UI Validation

Always run tests and agent-launched apps in the background with `ORCA_BACKGROUND_LAUNCH=1`.
Never steal monitor focus or reveal test windows: no `show()`, `showInactive()`, `bringToFront()`,
`app.focus()`, or OS activation. Use CDP screenshots of hidden renderers. Keep native-focus and
visible-window tests paused on the user's desktop; run them on an isolated display or CI.
Rebuild modified launch-policy code before running an app; stale build wrappers are not safe.

Use the `$electron` skill and Playwright CDP for rendered Orca UI checks. Do not use computer-use for Orca UI validation.

# Style

## Reuse Before Reimplementing

Before writing new logic at any scale — a function, component, IPC channel, state store, or whole subsystem/flow — check whether an existing implementation already does the job (or nearly does). Extend or generalize it instead of building a parallel version; only write from scratch when nothing fits. Keep the check proportionate: a quick search for trivial code, a real one before building anything substantial.

## Concise/Brief Non-obvious Comments ONLY

- DO NOT: be verbose, explain the obvious, walk through the code ("WHY not HOW")
- BE CONCISE. 1 LINE if possible

## Lint Rules: Do Not Disable Max Lines

NEVER add a `max-lines` disable (`eslint-disable max-lines`, `oxlint-disable max-lines`, or line-specific variants), and never add a per-file `max-lines` bump in `mobile/.oxlintrc.json`.

## File and Module Naming

Never use vague names like `helpers`, `utils`, `common`, `misc`, or `shared-stuff` for files, folders, or modules. They carry zero info and tend to become dumping grounds. Name files after what they _actually_ contain — prefer the concrete domain concept (e.g. `tab-group-state.ts`, `terminal-orphan-cleanup.ts`) over the generic role (`tabs-helpers.ts`, `terminal-utils.ts`). If you find yourself reaching for `helpers`, the file probably has more than one responsibility and should be split, or there's a better name hiding in the code that describes what the functions operate on.

## Type Declarations: Prefer `.ts` Over `.d.ts`

# Verifying Changes

- **Typecheck**: `pnpm tc` (or `tc:node` / `tc:cli` / `tc:web`)
- **Test**: `pnpm test [path/to/file.test.ts]`
- **Lint**: `oxlint`, or `pnpm run check:code-quality:changed` for changed files (full `pnpm lint` is slow); format with `pnpm format`

# Considerations

## Worktree Safety

Always use the primary working directory (the worktree) for all file reads and edits. Never follow absolute paths from subagent results that point to the main repo.

## Cross-Platform Support

Orca targets macOS, Linux, and Windows. Keep all platform-dependent behavior behind runtime checks:

- **Keyboard shortcuts**: Never hardcode `e.metaKey`. Use a platform check (`navigator.userAgent.includes('Mac')`) to pick `metaKey` on Mac and `ctrlKey` on Linux/Windows. Electron menu accelerators should use `CmdOrCtrl`.
- **Shortcut labels in UI**: Display `⌘` / `⇧` on Mac and `Ctrl+` / `Shift+` on other platforms.
- **File paths**: Use `path.join` or Electron/Node path utilities — never assume `/` or `\`.
- **Windows setup scripts**: the setup/issue-command runner is a `.cmd` batch file unless the script starts with a `#!` line — never derive that from the user's terminal-shell preference, and never launch a `.cmd` runner with a bare `cmd.exe /c` from a Git Bash pane (MSYS rewrites the `/c`). See [`docs/reference/windows-setup-shell.md`](./docs/reference/windows-setup-shell.md).
- **Windows child processes**: start them through `runProcess`/`spawnProcess` in `src/shared/child-process/` — never `child_process` directly. It pins `windowsHide`, refuses `shell: true`, and encodes `.cmd`/`.bat` arguments so neither `CommandLineToArgvW` nor `cmd.exe` mangles them. A ratchet test fails on any new direct import. Recognised npm/pnpm `.cmd` shims are resolved to their real target so the spawn skips `cmd.exe` entirely; see [`docs/reference/windows-cmd-shim-resolution.md`](./docs/reference/windows-cmd-shim-resolution.md) before adding a shim shape or debugging one.
- **Windows process enumeration**: read the table through `src/main/windows/windows-process-table.ts`, never by forking `powershell.exe`. See [`docs/reference/windows-process-enumeration.md`](./docs/reference/windows-process-enumeration.md).
- **Windows daemon-host relocation**: the terminal daemon runs from a copy of the app runtime under `%LOCALAPPDATA%`, which is what survives an auto-update. Before touching that copy, its exe name, or the NSIS uninstall macro, read [`docs/reference/windows-daemon-host-relocation.md`](./docs/reference/windows-daemon-host-relocation.md).
- **Windows EDR signal**: don't add `-ExecutionPolicy Bypass`, `-EncodedCommand`, `cmd.exe /c` with escaped free text, per-operation interpreter spawning, or runtime `Add-Type` compilation without reading [`docs/reference/windows-edr-posture.md`](./docs/reference/windows-edr-posture.md) first — behavioural EDR scores each of those, and being signed does not clear them.
- **WSL commands**: build argv with `buildWslExecArgs` (always `--exec` — under `--`, `wsl.exe` expands `$name` in every argument and silently rewrites the script), and fence anything whose stdout you parse with `buildWslCapturedLoginShellCommand`, because the interactive login shell prints the distro banner to stdout. See [`docs/reference/wsl-command-execution.md`](./docs/reference/wsl-command-execution.md).
- **Linux native modules**: keep the glibc floor at Ubuntu 20.04 / glibc 2.31. A module compiled from source on a newer runner can reference symbol versions absent on the floor and crash the app on startup. See [`docs/reference/linux-glibc-compatibility.md`](./docs/reference/linux-glibc-compatibility.md); packaging fails if a bundled native binary needs newer glibc.

## SSH Use Case

All changes must consider the SSH use case. Don't assume local-only execution. Before changing anything that reports on, stops, or lists remote work, follow [`docs/reference/ssh-execution-boundary.md`](./docs/reference/ssh-execution-boundary.md): the execution host owns everything that touches execution, and loss of contact is never evidence of process death — the verdict vocabulary is `live` / `unverifiable` / `exited`, with no synonyms.

## Folder Workspace Use Case

All changes must consider folder workspaces as well as git worktrees. Don't assume every workspace is a git worktree.

## Agent Status

The execution host owns agent status in one store, the hook server's, and every reader (sidebar, `worktree ps`, mobile, dashboard) subscribes to it. Before adding a producer, a cache, or a reader-side precedence rule, read [`docs/reference/agent-status-store.md`](./docs/reference/agent-status-store.md): new producers write into that store, and readers keep only presentation policy.

## Agent Terminal Screens

A rule that reads what an agent CLI paints on a terminal — readiness, blocked prompts, idle — must be written against a captured transcript, not a remembered screen. Record one with [`docs/reference/agent-pty-transcript-capture.md`](./docs/reference/agent-pty-transcript-capture.md), which keeps escapes and wrapping intact and scrubs account identifiers before they reach git. Antigravity readiness has no transcript yet and five failed attempts without one; before touching it, read [`docs/reference/antigravity-readiness-evidence.md`](./docs/reference/antigravity-readiness-evidence.md).

## Remote Wire Compatibility

Clients and remote Orca servers update independently, so mixed versions are the normal state. Before changing anything a paired client and host exchange — RPC params, stream frames, or the content either side publishes over them — follow [`docs/reference/remote-wire-compatibility.md`](./docs/reference/remote-wire-compatibility.md). A new optional field is safe; a new stream opcode must be capability-negotiated because decoders drop unknown opcodes silently; and changing what the host publishes reaches old clients even with no wire change.

## Git Binary Compatibility

Orca runs the user's Git binary on native, WSL, and SSH hosts, which may all have different versions. Treat Git 2.25 as the core-workflow baseline and follow [`docs/reference/git-compatibility.md`](./docs/reference/git-compatibility.md).

When adding or changing a Git command:

- Check when every subcommand and option was introduced. For newer behavior, keep a baseline-compatible fallback or degrade safely.
- Use `GitCapabilityCache` with a narrow unsupported-error predicate so recurring operations do not retry a known-invalid command. Do not rely only on `git --version`; wrappers such as `simple-git` do not remove host-version differences.
- Scope capability state to the host that executes Git: native, WSL distro, SSH provider, or relay connection. Cover the first fallback, later cached calls, concurrent probes, and relevant host isolation in tests.
- Keep the real-binary compatibility contract in PR CI current. When adopting a newer Git feature, add its version boundary so the preferred command and fallback both run against representative Git releases.
- Preserve commands that begin with global Git options such as `-c` before the subcommand, including auto-maintenance suppression used by worktree-create fetches.

## Git Scan Safety

- Never enumerate every ref and then run `git ls-tree -r` or `git show` once per ref. That ref × tree fan-out can retain gigabytes of output before a downstream `sort -u` or search can make progress.
- Prefer `rg` over the checked-out files for source searches. For history or refs, use a named ref, an explicit namespace/path, `--max-count`, and a bounded output; do not use an unqualified `--all` scan as a first diagnostic.
- Keep repository-wide commands targeted to the current repository and worktree. If an unbounded scan is genuinely required, measure the ref count first, explain the cost, and get confirmation before running it.

## Git Provider Compatibility

Source-control and review changes must consider GitLab and other supported git providers, not only GitHub. Keep provider-specific behavior behind explicit checks, and avoid GitHub-only naming for generic review concepts.

## GitHub CLI Usage

Be mindful of the user's `gh` CLI API rate limit — batch requests where possible and avoid unnecessary calls. All code, commands, and scripts must be compatible with macOS, Linux, and Windows.

# ORCB 定制化目标与上游同步策略

## 项目目标

ORCB 是基于上游 Orca 的本地定制发行版。当前产品目标是在不替换 Orca 核心工作流的前提下，提供独立的会话观察能力：从 Agent 事件生成会话分析与看板，点击卡片后在同一弹框中查看详情，并通过 Orca 已有的原生终端预览能力附着到对应 PTY。

`agent-session-observer` 是产品行为和展示的参考实现，不是 ORCB 的运行时依赖。ORCB 必须在本仓库内维护自己的数据模型、IPC 和 UI；不要让已打包应用依赖其本地路径、服务或构建产物。

长期优先级如下：

1. 保持可持续合并官方 Orca 更新；
2. 保持 Observer 功能独立、可测试、可移除；
3. 复用 Orca 已有终端、PTY、输入、尺寸协商和主题能力；
4. 只在必要的接缝处接入 ORCB，避免改变官方功能的语义。

## 模块边界与修改策略

将 ORCB 的业务代码集中在以下位置：

- `src/shared/session-observer.ts`：Observer 的跨进程数据契约；
- `src/main/session-observer/`：事件接收、状态持久化、运行时终端盘点和快照；
- `src/main/ipc/session-observer.ts`：Observer IPC 注册；
- `src/preload/api/session-observer-*.ts`：受限 preload API；
- `src/renderer/src/components/session-observer/`：看板、详情弹框和 Observer UI；
- `src/shared/orcb-local-distribution.ts`：ORCB 本地发行策略，例如应用更新开关。

允许修改上游代码的接缝只限于必要的入口注册、IPC/preload 装配、应用壳层挂载、菜单入口和本地发行开关。接缝文件只能把控制权交给上述模块，不能承载 Observer 业务规则、状态计算或大段 UI。每次新增接缝都要说明为什么不能由模块内部完成，并让 diff 保持尽可能小。

不要改动官方 Agent Dashboard 的状态机、卡片逻辑或管理弹窗来实现 Observer；Observer 必须保有自己的状态、持久化和弹框。不要复制或重写 xterm、PTY 输入协议、IME、剪贴板、光标或尺寸协商逻辑；直接复用 `AgentTerminalPreview` 等既有原生终端能力，只传入 Observer 已解析出的 `ptyId`。若上游终端能力确有缺陷，先将修复设计成通用、可独立提交给上游的改动，再决定是否纳入 ORCB。

Observer 的状态语义属于产品契约：运行中、已关闭、手工覆盖、阻塞和分析缺失的优先级必须与 `agent-session-observer` 对齐。调整这些规则时，必须同时更新服务层和展示层测试；无法验证运行时终端时只能显示“状态未知”，不能推断为已关闭。

本地应用名称保持为 `orcb`。官方应用的自动更新检查、菜单和提示由 `ORCB_APP_UPDATES_ENABLED` 统一控制；不要在多个 UI 中散落独立判断，也不要误伤与远程 Orca Server 有关的更新能力。

## 开发注意事项

- 新增 Observer 功能前，先搜索现有 Orca primitive、terminal preview、IPC 和状态存储是否已能复用；不要建立平行的基础设施。
- UI 优先复用仓库现有 shadcn primitive 和设计 token。详情弹框在宽屏下保持左侧详情约 1/3、右侧原生终端约 2/3；窄屏可以堆叠，但终端必须保有可输入的空间。
- Observer 的远程/SSH 终端状态遵守 `live` / `unknown` / `closed` 的证据边界。网络暂时不可达不是进程结束。
- 新 IPC 字段必须保持向后兼容；优先新增可选字段，避免改变已有协议含义。
- 每个 ORCB 功能提交只做一个逻辑变更。Observer 功能、上游同步和纯格式化不得混在同一提交中。
- 除非用户明确要求，提交只保留在本地，不要 push。

## 同步上游 Orca 的流程

当前远程 `origin` 是 ORCB 自己的仓库，不应把它当作官方上游。首次同步前，由维护者确认官方 Orca 地址后添加只读语义的 `upstream` remote，并确认它的默认分支；不要假定分支名称一定是 `main`。

同步必须从没有未提交改动的分支开始，并使用独立同步分支。推荐流程：

```bash
# 一次性配置：用确认过的官方地址替换占位符
git remote add upstream <official-orca-repository-url>

# 每次同步
git fetch --prune upstream
git switch main
git pull --ff-only origin main
git switch -c sync/orca-YYYYMMDD
git merge --no-ff upstream/<upstream-default-branch>
```

对已经共享的 `main` 使用合并提交，不要 rebase 或强推它。独立的同步提交会保留“何时、从哪个上游版本同步”的边界，便于排查回归和后续再次合并。完成验证后再将同步分支合入 ORCB 的 `main`。

## 冲突处理原则

不要对整个目录或整个文件使用 `--ours` / `--theirs`。逐个冲突块判断来源，并遵守以下顺序：

1. **Observer 自有文件冲突**：保留 ORCB 行为和测试，再按上游公开 API、类型或目录变更做适配。
2. **上游接缝文件冲突**：先接受上游新的结构与生命周期，再以最小调用重新接入 Observer。不要把旧版整段 ORCB 壳层代码覆盖回去。
3. **上游核心文件冲突**：默认优先保留上游实现。只有已有明确 ORCB 产品约束时才加回最小差异，并将该差异收敛为接缝或通用修复。
4. **终端/PTY 相关冲突**：优先采用上游的协议、输入和尺寸协商实现；重新检查 Observer 传递的 `ptyId`、挂载时机和不可用状态，不要恢复旧的自定义终端代码。

每个冲突解决后，先搜索所有受影响符号和调用方，再运行相关单测。同步完成前至少执行：

```bash
pnpm tc
pnpm run check:code-quality:changed
pnpm test src/renderer/src/components/session-observer
pnpm run build:unpack
```

同时人工验证一条真实会话：看板状态、卡片弹框、终端光标和输入、IME/粘贴、终端结束后的展示，以及本地应用不出现官方更新提示。先记录上游版本、冲突文件和保留原因，再提交单独的上游同步提交。

## Observer 详情弹框终端操作变更记录（2026-09-12）

本次变更为 Observer 详情弹框增加“打开工作树”和“关闭终端”操作。目标是让会话分析窗口可以回到原工作树，或在确认后关闭对应的原生终端，同时不复制终端/PTY 控制逻辑。关闭请求必须回到主渲染器的现有关闭控制器，由它继续负责运行中进程探测、关闭确认、PTY 清理、布局持久化和会话状态清理。

### 数据流和修改原因

1. `src/shared/session-observer.ts` 新增 `SessionObserverRevealArgs` 和 `SessionObserverCloseArgs`。它们是两个渲染器之间的最小路由契约；关闭目标额外携带 `ptyId`，用于防止会话结束后同一 pane 被复用时误关新终端。
2. `src/main/ipc/session-observer.ts` 新增 `sessionObserver:reveal` 和 `sessionObserver:close`。这里是独立 Observer 窗口能够触达主窗口的受信边界，因此要保留 Observer renderer 来源校验、字段长度校验、主窗口存在性校验，以及 `ui:revealSessionObserver` / `ui:closeSessionObserver` 转发。不得在 IPC 层直接操作 PTY。
3. `src/preload/api/session-observer-api.ts` 和 `src/preload/api/session-observer-bridge.ts` 暴露 invoke/listener，并保持 preload 的窄接口。新增通道时要同时更新类型和清理 listener 的函数，不能把 `ipcRenderer` 暴露给页面。
4. `src/renderer/src/app-shell/use-app-shell-services.ts` 安装两个常驻 bridge。主窗口的 workspace、tab 和 PaneManager 状态只存在于主渲染器，必须在应用壳层订阅转发，不能让 Observer 弹框自行维护一份状态。
5. `src/renderer/src/components/session-observer/` 负责 Observer 自有行为：详情按钮、单会话 pending 状态、关闭后刷新快照，以及 `activateAndRevealWorkspace` / `activateTabAndFocusPane` 路由。`close-session-observer.ts` 解析稳定 `paneKey`，先激活来源 tab，再通过一次性、有限帧重试的事件等待目标 pane 挂载。
6. `src/renderer/src/components/terminal-pane/` 是唯一必须触碰的上游终端接缝。`REQUEST_CLOSE_TERMINAL_PANE_EVENT` 只在挂载的 pane surface 中接收，并同时检查 `tabId`、leaf 是否仍存在、当前 PTY 是否等于 `expectedPtyId`；通过后调用既有 `handleRequestClosePane`。`handled` 标记用于多个挂载 surface 或重试帧竞争时保证只关闭一次。不要在这里新增第二套 close、PTY kill、输入或尺寸协商实现。
7. 各对应 `*.test.*` 覆盖 IPC 来源和参数校验、preload relay、工作树路由、关闭请求的 stale/duplicate 防护、按钮显示和 pending 状态、以及终端挂载事件的 PTY 匹配。修改上述契约或生命周期时，测试必须随之更新。

### 与上游合并时的文件处理顺序

- **Observer 自有文件**（`src/shared/session-observer.ts`、`src/renderer/src/components/session-observer/` 里的新增路由模块和测试）：保留本节定义的行为和测试，再按上游类型、导入路径或 primitive 重命名做适配。
- **IPC/preload/应用壳层接缝**（`src/main/ipc/session-observer.ts`、`src/preload/api/session-observer-*`、`use-app-shell-services.ts`）：先采用上游最新的 handler 注册、可信窗口获取和服务生命周期结构，再以最小 diff 重新接入两个通道和两个 bridge；不要用旧文件整段覆盖上游。
- **终端生命周期接缝**（`terminal-pane-lifecycle-types.ts`、`terminal-pane-mount-events.ts`、`use-terminal-pane-lifecycle-stage.ts`、`use-terminal-pane-mount-lifecycle.ts`、`constants/terminal.ts`）：默认保留上游的 PaneManager、关闭确认、运行探测、PTY transport 和挂载/卸载时序，只恢复可选的 `onRequestClosePane` 注入、请求事件监听和 `expectedPtyId` 校验。若上游重命名事件或拆分生命周期函数，按同一语义迁移，不要恢复旧实现。
- **冲突验证**：解决后搜索 `sessionObserver:close`、`REQUEST_CLOSE_TERMINAL_PANE_EVENT`、`handleRequestClosePane`、`expectedPtyId` 的所有调用方；至少运行 Observer 相关单测和终端挂载事件单测，再执行本节“同步上游 Orca 的流程”中的完整检查。
