param(
    [string]$ContentPath = (Join-Path $PSScriptRoot '..\content\comparative-theology-3-course.json'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\dist\sravnitelnoe-bogoslovie-3-kurs\questions.js')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$json = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ContentPath), [Text.Encoding]::UTF8)
$data = $json | ConvertFrom-Json
if ($data.questions.Count -ne 16) { throw "Ожидалось 16 экзаменационных вопросов, найдено $($data.questions.Count)" }
for ($i = 0; $i -lt $data.questions.Count; $i++) {
    if ($data.questions[$i].number -ne ($i + 1) -or -not $data.questions[$i].question -or -not $data.questions[$i].answer -or -not $data.questions[$i].takeaway) {
        throw "Неполная или неверно пронумерованная карточка $($i + 1)"
    }
}
$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$payload = "window.COMPARATIVE_3_DATA = $json;`n"
[IO.File]::WriteAllText($OutputPath, $payload, [Text.UTF8Encoding]::new($false))
"Создано: $OutputPath"
"Вопросов: $($data.questions.Count)"
