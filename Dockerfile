# Base stage with pnpm setup
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base

ARG PNPM_VERSION=10.25.0

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install --global corepack@latest && \
    corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

#
# Builder
#
FROM base AS builder

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN  pnpm install --frozen-lockfile

# Copy source files
COPY tsconfig.json eslint.config.js ./
COPY src ./src

# Build the application
RUN pnpm run build

#
# Production runner
#

FROM base AS production

ARG CLAUDE_CODE_VERSION=latest
ARG GITHUB_CLI_VERSION=2.67.0

# Install GitHub CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    less \
    git \
    procps \
    sudo \
    man-db \
    unzip \
    gnupg2 \
    dnsutils \
    jq \
    curl && \
    curl -fsSL https://github.com/cli/cli/releases/download/v${GITHUB_CLI_VERSION}/gh_${GITHUB_CLI_VERSION}_linux_amd64.deb -o /tmp/gh.deb && \
    dpkg -i /tmp/gh.deb && \
    rm /tmp/gh.deb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod  --frozen-lockfile

# Copy built files from builder stage
COPY --from=builder /app/build ./build

# Copy mcp-chat-human from mcp-builder stage

RUN groupadd -r claude && useradd -r -g claude -m -d /home/claude claude

# Create working directory for Claude CLI
RUN mkdir -p /workdir && chown -R claude:claude /workdir

# Create .claude directory for Claude CLI settings and authentication
RUN mkdir -p /home/claude/.claude && chown -R claude:claude /home/claude/.claude
RUN mkdir -p /home/claude/.config && chown -R claude:claude /home/claude/.config

# Switch to non-root user
USER claude

# Set environment variables
ENV NODE_ENV=production
ENV CLAUDE_WORKING_DIR=/workdir
ENV CLAUDE_SKIP_PERMISSIONS=true

# Start the application
CMD ["node", "/app/build/index.js"]

