param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$contentPath = Join-Path $projectRoot 'content\new-testament-questions.json'
$siteDataPath = Join-Path $projectRoot 'dist\novyi-zavet\questions.js'

function Convert-ToPlainText {
    param([string]$Value)

    return (($Value -replace '\*\*', '') -replace '\s+', ' ').Trim()
}

function Get-FilterGroupTitle {
    param(
        [int]$TicketNumber,
        [int]$ItemNumber
    )

    if ($ItemNumber -eq 1) {
        if ($TicketNumber -le 14) { return 'Основы и книги Нового Завета' }
        if ($TicketNumber -le 29) { return 'Рождество и начало служения' }
        return 'Земное служение и путь в Иерусалим'
    }

    if ($ItemNumber -eq 2) {
        if ($TicketNumber -le 20) { return 'Чудеса, притчи и поучения' }
        return 'Ученики, вера и последние наставления'
    }

    if ($TicketNumber -le 16) { return 'Иудея и Иерусалим' }
    if ($TicketNumber -le 32) { return 'Страсти и Крест' }
    return 'Воскресение и явления'
}

if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
    throw "Source file not found: $SourcePath"
}

$sourceText = Get-Content -LiteralPath $SourcePath -Raw -Encoding UTF8
$ticketPattern = '(?ms)^# БИЛЕТ №(?<number>\d+)\s*\r?\n(?<body>.*?)(?=^---\s*\r?\n\s*# БИЛЕТ №|\z)'
$itemPattern = '(?ms)^###\s+(?<item>\d+)\.\s+(?<question>[^\r\n]+?)\s*\r?\n\s*\*\*Что помнить:\*\*\s*(?<takeaway>.*?)\r?\n\s*\r?\n\*\*Ответ:\*\*\s*(?<answer>.*?)(?=^\s*###|^\s*---\s*$|\z)'
$ticketMatches = [regex]::Matches($sourceText, $ticketPattern)

$tickets = [System.Collections.Generic.List[object]]::new()
$filterGroups = [ordered]@{
    'Основы и книги Нового Завета' = [System.Collections.Generic.List[string]]::new()
    'Рождество и начало служения' = [System.Collections.Generic.List[string]]::new()
    'Земное служение и путь в Иерусалим' = [System.Collections.Generic.List[string]]::new()
    'Чудеса, притчи и поучения' = [System.Collections.Generic.List[string]]::new()
    'Ученики, вера и последние наставления' = [System.Collections.Generic.List[string]]::new()
    'Иудея и Иерусалим' = [System.Collections.Generic.List[string]]::new()
    'Страсти и Крест' = [System.Collections.Generic.List[string]]::new()
    'Воскресение и явления' = [System.Collections.Generic.List[string]]::new()
}

foreach ($ticketMatch in $ticketMatches) {
    $ticketNumber = [int]$ticketMatch.Groups['number'].Value
    $itemMatches = [regex]::Matches($ticketMatch.Groups['body'].Value, $itemPattern)
    $items = [System.Collections.Generic.List[object]]::new()

    foreach ($itemMatch in $itemMatches) {
        $itemNumber = [int]$itemMatch.Groups['item'].Value
        $question = Convert-ToPlainText $itemMatch.Groups['question'].Value
        $takeaway = Convert-ToPlainText $itemMatch.Groups['takeaway'].Value
        $answer = Convert-ToPlainText $itemMatch.Groups['answer'].Value
        $tag = $question.TrimEnd('.', '?', '!', ' ')
        $groupTitle = Get-FilterGroupTitle -TicketNumber $ticketNumber -ItemNumber $itemNumber

        $filterGroups[$groupTitle].Add($tag)
        $items.Add([pscustomobject][ordered]@{
            number = $itemNumber
            question = $question
            takeaway = $takeaway
            answer = $answer
            tag = $tag
        })
    }

    $tickets.Add([pscustomobject][ordered]@{
        id = "new-testament-ticket-$ticketNumber"
        course = 2
        number = $ticketNumber
        title = "Билет №$ticketNumber"
        tags = @($items | ForEach-Object { $_.tag })
        items = @($items)
    })
}

$expectedTickets = 1..40
$actualTickets = @($tickets | ForEach-Object { $_.number })
$invalidTickets = @($tickets | Where-Object { $_.items.Count -ne 3 })
$allItems = @($tickets | ForEach-Object { $_.items })
$duplicateTags = @($allItems | Group-Object tag | Where-Object Count -gt 1)

if ($ticketMatches.Count -ne 40) { throw "Expected 40 tickets, extracted $($ticketMatches.Count)." }
if (Compare-Object $expectedTickets $actualTickets) { throw 'Ticket numbers are not the complete sequence 1-40.' }
if ($invalidTickets.Count) { throw "Every ticket must contain 3 items. Invalid tickets: $($invalidTickets.number -join ', ')." }
if ($allItems.Count -ne 120) { throw "Expected 120 ticket items, extracted $($allItems.Count)." }
if (@($allItems | Where-Object { -not $_.question -or -not $_.takeaway -or -not $_.answer }).Count) { throw 'One or more ticket items are incomplete.' }
if ($duplicateTags.Count) { throw "Exact topic labels must be unique. Duplicates: $($duplicateTags.Name -join '; ')." }

$data = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    sourceFile = Split-Path -Leaf $SourcePath
    subject = 'Обзор Нового Завета'
    counts = [ordered]@{
        secondYear = 40
        total = 40
        ticketItems = 120
    }
    verification = [ordered]@{
        expectedTickets = 40
        extractedTickets = $tickets.Count
        expectedItems = 120
        extractedItems = $allItems.Count
        incompleteItems = 0
        duplicateExactTopics = 0
    }
    filterGroups = @($filterGroups.GetEnumerator() | ForEach-Object {
        [pscustomobject][ordered]@{
            title = $_.Key
            tags = @($_.Value)
        }
    })
    questions = @($tickets)
}

$json = $data | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($contentPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($siteDataPath, "window.QUESTIONS_DATA = $json;`n", [System.Text.UTF8Encoding]::new($false))

Write-Output "Extracted $($tickets.Count) tickets with $($allItems.Count) question-answer items."
Write-Output "Wrote: $contentPath"
Write-Output "Wrote: $siteDataPath"
