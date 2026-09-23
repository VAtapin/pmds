param(
    [Parameter(Mandatory = $true)]
    [string]$ThirdYearQuestions,

    [Parameter(Mandatory = $true)]
    [string]$ThirdYearAnswers,

    [Parameter(Mandatory = $true)]
    [string]$SecondYearAnswers,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
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
        if ($text) {
            $text
        }
    }
}

function Normalize-Question {
    param([string]$Text)

    $normalized = $Text.ToLowerInvariant()
    $normalized = [regex]::Replace($normalized, '^\s*\d+[\.)]\s*', '')
    $normalized = $normalized.Replace('ё', 'е')
    $normalized = [regex]::Replace($normalized, '[^\p{L}\p{N}]+', ' ')
    [regex]::Replace($normalized, '\s+', ' ').Trim()
}

function Get-QuestionRecords {
    param(
        [string[]]$Paragraphs,
        [int]$Course
    )

    $records = [System.Collections.Generic.List[object]]::new()
    $current = $null

    foreach ($paragraph in $Paragraphs) {
        if ($paragraph -match '^\s*(\d{1,3})[\.)]\s+(.+)$') {
            if ($current) {
                $records.Add([pscustomobject]$current)
            }

            $current = [ordered]@{
                id       = "course-$Course-question-$($Matches[1])"
                course   = $Course
                number   = [int]$Matches[1]
                question = $Matches[2].Trim()
                answer   = ''
                takeaway = ''
            }
            continue
        }

        if (-not $current) {
            continue
        }

        if ($paragraph -match '^Запомнить:\s*(.+)$') {
            $current.takeaway = $Matches[1].Trim()
            continue
        }

        if ($paragraph -match '^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+' -or $paragraph -eq 'Итоговая схема для быстрого повторения' -or $paragraph.StartsWith('•')) {
            continue
        }

        if ($current.answer) {
            $current.answer += "`n`n$paragraph"
        }
        else {
            $current.answer = $paragraph
        }
    }

    if ($current) {
        $records.Add([pscustomobject]$current)
    }

    $records
}

function Get-Tags {
    param(
        [string]$Question,
        [int]$Course,
        [int]$Number
    )

    $primaryTag = if ($Course -eq 2) {
        if ($Number -le 2) { 'Богословие' }
        elseif ($Number -eq 3) { 'Свойства догматов' }
        elseif ($Number -eq 4) { 'Догмат и ересь' }
        elseif ($Number -eq 5) { 'Формулы и термины' }
        elseif ($Number -eq 6) { 'Системы' }
        elseif ($Number -eq 7) { 'Возникновение догматов' }
        elseif ($Number -eq 8) { 'Раскрытие догматов' }
        elseif ($Number -eq 9) { 'Назначение догматов' }
        elseif ($Number -eq 10) { 'Усвоение догматов' }
        elseif ($Number -eq 11) { 'Догматическое развитие' }
        elseif ($Number -le 15) { 'Предание' }
        elseif ($Number -eq 16) { 'Пути богопознания' }
        elseif ($Number -eq 17) { 'Аэций' }
        elseif ($Number -eq 18) { 'Евномий' }
        elseif ($Number -eq 19) { 'Познаваемость Бога' }
        elseif ($Number -eq 20) { 'Варлаам' }
        elseif ($Number -eq 21) { 'Григорий Палама' }
        elseif ($Number -eq 22) { 'Апофатика и катафатика' }
        elseif ($Number -eq 23) { 'Апофатические свойства' }
        elseif ($Number -eq 24) { 'Катафатические свойства' }
        elseif ($Number -le 27) { 'Догмат о Троице' }
        elseif ($Number -eq 28) { 'Апологеты' }
        elseif ($Number -eq 29) { 'Монархианство' }
        elseif ($Number -eq 30) { 'Ориген' }
        elseif ($Number -eq 31) { 'Арианство' }
        elseif ($Number -eq 32) { 'Афанасий Великий' }
        elseif ($Number -eq 33) { 'Духоборчество' }
        elseif ($Number -eq 34) { 'Каппадокийцы' }
        elseif ($Number -eq 35) { 'Бог Отец' }
        elseif ($Number -eq 36) { 'Бог Сын' }
        elseif ($Number -eq 37) { 'Святой Дух' }
        elseif ($Number -eq 38) { 'Filioque' }
        elseif ($Number -eq 39) { 'Дуализм и пантеизм' }
        elseif ($Number -le 42) { 'Творение из ничего' }
        elseif ($Number -eq 43) { 'Троица и творение' }
        elseif ($Number -le 45) { 'Цель и совершенство творения' }
        elseif ($Number -le 49) { 'Промысл' }
        elseif ($Number -le 52) { 'Ангелы' }
        elseif ($Number -eq 53) { 'Злые духи' }
        elseif ($Number -eq 54) { 'Образ и подобие' }
        elseif ($Number -eq 55) { 'Душа, дух и тело' }
        elseif ($Number -eq 56) { 'Первоначальный человек' }
        elseif ($Number -le 58) { 'Причины грехопадения' }
        elseif ($Number -le 60) { 'Последствия грехопадения' }
        elseif ($Number -le 63) { 'Первородный и личный грех' }
        elseif ($Number -eq 64) { 'Пелагий' }
        else { 'Августин' }
    }
    elseif ($Number -eq 1) { 'Образ и подобие' }
    elseif ($Number -eq 2) { 'Душа, дух и тело' }
    elseif ($Number -eq 3) { 'Сущность грехопадения' }
    elseif ($Number -eq 4) { 'Последствия грехопадения' }
    elseif ($Number -le 7) { 'Первородный грех' }
    elseif ($Number -eq 8) { 'Наказание после падения' }
    elseif ($Number -le 11) { 'Человечество Христа' }
    elseif ($Number -eq 12) { 'Апологеты и Ориген' }
    elseif ($Number -eq 13) { 'Монархианство' }
    elseif ($Number -eq 14) { 'Арианство' }
    elseif ($Number -eq 15) { 'Аполлинарий' }
    elseif ($Number -eq 16) { 'Македоний' }
    elseif ($Number -eq 17) { 'Несторий' }
    elseif ($Number -eq 18) { 'Кирилл Александрийский' }
    elseif ($Number -eq 19) { 'Монофизитство' }
    elseif ($Number -le 22) { 'Ипостасное соединение' }
    elseif ($Number -eq 23) { 'Монофелитство' }
    elseif ($Number -eq 24) { 'Христос и Троица' }
    elseif ($Number -le 26) { 'Богородица' }
    elseif ($Number -le 30) { 'Искупление' }
    elseif ($Number -le 35) { 'Ангелы' }
    else { 'Злые духи' }

    @($primaryTag)
}

