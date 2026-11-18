$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot 'compose.yaml'

docker compose --project-directory $projectRoot --file $composeFile down
exit $LASTEXITCODE
