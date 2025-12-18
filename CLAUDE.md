# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- Do not add redundant comments that merely restate what the code already says (e.g., `/** Get current workspace */` above `getCurrentWorkspace()`).
- Add comments only when they provide additional context not obvious from the code itself (e.g., explaining why something is done, documenting emitted events, or describing complex algorithms).

## Project Overview

This is a Discord bot that integrates with Claude CLI to provide chat-based access to Claude Code functionality. Users can interact with Claude through Discord mentions, and the bot will execute Claude CLI commands and return responses via the Discord channel.

## Directory Structure

```
src/
├── index.ts                 # Application entry point
├── claude/
│   ├── index.ts             # ClaudeCode - main wrapper class
│   ├── executor.ts          # ClaudeExecutor - spawns CLI processes
│   ├── types.ts             # Type definitions for Claude CLI
│   ├── errors.ts            # ClaudeError, ClaudeExecuteFailedError
│   ├── config_generator.ts  # MCP config file generator
│   └── system_prompt.ts     # Default system prompt
├── session/
│   ├── types.ts             # ChatSession interface
│   ├── handler.ts           # SessionHandler - bridges executor and session
│   ├── handler.test.ts      # Unit tests
│   └── discord.ts           # DiscordSession implementation
├── providers/
│   ├── types.ts             # ChatProvider abstract class
│   ├── errors.ts            # Provider error classes
│   └── discord/
│       ├── index.ts         # DiscordProvider
│       ├── config.ts        # Discord config validation
│       ├── progress_updater.ts  # Throttled message updates
│       └── util.ts          # Embed message utilities
└── workspace/
    ├── index.ts             # Re-exports
    ├── types.ts             # Workspace, WorkspaceConfig
    ├── manager.ts           # WorkspaceManager singleton
    └── commands.ts          # !workspace command handler
```

## Architecture

### Core Components

**ClaudeCode (`src/claude/index.ts`)** - Main wrapper class that manages Claude CLI interactions and session state. Provides `handleSession(session, prompt)` for platform-agnostic interaction.

**ClaudeExecutor (`src/claude/executor.ts`)** - Spawns Claude CLI processes, parses streaming JSON output, and emits `assistant`/`result` events. Uses headless mode (`-p`) with `--output-format stream-json`.

**WorkspaceManager (`src/workspace/manager.ts`)** - Singleton that manages isolated workspaces under `WORKSPACE_ROOT`. Emits `switched` event when workspace changes.

### Session Architecture

**ChatSession Interface** - Platform-agnostic interface with 4 methods: `updateProgress()`, `complete()`, `fail()`, `awaitingInput()`.

**SessionHandler** - Bridges ClaudeExecutor and ChatSession. Detects `[ask_approval]` tag and triggers approval flow.

**DiscordSession** - Discord implementation using ProgressUpdater for throttled updates (2000ms). Shows "続行" button for approvals.

### Providers

**DiscordProvider** - Listens for bot mentions, creates DiscordSession, handles button interactions for approval continuation, routes `!workspace` commands.

### Data Flow

**Normal completion flow:**
```
User: "@bot add feature"
  ↓
DiscordProvider.handleMessage()
  ↓
claudeCode.handleSession(session, prompt)
  ↓
ClaudeExecutor spawns CLI (captures session-id)
  ↓
[In progress] session.updateProgress() displays progress
  ↓
SessionHandler receives result
  ↓
session.complete() sends final result
```

**Approval request flow:**
```
User: "@bot delete files"
  ↓
claudeCode.handleSession(session, prompt)
  ↓
Claude: "Will delete these files... [ask_approval]"
  ↓
SessionHandler detects tag → session.awaitingInput()
  ↓
Discord shows "続行" button, registers pendingApprovals
  ↓
--- User clicks button OR replies with mention ---
  ↓
handleButtonInteraction() or handleMessage()
  ↓
claudeCode.handleSession(newSession, "続行してください" or custom)
  ↓
Claude CLI resumes with --resume (session-id preserved)
  ↓
session.complete()
```

**Key design decisions:**
- Each `handleSession()` executes once and returns (no internal loop)
- Session continuity via `--resume` flag with stored session-id
- `[ask_approval]` tag triggers approval UI, removed from displayed text
- Workspace commands bypass ChatSession (direct Discord message)

### Workspace Commands

```
!workspace              # Show current workspace
!workspace create <n>   # Create new workspace
!workspace switch <n>   # Switch workspace
!workspace list         # List all workspaces
!workspace <name>       # Smart switch if exists
```

## Development

### DevContainer (Recommended)

Open in VS Code and select "Reopen in Container". Includes Node.js 24, pnpm, Claude CLI.

### Commands

```bash
pnpm run build      # Build project
pnpm run start      # Run in development mode
pnpm run dev        # Run with watch
pnpm run typecheck  # Type checking
pnpm run lint       # Linting
pnpm run test       # Run tests (watch)
pnpm run test:run   # Run tests once
```

### Testing

Test files use `.test.ts` suffix. Framework: Vitest.

## Environment Variables

Required (`.env`):
- `DISCORD_API_KEY` - Discord bot token
- `DISCORD_CHANNEL_ID` - Target channel ID
- `WORKSPACE_ROOT` - Root directory for workspaces

Optional:
- `MCP_CHAT_HUMAN_ENTRYPOINT` - MCP server path (default: `/opt/mcp-chat-human/build/index.js`)
- `CLAUDE_SKIP_PERMISSIONS` - Set "true" to skip permission prompts

## Dependencies

Main libraries:
- `discord.js` - Discord bot
- `zod` - Schema validation
- `es-toolkit` - Utilities (throttle)
- `vitest` - Testing

## TypeScript Configuration

Strict settings: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. ES2022 target with NodeNext modules.

## Individual Preferences

- @.claude/local.md

## Reference Docs

- [Model Context Protocol (MCP)](https://modelcontextprotocol.org/)
- [discord.js Documentation](https://discord.js.org/docs)
- [Claude Code CLI Reference](https://code.claude.com/docs/ja/cli-reference)
- [Claude Agent SDK Docs (for output json format)](https://console.anthropic.com/docs/ja/agent-sdk/typescript)