$thirdQuestionParagraphs = @(Get-DocxParagraphs -Path $ThirdYearQuestions)
$thirdAnswerParagraphs = @(Get-DocxParagraphs -Path $ThirdYearAnswers)
$secondAnswerParagraphs = @(Get-DocxParagraphs -Path $SecondYearAnswers)

$thirdListedQuestions = @($thirdQuestionParagraphs | Select-Object -Skip 1)
$thirdRecords = @(Get-QuestionRecords -Paragraphs $thirdAnswerParagraphs -Course 3)
$secondRecords = @(Get-QuestionRecords -Paragraphs $secondAnswerParagraphs -Course 2)

$mismatches = [System.Collections.Generic.List[object]]::new()
$maxThird = [Math]::Max($thirdListedQuestions.Count, $thirdRecords.Count)
for ($index = 0; $index -lt $maxThird; $index++) {
    $listed = if ($index -lt $thirdListedQuestions.Count) { $thirdListedQuestions[$index] } else { $null }
    $answered = if ($index -lt $thirdRecords.Count) { $thirdRecords[$index].question } else { $null }
    if ((Normalize-Question -Text ([string]$listed)) -ne (Normalize-Question -Text ([string]$answered))) {
        $mismatches.Add([pscustomobject]@{
            position = $index + 1
            listed   = $listed
            answered = $answered
        })
    }
}

$allRecords = @($secondRecords + $thirdRecords | ForEach-Object {
    $_ | Add-Member -NotePropertyName tags -NotePropertyValue @(Get-Tags -Question $_.question -Course $_.course -Number $_.number) -PassThru
})

$result = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    counts      = [ordered]@{
        secondYear = $secondRecords.Count
        thirdYear  = $thirdRecords.Count
        total      = $allRecords.Count
    }
    verification = [ordered]@{
        thirdYearListedCount = $thirdListedQuestions.Count
        thirdYearAnswerCount = $thirdRecords.Count
        mismatches           = $mismatches
    }
    questions   = $allRecords
}

$json = $result | ConvertTo-Json -Depth 8
$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}
[IO.File]::WriteAllText($OutputPath, $json, [Text.UTF8Encoding]::new($false))

$result.counts | Format-List
"Несовпадений в вопросах 3 курса: $($mismatches.Count)"
if ($mismatches.Count -gt 0) {
    $mismatches | Format-Table -Wrap
}
