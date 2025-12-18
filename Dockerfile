# Base stage with pnpm setup
FROM node:24-slim AS base

ARG PNPM_VERSION="pnpm@10.25.0"

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

WORKDIR /mcp-build

# Clone and build mcp-chat-human
RUN git clone https://github.com/palon7/mcp-chat-human.git . && \
    pnpm install --frozen-lockfile && \
    pnpm run build

#
# Production runner
#

FROM base AS production

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod  --frozen-lockfile

# Copy built files from builder stage
COPY --from=builder /app/build ./build

# Copy mcp-chat-human from mcp-builder stage
RUN mkdir -p /opt/mcp-chat-human
COPY --from=builder /mcp-build/build /opt/mcp-chat-human/build
COPY --from=builder /mcp-build/package.json /opt/mcp-chat-human/
COPY --from=builder /mcp-build/node_modules /opt/mcp-chat-human/node_modules

RUN groupadd -r claude && useradd -r -g claude -m -d /home/claude claude

# Create working directory for Claude CLI
RUN mkdir -p /workdir && chown -R claude:claude /workdir

# Create .claude directory for Claude CLI settings and authentication
RUN mkdir -p /home/claude/.claude && chown -R claude:claude /home/claude/.claude

# Switch to non-root user
USER claude

# Set environment variables
ENV NODE_ENV=production
ENV CLAUDE_WORKING_DIR=/workdir
ENV CLAUDE_SKIP_PERMISSIONS=true
ENV MCP_CHAT_HUMAN_ENTRYPOINT=/opt/mcp-chat-human/build/index.js

# Start the application
CMD ["node", "/app/build/index.js"]

