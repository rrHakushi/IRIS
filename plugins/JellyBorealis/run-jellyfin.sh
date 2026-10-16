#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Building & Publishing JellyBorealis Plugin (.NET 10) ==="
dotnet publish "$SCRIPT_DIR/Jellyfin.Plugin.Borealis.csproj" -c Debug -o "$SCRIPT_DIR/bin/Debug/net10.0/publish" /property:GenerateFullPaths=true /consoleloggerparameters:NoSummary

echo "=== Deploying Plugin into Jellyfin Data Directories ==="
mkdir -p "$SCRIPT_DIR/.jellyfin/data/plugins/JellyBorealis"
mkdir -p "$HOME/.local/share/jellyfin/plugins/JellyBorealis"

cp -r "$SCRIPT_DIR/bin/Debug/net10.0/publish/"* "$SCRIPT_DIR/.jellyfin/data/plugins/JellyBorealis/"
cp -r "$SCRIPT_DIR/bin/Debug/net10.0/publish/"* "$HOME/.local/share/jellyfin/plugins/JellyBorealis/"

echo "=== Starting Jellyfin Server with JellyBorealis on http://localhost:8096 ==="
exec dotnet "$SCRIPT_DIR/.jellyfin/server/jellyfin.dll" \
  --webdir "$SCRIPT_DIR/.jellyfin/web" \
  --datadir "$SCRIPT_DIR/.jellyfin/data" \
  --configdir "$SCRIPT_DIR/.jellyfin/config" \
  --logdir "$SCRIPT_DIR/.jellyfin/log" \
  "$@"
