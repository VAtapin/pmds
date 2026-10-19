param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputPath = (Join-Path $PSScriptRoot '..\content\new-testament-questions.json')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression

function Get-DocxParagraphs {
    param([string]$Path)

    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $archive.GetEntry('word/document.xml')
        if (-not $entry) {
            throw "В документе отсутствует word/document.xml: $Path"
        }

        $reader = [IO.StreamReader]::new($entry.Open())
        try {
            [xml]$xml = $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $archive.Dispose()
    }

    $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')

    foreach ($paragraph in $xml.SelectNodes('//w:body/w:p | //w:body/w:tbl/w:tr/w:tc/w:p', $ns)) {
        $text = (($paragraph.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '').Trim()
        if (-not $text) {
            continue
        }

        $styleNode = $paragraph.SelectSingleNode('./w:pPr/w:pStyle', $ns)
        $style = if ($styleNode) {
            $styleNode.GetAttribute('val', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
        }
        else {
            ''
        }

        [pscustomobject]@{
            text  = $text
            style = $style
        }
    }
}

$tagsByNumber = @{
    1  = 'Новый Завет и койне'
    2  = 'Языки Евангелий'
    3  = 'Датировка Евангелий'
    4  = 'Формирование канона'
    5  = 'Пререкаемые книги'
    6  = 'Богодухновенность'
    7  = 'Термины Нового Завета'
    8  = 'Евангелие от Матфея'
    9  = 'Евангелие от Марка'
    10 = 'Евангелие от Луки'
    11 = 'Евангелие от Иоанна'
    12 = 'Синоптическая проблема'
    13 = 'Герменевтика'
    14 = 'Нехристианские свидетельства'
    15 = 'Палестина и Ироды'
    16 = 'Логос'
    17 = 'Родословия Христа'
    18 = 'Захария и Благовещение'
    19 = 'Рождество Христово'
    20 = 'Иоанново крещение'
    21 = 'Крещение Господне'
    22 = 'Искушение Христа'
    23 = 'Никодим'
    24 = 'Самарянка'
    25 = 'Двенадцать апостолов'
    26 = 'Нагорная проповедь'
    27 = 'Притчи о Царстве'
    28 = 'Хлеб Небесный'
    29 = 'Преображение'
    30 = 'Воскрешение Лазаря'
    31 = 'Вход в Иерусалим'
    32 = 'Тайная Вечеря и Евхаристия'
    33 = 'Семь слов на Кресте'
    34 = 'Воскресение Христово'
    35 = 'Вознесение Господне'
}

$records = [System.Collections.Generic.List[object]]::new()
$current = $null
$started = $false

foreach ($paragraph in @(Get-DocxParagraphs -Path $InputPath)) {
    if ($paragraph.style -eq 'Heading2' -and $paragraph.text -match '^(\d{1,3})\.\s+(.+)$') {
        if ($current) {
            $current.answer = ($current.answerParagraphs -join "`n`n")
            $current.Remove('answerParagraphs')
            $records.Add([pscustomobject]$current)
        }

        $started = $true
        $number = [int]$Matches[1]
        $current = [ordered]@{
            id               = "new-testament-course-2-question-$number"
            course           = 2
            number           = $number
            question         = $Matches[2].Trim()
            answer           = ''
            takeaway         = ''
            tags             = @($tagsByNumber[$number])
            answerParagraphs = [System.Collections.Generic.List[string]]::new()
        }
        continue
    }

    if (-not $started -or -not $current) {
        continue
    }

    if ($paragraph.style -eq 'Heading1') {
        if ($records.Count -ge 34) {
            break
        }
        continue
    }

    if ($paragraph.style -eq 'Remember' -or $paragraph.text -match '^Запомнить:\s*(.+)$') {
        $takeaway = if ($paragraph.text -match '^Запомнить:\s*(.+)$') { $Matches[1].Trim() } else { $paragraph.text.Trim() }
        $current.takeaway = $takeaway
        continue
    }

    $current.answerParagraphs.Add($paragraph.text)
}

if ($current) {
    $current.answer = ($current.answerParagraphs -join "`n`n")
    $current.Remove('answerParagraphs')
    $records.Add([pscustomobject]$current)
}

$missingAnswers = @($records | Where-Object { -not $_.answer })
$missingTakeaways = @($records | Where-Object { -not $_.takeaway })
$unexpectedNumbers = @($records | Where-Object { -not $tagsByNumber.ContainsKey($_.number) })

if ($records.Count -ne 35 -or $missingAnswers.Count -or $missingTakeaways.Count -or $unexpectedNumbers.Count) {
    throw "Проверка извлечения не пройдена: вопросов=$($records.Count), без ответов=$($missingAnswers.Count), без памяток=$($missingTakeaways.Count), без тегов=$($unexpectedNumbers.Count)"
}

$result = [ordered]@{
    generatedAt  = (Get-Date).ToString('o')
    subject      = 'Обзор Нового Завета'
    counts       = [ordered]@{
        secondYear = $records.Count
        total      = $records.Count
    }
    verification = [ordered]@{
        expectedCount    = 35
        extractedCount   = $records.Count
        missingAnswers   = $missingAnswers.Count
        missingTakeaways = $missingTakeaways.Count
    }
    questions    = $records
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$json = $result | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($OutputPath, $json, [Text.UTF8Encoding]::new($false))

"Создано: $OutputPath"
"Вопросов: $($records.Count)"
"Пустых ответов: $($missingAnswers.Count)"
"Пустых памяток: $($missingTakeaways.Count)"
