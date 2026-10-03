param(
    [string]$ContentPath = (Join-Path $PSScriptRoot '..\content\religious-movements-questions.json'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\dist\religioznye-dvizheniya\questions.js')
)
$ErrorActionPreference = 'Stop'
$json = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ContentPath), [Text.Encoding]::UTF8)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
[IO.File]::WriteAllText($OutputPath, "window.QUESTIONS_DATA = $json;`n", [Text.UTF8Encoding]::new($false))
'Built religious movements data.'
