#!/bin/bash

set -xe

npm install -g @anthropic-ai/claude-code
sudo mkdir -p /home/node/.claude && sudo chown -R node:node /home/node/.claude
sudo mkdir -p /home/node/.config && sudo chown -R node:node /home/node/.config

mkdir -p /workspace/workdir
