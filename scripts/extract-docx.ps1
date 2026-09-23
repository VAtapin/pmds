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

    $rules = [ordered]@{
        'Антропология' = 'антрополог|человек|человеческ|душ|тело|образ и подобие'
        'Грех' = 'грех|падени|зл[оауы]|смерт|тлен|наказани'
        'Христология' = 'христос|христа|иисус|христолог|воплощ|ипостасн|нестори|кирилл|монофиз|монофел|ариан|аполлинари|македони|монархиан|адопциони|модализм|савели|искуплен|богород|дева мари|феотокол'
        'Троица' = 'троиц|отец|сына|сын |святого дух|святой дух|ипостась|единосущ|filioque|монархия отца|македони'
        'Богопознание' = 'богопозн|откровени|апофат|катафат|свойств.*бож|вечност|неизменяем|вездеприсутств|всеведен|благость|правосуд|божественн.*сущност.*энерги'
        'Догмат и Предание' = 'догмат|предани|собор|священн.*писан'
        'Творение и Промысл' = 'творени|промысл|чудо|предведени|предопределени|свобод'
        'Ангелология' = 'ангел|духов|небесн.*иерарх'
    }

    $tags = [System.Collections.Generic.List[string]]::new()
    $primaryTag = if ($Course -eq 2) {
        if ($Number -le 3) { 'Догмат и Предание' }
        elseif ($Number -le 10 -or $Number -eq 18) { 'Богопознание' }
        elseif ($Number -le 17) { 'Троица' }
        else { 'Творение и Промысл' }
    }
    elseif ($Number -le 2) { 'Антропология' }
    elseif ($Number -le 8) { 'Грех' }
    elseif ($Number -le 30) { 'Христология' }
    else { 'Ангелология' }

    $tags.Add($primaryTag)
    foreach ($entry in $rules.GetEnumerator()) {
        if ($Question.ToLowerInvariant() -match $entry.Value -and -not $tags.Contains($entry.Key)) {
            $tags.Add($entry.Key)
        }
    }

    if ($tags.Count -eq 0) {
        $tags.Add('Общее богословие')
    }

    $tags.ToArray()
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
