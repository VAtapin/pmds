param(
    [Parameter(Mandatory=$true)][string]$DocumentPath,
    [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($DocumentPath)
try {
    $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { [xml]$document = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose() }
$ns = [Xml.XmlNamespaceManager]::new($document.NameTable)
$ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$paragraphs = @($document.SelectNodes('//w:body/w:p | //w:body/w:tbl/w:tr/w:tc/w:p', $ns) | ForEach-Object {
    $text = (($_.SelectNodes('.//w:t', $ns) | ForEach-Object InnerText) -join '').Trim()
    $style = $_.SelectSingleNode('./w:pPr/w:pStyle', $ns)
    if ($text) { [pscustomobject]@{text=$text; style=if($style){$style.val}else{''}} }
})
$keywords = @(
    'Поместные Соборы|Патриаршество|Тихон', 'Тихон|Гонения', 'Гонения|Советская власть',
    'Гонения|Обновленчество', 'Местоблюстительство|Сергий', 'Сергий|Советская власть',
    'Гонения|Новомученики', 'Великая Отечественная война|Сергий', 'Сергий|Патриаршество|Советская власть', 'Сергий|Патриаршество',
    'Алексий I|Поместные Соборы', 'Гонения|Советская власть', 'Пимен|Поместные Соборы|Крещение Руси',
    'Крещение Руси|Возрождение', 'Алексий II|Поместные Соборы|Возрождение', 'Кирилл|Поместные Соборы',
    'Патриаршество|Тихон|Сергий|Алексий I|Пимен|Алексий II|Кирилл', 'Поместные Соборы|Патриаршество',
    'Троице-Сергиева лавра|Возрождение', 'Данилов монастырь|Возрождение', 'Оптина пустынь|Возрождение',
    'Валаам|Возрождение', 'Соловки|Возрождение|Гонения', 'Монастыри в СССР', 'Возрождение|Данилов монастырь|Оптина пустынь|Валаам|Соловки',
    'Статус УПЦ|1990 год', 'Соборы УПЦ|Автокефалия', 'Соборы УПЦ|Харьковский Собор|Владимир',
    'Владимир', 'Украинское православие|1992 год', 'Киево-Печерская лавра|Возрождение',
    'Почаевская лавра|Монастыри в СССР', 'Святогорская лавра|Возрождение', 'Онуфрий|Соборы УПЦ',
    'Украинское православие|ПЦУ', 'Соборы УПЦ|Феофания|Статус УПЦ', 'Статус УПЦ|2024–2026',
    'Предстоятели УПЦ|Филарет|Владимир|Онуфрий', 'Соборы УПЦ|Автокефалия|Харьковский Собор|Феофания'
)
$questions = @(); $groups = @(); $section = ''; $sourceParagraphs = @(); $inSources = $false
for ($i=0; $i -lt $paragraphs.Count; $i++) {
    $p = $paragraphs[$i]
    if ($p.style -eq 'Heading1') {
        if ($p.text -eq 'Основные источники для проверки дат и формулировок') { $inSources=$true; continue }
        $section=$p.text
        $groups += [ordered]@{title=$section; tags=@()}
        continue
    }
    if ($inSources) { $sourceParagraphs += $p.text; continue }
    if ($p.style -ne 'Question') { continue }
    if ($p.text -notmatch '^(\d+)\.\s+(.+)$') { throw 'Invalid question heading' }
    $number=[int]$Matches[1]; $question=$Matches[2]
    if ($paragraphs[$i+1].text -notmatch '^Что запомнить:\s*(.+)$') { throw "Missing takeaway: $number" }
    $takeaway=$Matches[1]
    if ($paragraphs[$i+2].text -notmatch '^Коротко важное:\s*(.+)$') { throw "Missing answer: $number" }
    $answer=$Matches[1]
    $tags=@($keywords[$number-1].Split('|'))
    $questions += [ordered]@{id="church-history-$number"; number=$number; course=1; section=$section; question=$question; takeaway=$takeaway; answer=$answer; tags=$tags}
    $groups[-1].tags += $tags
    $i += 2
}
if (($questions.number -join ',') -ne ((1..39) -join ',')) { throw 'Expected questions 1-39' }
# Each keyword appears once in the cloud, but can match questions in several sections.
$seen = @{}
foreach ($group in $groups) {
    $group.tags = @($group.tags | Where-Object { if (-not $seen.ContainsKey($_)) { $seen[$_]=$true; $true } else { $false } })
}
if ($sourceParagraphs.Count -ne 17) { throw 'Expected source note and 16 references' }
$data = [ordered]@{
    title='История Русской Церкви и УПЦ'; sourceDocument=[IO.Path]::GetFileName($DocumentPath)
    period='1917–2026'; sourceDate='2026-10-03'
    courseMeta=@{'1'=@{title='История Русской Церкви и УПЦ'; kicker='ИЦ'; description='1917–2026 · 39 вопросов для устной подготовки к экзамену'; color='var(--course-3)'; soft='var(--course-3-soft)'}}
    filterGroups=$groups; questions=$questions; sourceParagraphs=$sourceParagraphs
}
$destination=Join-Path $PSScriptRoot '../content/church-history-questions.json'
$json=($data | ConvertTo-Json -Depth 12) + "`n"
if ($VerifyOnly) {
    $stored=Get-Content -Raw -LiteralPath $destination | ConvertFrom-Json
    if ($stored.questions.Count -ne $questions.Count) { throw 'Question count mismatch' }
    for ($i=0; $i -lt $questions.Count; $i++) {
        foreach ($field in @('number','question','takeaway','answer','section')) {
            if ($stored.questions[$i].$field -cne $questions[$i][$field]) { throw "Source mismatch: question $($i+1), $field" }
        }
    }
    if (($stored.sourceParagraphs -join "`n") -cne ($sourceParagraphs -join "`n")) { throw 'Source references mismatch' }
    'Verified all 39 questions, takeaways, answers and 17 source paragraphs against DOCX.'
} else {
    [IO.File]::WriteAllText($destination,$json,[Text.UTF8Encoding]::new($false))
    'Extracted 39 questions and 16 references.'
}
