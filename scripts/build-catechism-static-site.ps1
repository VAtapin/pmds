param(
    [string]$ContentPath = (Join-Path $PSScriptRoot '..\content\catechism-questions.json'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\dist\katehizis\questions.js')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$json = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ContentPath), [Text.Encoding]::UTF8)
$payload = "window.QUESTIONS_DATA = $json;`n"
$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}
[IO.File]::WriteAllText($OutputPath, $payload, [Text.UTF8Encoding]::new($false))

$data = $json | ConvertFrom-Json
"Создано: $OutputPath"
"Вопросов: $($data.questions.Count)"
