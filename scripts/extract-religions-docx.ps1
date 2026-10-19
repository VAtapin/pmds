param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputPath = (Join-Path $PSScriptRoot '..\content\religions-questions.json')
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
    1  = 'Религия'
    2  = 'Ранние верования'
    3  = 'Древний Египет'
    4  = 'Месопотамия'
    5  = 'Индуизм'
    6  = 'Древняя Греция'
    7  = 'Иудаизм'
    8  = 'Древний Рим'
    9  = 'Буддизм'
    10 = 'Конфуцианство'
    11 = 'Даосизм'
    12 = 'Ислам'
    13 = 'Синтоизм'
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
            id               = "religions-course-2-question-$number"
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

    if (-not $current) {
        continue
    }

    if ($paragraph.style -eq 'Heading1') {
        break
    }

    if ($paragraph.text -match '^Что запомнить:\s*(.+)$') {
        $current.takeaway = $Matches[1].Trim()
        continue
    }

    if ($paragraph.text -eq 'Расширенно') {
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

if ($records.Count -ne 13 -or $missingAnswers.Count -or $missingTakeaways.Count -or $unexpectedNumbers.Count) {
    throw "Проверка извлечения не пройдена: вопросов=$($records.Count), без ответов=$($missingAnswers.Count), без памяток=$($missingTakeaways.Count), без тегов=$($unexpectedNumbers.Count)"
}

$result = [ordered]@{
    generatedAt  = (Get-Date).ToString('o')
    subject      = 'Теория и история нехристианских религий'
    counts       = [ordered]@{
        secondYear = $records.Count
        total      = $records.Count
    }
    verification = [ordered]@{
        expectedCount   = 13
        extractedCount  = $records.Count
        missingAnswers  = $missingAnswers.Count
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
