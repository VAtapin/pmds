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
    'НРД', 'Синкретизм', 'Классификация НРД', 'Сектоведение|Дворкин|Чернышев',
    'Спиритизм|Фокс', 'Спиритизм|Медиумы', 'Теософия|Блаватская', 'Теософия|Блаватская|Книги Блаватской',
    'Теософия|Синкретизм|Реинкарнация', 'Антропософия|Штайнер', 'Агни-йога|Рерихи',
    'New Age|Синкретизм', 'New Age', 'Трансцендентальная медитация|Махариши',
    'Асауляк|Синкретизм', 'Ивановцы|Порфирий Иванов|Детка', 'Ивановцы|Природа',
    'Белое братство|Синкретизм|Апокалиптика', 'Виссарион|Церковь Последнего Завета|Синкретизм',
    'Мунизм|Мун|Божественный принцип', 'Мунизм|Грехопадение', 'Мунизм|Истинные Родители',
    'Мормоны|Джозеф Смит', 'Мормоны|Книга Мормона', 'Свидетели Иеговы|Рассел', 'Свидетели Иеговы|Троица|Армагеддон',
    'Саентология|Хаббард|Дианетика', 'Саентология|Тэтан|Одитинг|Е-метр',
    'Харе Кришна|ISKCON|Прабхупада', 'Харе Кришна|Бхакти|Мантра', 'Аум Синрикё|Асахара|Апокалиптика',
    'Сатанизм|ЛаВей', 'Неоязычество',
    'Повторение|Основатели|Спиритизм|Теософия|Антропософия|Агни-йога|Ивановцы|Мунизм|Мормоны|Саентология|Харе Кришна',
    'Повторение|Даты|Спиритизм|Теософия|Мормоны|Мунизм|Саентология|Харе Кришна|Сатанизм|Белое братство|Виссарион'
)
$questions=@(); $groups=@(); $review=@(); $sources=@(); $section=''; $mode='questions'
foreach ($p in $paragraphs) {
    if ($p.text -eq 'Что выучить в первую очередь') { $mode='review'; continue }
    if ($p.text -eq 'Основные источники для проверки') { $mode='sources'; continue }
    if ($mode -eq 'review') { $review += $p.text; continue }
    if ($mode -eq 'sources') { $sources += $p.text; continue }
    if ($p.style -in @('Heading1','berschrift1')) {
        $section=$p.text
        $groups += [ordered]@{title=$section; tags=@()}
        continue
    }
    if ($p.style -eq 'Question') {
        if ($p.text -notmatch '^(\d+)\.\s+(.+)$') { throw 'Invalid question heading' }
        $number=[int]$Matches[1]; $question=$Matches[2]
        if ($number -lt 1 -or $number -gt $keywords.Count) { throw 'Unexpected question number' }
        $tags=@($keywords[$number-1].Split('|'))
        $questions += [ordered]@{id="religious-movements-$number"; number=$number; course=1; section=$section; question=$question; takeaway=''; answer=''; tags=$tags}
        $groups[-1].tags += $tags
        continue
    }
    if ($p.text -match '^Что запомнить:\s*(.+)$') { $questions[-1].takeaway=$Matches[1]; continue }
    if ($p.text -match '^Коротко важное:\s*(.+)$') { $questions[-1].answer=$Matches[1]; continue }
    if ($questions.Count) { throw "Unrecognized source paragraph: $($p.text)" }
}
if (($questions.number -join ',') -ne ((1..35) -join ',')) { throw 'Expected questions 1-35' }
if (@($questions | Where-Object {-not $_.answer -or -not $_.takeaway}).Count) { throw 'Incomplete question' }
if ($groups.Count -ne 6 -or $review.Count -ne 12 -or $sources.Count -ne 7) { throw 'Unexpected section, review or reference count' }
$seen=@{}
foreach ($group in $groups) {
    $group.tags=@($group.tags | Where-Object {if(-not $seen.ContainsKey($_)) {$seen[$_]=$true; $true} else {$false}})
}
$note=@($paragraphs | Where-Object {$_.text.StartsWith('Важно:')})
if ($note.Count -ne 1) { throw 'Expected source terminology note' }
$data=[ordered]@{
    title='Новые и нетрадиционные религиозные движения'
    sourceDocument=[IO.Path]::GetFileName($DocumentPath)
    sourceNote=$note[0].text
    courseMeta=@{'1'=@{title='Новые и нетрадиционные религиозные движения'; kicker='НРД'; description=$paragraphs[1].text; color='var(--course-3)'; soft='var(--course-3-soft)'}}
    filterGroups=$groups; questions=$questions; review=$review; sourceParagraphs=$sources
}
$destination=Join-Path $PSScriptRoot '../content/religious-movements-questions.json'
if ($VerifyOnly) {
    $stored=Get-Content -Raw -LiteralPath $destination | ConvertFrom-Json
    if ($stored.questions.Count -ne $questions.Count) { throw 'Question count mismatch' }
    for ($i=0; $i -lt $questions.Count; $i++) {
        foreach ($field in @('number','question','takeaway','answer','section')) {
            if ($stored.questions[$i].$field -cne $questions[$i][$field]) { throw "Source mismatch: question $($i+1), $field" }
        }
    }
    foreach ($field in @('review','sourceParagraphs','sourceNote')) {
        if (($stored.$field -join "`n") -cne ($data[$field] -join "`n")) { throw "Source mismatch: $field" }
    }
    'Verified all 35 questions, takeaways, answers, 12 review points, 7 references and terminology note against DOCX.'
} else {
    [IO.File]::WriteAllText($destination,($data | ConvertTo-Json -Depth 12)+"`n",[Text.UTF8Encoding]::new($false))
    'Extracted 35 questions, 12 review points and 7 references.'
}
