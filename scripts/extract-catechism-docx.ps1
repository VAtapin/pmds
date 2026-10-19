param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputPath = (Join-Path $PSScriptRoot '..\content\catechism-questions.json')
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
    1  = 'Катехизис и вера'
    2  = 'Богопознание и Откровение'
    3  = 'Священное Предание'
    4  = 'Священное Писание'
    5  = 'Символ веры и Соборы'
    6  = 'Сущность Бога'
    7  = 'Свойства Божии'
    8  = 'Пресвятая Троица'
    9  = 'Лица Троицы'
    10 = 'Творение мира'
    11 = 'Ангельский мир'
    12 = 'Исповедание веры'
    13 = 'Человек и Промысл'
    14 = 'Христос и арианство'
    15 = 'Грехопадение'
    16 = 'Человечество Христа'
    17 = 'Две природы Христа'
    18 = 'Искупление'
    19 = 'Богородица'
    20 = 'Воскресение Христа'
    21 = 'Вознесение'
    22 = 'Святой Дух'
    23 = 'Церковь Христова'
    24 = 'Свойства Церкви'
    25 = 'Крещение и Миропомазание'
    26 = 'Евхаристия'
    27 = 'Другие Таинства'
    28 = 'Воскресение и вечность'
    29 = 'Второе Пришествие'
    30 = 'Схема Катехизиса'
}

$records = [System.Collections.Generic.List[object]]::new()
$current = $null

foreach ($paragraph in @(Get-DocxParagraphs -Path $InputPath)) {
    if ($paragraph.style -eq 'Heading1' -and $paragraph.text -match '^(\d{1,3})\.\s+(.+)$') {
        if ($current) {
            $current.answer = ($current.answerParagraphs -join "`n`n")
            $current.Remove('answerParagraphs')
            $records.Add([pscustomobject]$current)
        }

        $number = [int]$Matches[1]
        $current = [ordered]@{
            id               = "catechism-course-2-question-$number"
            course           = 2
            number           = $number
            question         = $Matches[2].Trim()
            source           = ''
            answer           = ''
            takeaway         = ''
            tags             = @($tagsByNumber[$number])
            answerParagraphs = [System.Collections.Generic.List[string]]::new()
        }
        continue
    }

    if (-not $current) {
        continue
    }

    if ($paragraph.style -eq 'Heading1') {
        break
    }

    if ($paragraph.style -eq 'SourceMap') {
        $current.source = $paragraph.text
        continue
    }

    if ($paragraph.style -eq 'AnswerLabel' -and $paragraph.text -eq 'Ответ') {
        continue
    }

    if ($paragraph.text -match '^Что запомнить:\s*(.+)$') {
        $current.takeaway = $Matches[1].Trim()
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
$missingSources = @($records | Where-Object { -not $_.source })
$unexpectedNumbers = @($records | Where-Object { -not $tagsByNumber.ContainsKey($_.number) })

if ($records.Count -ne 30 -or $missingAnswers.Count -or $missingTakeaways.Count -or $missingSources.Count -or $unexpectedNumbers.Count) {
    throw "Проверка извлечения не пройдена: вопросов=$($records.Count), без ответов=$($missingAnswers.Count), без памяток=$($missingTakeaways.Count), без исходных номеров=$($missingSources.Count), без тегов=$($unexpectedNumbers.Count)"
}

$result = [ordered]@{
    generatedAt  = (Get-Date).ToString('o')
    subject      = 'Катехизис Православной Церкви'
    counts       = [ordered]@{
        secondYear = $records.Count
        total      = $records.Count
    }
    verification = [ordered]@{
        expectedCount    = 30
        extractedCount   = $records.Count
        missingAnswers   = $missingAnswers.Count
        missingTakeaways = $missingTakeaways.Count
        missingSources   = $missingSources.Count
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
"Пустых исходных номеров: $($missingSources.Count)"
