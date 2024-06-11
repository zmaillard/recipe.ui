#!/usr/bin/env just --justfile
set dotenv-load := true

import file issue:
    go run ./editor/cmd/cli import {{file}} {{issue}}

index:
    go run ./editor/cmd/cli index

category:
    go run ./editor/cmd/cli categories
