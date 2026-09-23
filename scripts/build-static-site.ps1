param(
    [string]$ContentPath = (Join-Path $PSScriptRoot '..\content\questions.json'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\dist\questions.js')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$json = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ContentPath), [Text.Encoding]::UTF8)
$payload = "window.QUESTIONS_DATA = $json;`n"
[IO.File]::WriteAllText($OutputPath, $payload, [Text.UTF8Encoding]::new($false))

$data = $json | ConvertFrom-Json
"Создано: $OutputPath"
"Вопросов: $($data.questions.Count)"
