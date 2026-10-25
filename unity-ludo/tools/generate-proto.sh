#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v protoc >/dev/null || { echo "Install protoc first." >&2; exit 1; }
mkdir -p Assets/Scripts/AngelClient/Generated
protoc --proto_path=Protocol \
  --csharp_out=Assets/Scripts/AngelClient/Generated \
  Protocol/angel.proto
