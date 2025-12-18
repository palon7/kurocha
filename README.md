# Kurocha

Discord bot that integrates with Claude CLI to provide chat-based access to Claude Code functionality.

**This document is not yet complete**

## Overview

This Discord bot allows you to interact with Claude Code through Discord mentions. The bot executes Claude CLI commands and returns responses via Discord channels.

## Features

- **Multiple Workspaces**: Isolated workspaces managed via commands.
- **Progress Updates**: Receives real-time progress updates in Discord.
- **Approval Prompts**: Interactive approval flow for sensitive operations.

## Prerequisites

- Docker and Docker Compose
- Discord Bot Token
- Anthropic API Key or Claude Pro/Max subscription

## Setup

### 1. Clone and Configure

```bash
# Clone the repository
git clone
cd kurocha

# Create environment file
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file with your credentials:

```bash
# Discord Bot Configuration
DISCORD_API_KEY=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_discord_channel_id_here

# Anthropic API Key
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# MCP Chat Human Entrypoint (optional - defaults to built-in installation)
# MCP_CHAT_HUMAN_ENTRYPOINT=/opt/mcp-chat-human/build/index.js

# Workspace Root Directory
WORKSPACE_ROOT=/workdir
```

### 3. Build and Start

#### Using Docker

TBD

#### Using Devcontainer
```bash
# Open in VSCode and start devcontainer

# Authorize Claude CLI
claude

# Start the bot
pnpm start
```

## Authentication Methods

Claude CLI requires authentication. There are two methods:

### Method 1: API Key (Recommended for Docker)

Set `ANTHROPIC_API_KEY` in your `.env` file. This is the simplest method for containerized environments.

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Method 2: Interactive Authentication

If you have a Claude Pro or Max subscription, you can authenticate interactively:

```bash
# Start a shell in the running container
docker compose exec kurocha sh

# Run and authenticate Claude CLI
claude

# Credentials will be stored in /home/claude/.claude/ (persisted in claude-config volume)
```

## License

MIT

## Author

Ryota Uno ([@palon7](https://github.com/palon7))
