$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot 'compose.yaml'

docker compose --project-directory $projectRoot --file $composeFile up --build --wait
$result = $LASTEXITCODE
if ($result -eq 0) {
    Write-Output 'Kanban Studio is running at http://127.0.0.1:8000'
}
exit $result
