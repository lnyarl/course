#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$script_dir"

if ! command -v dotnet >/dev/null; then
    echo "The .NET 10 SDK is required." >&2
    exit 127
fi

projects=(
    MiniQueue.Demo
    MiniQueue.Transport
    MiniQueue.WorkerLab
    MiniQueue.ClusterLab
)

for project in "${projects[@]}"; do
    printf '\n%s\n' "=== $project ==="
    dotnet run --project "src/$project/$project.csproj" --configuration Release -- verify
done
