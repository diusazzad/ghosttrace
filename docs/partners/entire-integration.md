# Entire CLI & Antigravity Agent Integration

## 1. Overview
This document records the official integration and verification of the **Entire CLI** (`v0.12.2`) with **Antigravity** (Google DeepMind's agentic engineering harness) within the GhostTrace repository for the **Best Use of Entire** partner category. Entire provides autonomous session tracking, cryptographic checkpoint hashing, and transparent provenance attribution for all agentic code mutations.

---

## 2. Integration Details & Telemetry

- **Official Partner Category**: **Best Use of Entire** ($100 MLH Partner Prize Track)
- **Entire CLI Version**: `0.12.2` (Go: `go1.27.3`, OS/Arch: `windows/amd64`)
- **Agent Platform**: `Antigravity` (Google DeepMind's agentic engineering CLI)
- **Repository**: [`diusazzad/ghosttrace`](https://github.com/diusazzad/ghosttrace)
- **Integration Branch**: `feat/entire-cli-integration`
- **Pull Request**: [#3: feat(entire): integrate Antigravity session capture and checkpoint evidence](https://github.com/diusazzad/ghosttrace/pull/3)
- **Base Commit**: `6199002cc2c39de421010461375d3afc40443c9f` (TASK 02 approved core workflow slice)
- **Initial Verification Commit**: `e3cdf8489400a839e0b49bf559ae9e59466f7bd2`
- **Active Checkpoint (Branch Trailer)**: `01M689TXSBS4TEKQ1MN52NSQCH` (Commit `55e16f3f6e0913f6695b74c1df1f2c17542e63ce`)
- **Historical Session Checkpoint**: `01M689PD4S6BJRQDS953VV7FDY`

---

## 3. Storage Architecture: Git-Refs Namespace vs. Working Tree Metadata

> [!IMPORTANT]
> **Checkpoints are Git References, not Working-Tree Metadata.**
> Entire CLI operates on a pluggable storage backend. In GhostTrace, the configured primary storage type is `git-refs` (`.entire/settings.json`):
> ```json
> {
>   "enabled": true,
>   "strategy_options": {
>     "push_sessions": false
>   },
>   "checkpoints": {
>     "primary": {
>       "type": "git-refs"
>     }
>   }
> }
> ```
> Under this architecture:
> - Checkpoints are **NOT** flat files stored under `.entire/`.
> - Checkpoints are recorded directly into Git's object database under the dedicated Git namespace:
>   `.git/refs/entire/checkpoints/<2-char-prefix>/<checkpoint-id>`
> - Example: Checkpoints are stored at:
>   - `refs/entire/checkpoints/CH/01M689TXSBS4TEKQ1MN52NSQCH` (Git blob SHA: `bb11734a9f2e64aee046f9dcd76b65cc436058f6`)
>   - `refs/entire/checkpoints/DY/01M689PD4S6BJRQDS953VV7FDY` (Git blob SHA: `6ea6258b5c10103ac13cb70a07a22be51cfcc80a`)
> - The `.entire/` directory contains only repository settings (`settings.json`) and untracked transient state (`.entire/.gitignore`).

---

## 4. Public Privacy Policy & Remote Isolation (`push_sessions: false`)

GhostTrace is an open-source security tool. Unfiltered agent transcripts can inadvertently expose environment settings or local paths. Entire CLI guarantees complete privacy via `push_sessions: false`:

1. **`push_sessions: false` Behavior**:
   - `git push` is blocked by Entire's `pre-push` hook from pushing references in `refs/entire/checkpoints/*` to the remote repository.
   - Running `entire checkpoint list --outgoing` verifies that zero checkpoints will ever be transmitted:
     ```text
     Automatic checkpoint pushing is off (push_sessions=false), so 'git push' sends none of these.
     2 checkpoints are queued for origin:
     01M689PD4S6BJRQDS953VV7FDY  2m ago  Antigravity
     01M689TXSBS4TEKQ1MN52NSQCH  just now  Antigravity
     ```
2. **Zero Remote Leaks Verified**:
   - Querying the remote repository confirms zero checkpoint references exist on GitHub:
     ```bash
     $ git ls-remote origin "refs/entire/checkpoints/*"
     # (returns empty — no references exist on remote)
     ```
3. **Local Auditability with Remote Hygiene**:
   - The developer retains 100% forensic visibility locally using `entire checkpoint explain <id>` and `entire checkpoint tokens <id>`.
   - The public repository remains completely sanitized, with zero raw sessions pushed.

---

## 5. Installed Agent & Git Hooks

### A. Antigravity Agent Lifecycle Hooks (`.agents/hooks.json`)
The following 4 hooks bind Antigravity session transitions to Entire:
```json
{
  "entire": {
    "SessionStart": [
      {
        "type": "command",
        "command": "where.exe entire >nul 2>nul & if errorlevel 1 (ver>nul) else (entire hooks antigravity session-start)"
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "where.exe entire >nul 2>nul & if errorlevel 1 (ver>nul) else (entire hooks antigravity pre-tool-use)"
          }
        ]
      }
    ],
    "PreInvocation": [
      {
        "type": "command",
        "command": "where.exe entire >nul 2>nul & if errorlevel 1 (ver>nul) else (entire hooks antigravity pre-invocation)"
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "where.exe entire >nul 2>nul & if errorlevel 1 (ver>nul) else (entire hooks antigravity stop)",
        "timeout": 300
      }
    ]
  }
}
```

### B. Git Lifecycle Hooks (`.git/hooks/`)
Installed with absolute binary paths (`C:\Users\sazza\.local\bin\entire.exe`):
- `commit-msg`: Verifies commit trailers and formats checkpoint messages.
- `post-commit`: Condenses turn session data and anchors checkpoint SHA to the commit.
- `post-rewrite`: Preserves checkpoint links across rebase or amend operations.
- `pre-push`: Enforces session push restrictions (`push_sessions=false`).
- `prepare-commit-msg`: Injects `Entire-Checkpoint` trailer metadata into commit messages.

---

## 6. Real Checkpoint Verification & CLI Telemetry Evidence

### A. Entire CLI Version & Status
```bash
$ entire --version
Entire CLI 0.12.2 (go1.27.3 windows/amd64)

$ entire status
● Enabled · branch feat/entire-cli-integration
  Agents · Antigravity
  Automatic checkpoint pushing: disabled (push_sessions=false)
  Checkpoints read from: origin

$ entire doctor
✓ Metadata branches: OK
✓ Git hooks: OK
✓ Antigravity hook configuration: OK

$ entire agent list
Agents:
  ✓ antigravity
    claude-code
    codex
    copilot-cli
    cursor
    factoryai-droid
    opencode
    pi
```

### B. Verified Checkpoint Listing on Active Branch
```bash
$ entire checkpoint list
  branch       feat/entire-cli-integration
  checkpoints  1

● 01M689TXSBS4TEKQ1MN52NSQCH  docs(entire): document git-refs architecture and verified...
  10-31 12:19 (55e16f3) docs(entire): document git-refs architecture and verified checkpoint evidence
```

### C. Git References in `.git/refs/entire/checkpoints/`
```bash
$ git show-ref | Select-String "entire"
bb11734a9f2e64aee046f9dcd76b65cc436058f6 refs/entire/checkpoints/CH/01M689TXSBS4TEKQ1MN52NSQCH
6ea6258b5c10103ac13cb70a07a22be51cfcc80a refs/entire/checkpoints/DY/01M689PD4S6BJRQDS953VV7FDY
```

### D. Sanitized Checkpoint Explain (`entire checkpoint explain`)
```text
$ entire checkpoint explain 01M689TXSBS4TEKQ1MN52NSQCH
● Checkpoint 01M689TXSBS4TEKQ1MN52NSQCH
  session  90af7aef-b9cc-42af-8aef-3da64373d7d4
  created  2026-10-31 06:20:05
  author   diusazzad <sazzad35-283@diu.edu.bd>
  redacted 29 replacements in this session so far · matches: entropy 8, betterleaks 1, credential_value 20
  commits  55e16f3 docs(entire): document git-refs architecture and verified checkpoint evidence
────────────────────────────────────────────────────────────
Transcript (checkpoint scope):
[Tool] manage_task
[Tool] run_command
[Tool] client_edit_file
[Tool] run_command
```

### E. Checkpoint Tokens Breakdown (`entire checkpoint tokens`)
```text
$ entire checkpoint tokens 01M689PD4S6BJRQDS953VV7FDY
Checkpoint tokens

Checkpoint: 01M689PD4S6BJRQDS953VV7FDY
Session:    90af7aef-b9cc-42af-8aef-3da64373d7d4
Agent:      Antigravity
Status:     Captured (6 turns)
```

### F. Entire Search & Remote Connectivity Note
- Running `entire search` without active Entire cloud authentication reports:
  `search failed: not authenticated. Run 'entire login' to authenticate`
- All local provenance commands (`entire checkpoint explain`, `entire checkpoint list`, `entire checkpoint tokens`, `git show-ref`) function autonomously and offline directly against Git's `refs/entire/checkpoints/` namespace without needing cloud login.

---

## 7. Architectural Value for GhostTrace

GhostTrace is designed to uncover nondeterministic failure chains in AI agent workflows. By integrating Entire CLI into the development of GhostTrace itself:
1. **Self-Auditing Pipeline**: The agent building the trace forensic engine generates verifiable, cryptographically hashed checkpoints for its own code modifications.
2. **Deterministic Provenance**: In the event of a regression, developers can inspect the exact agent prompt, model turn, and tool calls that created any given commit.
3. **Privacy-Preserving Compliance**: Developers working with proprietary or security-critical codebases can leverage Entire locally while guaranteeing zero telemetry leakage to public remotes.
