param(
    [Parameter(Mandatory=$true)][string]$DocumentPath,
    [string]$PreviousContentPath = (Join-Path $PSScriptRoot "../content/religious-movements-previous.json"),
    [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [IO.FileStream]::new($DocumentPath, 'Open', 'Read', [IO.FileShare]::ReadWrite)
$archive = [IO.Compression.ZipArchive]::new($stream, 'Read')
try {
    $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { [xml]$document = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose(); $stream.Dispose() }
$ns = [Xml.XmlNamespaceManager]::new($document.NameTable)
$ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
function Get-Text($Node) { ($Node.SelectNodes('.//w:t', $ns) | ForEach-Object InnerText) -join '' }
$keywords = @(
    'НРД', 'НРД|Секта|Деструктивность', 'Деструктивность|Контроль', 'Синкретизм', 'Классификация НРД',
    'Спиритизм|Фокс', 'Спиритизм|Медиумы', 'Спиритизм|Эзотерика',
    'Теософия|Блаватская', 'Теософия|Блаватская|Книги Блаватской', 'Теософия|Синкретизм|Реинкарнация',
    'New Age|Синкретизм', 'New Age', 'Асауляк', 'Ивановцы|Порфирий Иванов', 'Ивановцы|Детка', 'Ивановцы|Природа',
    'Мунизм|Мун', 'Мунизм|Грехопадение', 'Мунизм|Христос', 'Мунизм|Истинные родители',
    'Мормоны|Джозеф Смит', 'Мормоны|Книга Мормона', 'Мормоны|Восстановление Церкви', 'Мормоны|Бог', 'Мормоны|Крещение за умерших',
    'Харе Кришна|ISKCON|Прабхупада', 'Харе Кришна|ISKCON|Вайшнавизм', 'Харе Кришна|Бхакти|Мантра', 'Карма|Сансара|Реинкарнация',
    'Саентология|Хаббард|Дианетика', 'Саентология|Тэтан|Одитинг|Е-метр|Инграмма|Клир', 'Саентология',
    'Herbalife|Коммерческие организации', 'Контроль|Культоподобное поведение', 'НРД|Общие мотивы', 'НРД|Секуляризация', 'Лидерство', 'Изменение человека',
    'Православие|Бог|Эзотерика', 'Православие|Творец и творение', 'Православие|Воскресение|Реинкарнация', 'Православие|Грехопадение|Грех и неведение',
    'Православие|Христос', 'Православие|Христианская терминология', 'Православие|Пастырский подход',
    'Антропософия|Штайнер', 'Агни-йога|Рерихи', 'Белое братство', 'Виссарион|Церковь Последнего Завета',
    'Свидетели Иеговы|Рассел', 'Трансцендентальная медитация|Махариши', 'Аум Синрикё|Асахара', 'Сатанизм|ЛаВей', 'Неоязычество'
)
$questions=@(); $groups=@(); $review=@(); $sources=@(); $intro=@(); $contents=@(); $sectionNotes=@(); $chronology=@()
$section=''; $mode='intro'; $note=''; $reviewHeading=''; $sourcesHeading=''; $chronologyHeading=''
foreach ($node in $document.SelectNodes('//w:body/*', $ns)) {
    if ($node.LocalName -eq 'tbl') {
        if ($mode -ne 'chronology') { throw 'Unexpected source table' }
        foreach ($row in $node.SelectNodes('./w:tr', $ns)) {
            $cells=@($row.SelectNodes('./w:tc', $ns) | ForEach-Object {
                ($_.SelectNodes('./w:p', $ns) | ForEach-Object { Get-Text $_ }) -join "`n"
            })
            if ($cells.Count -ne 2) { throw 'Expected two chronology columns' }
            $chronology += ,$cells
        }
        continue
    }
    if ($node.LocalName -ne 'p') { continue }
    $text = Get-Text $node
    if (-not $text) { continue }
    $style = $node.SelectSingleNode('./w:pPr/w:pStyle', $ns)
    $styleName = if ($style) { $style.val } else { '' }
    if ($styleName -eq 'Heading1') {
        if ($text -eq 'Содержание') { $mode='contents' }
        elseif ($text -eq 'Хронология: опорные даты') { $mode='chronology'; $chronologyHeading=$text }
        elseif ($text -eq 'Что запомнить в первую очередь') { $mode='review'; $reviewHeading=$text }
        elseif ($text -eq 'Основные источники и рамки работы') { $mode='sources'; $sourcesHeading=$text }
        else { $section=$text; $mode='questions'; $groups += [ordered]@{title=$section; tags=@()} }
        continue
    }
    if ($styleName -eq 'Heading2') {
        if ($text -notmatch '^Вопрос (\d+)\. (.+)$') { throw "Invalid question heading: $text" }
        $number=[int]$Matches[1]; $question=$Matches[2]
        if ($number -lt 1 -or $number -gt $keywords.Count) { throw 'Unexpected question number' }
        $tags=@($keywords[$number-1].Split('|'))
        $questions += [ordered]@{id="religious-movements-$number"; number=$number; course=1; section=$section; question=$question; takeaway=''; answer=''; tags=$tags}
        $groups[-1].tags += $tags
        continue
    }
    switch ($mode) {
        'intro' { if ($styleName -eq 'Quote') { $note=$text } else { $intro += $text } }
        'contents' { $contents += $text }
        'review' { $review += $text }
        'sources' { $sources += $text }
        'questions' {
            if ($text -match '^Краткий ответ\. (.+)$') { $questions[-1].takeaway=$Matches[1] }
            elseif ($text -match '^Расширенный ответ\. (.+)$') { $questions[-1].answer=$Matches[1] }
            elseif ($text -eq 'Дополнительные темы из прежнего конспекта; преподаватель не разбирал их подробно в этой лекции.') { $sectionNotes += @{section=$section; text=$text} }
            else { throw "Unrecognized source paragraph: $text" }
        }
        default { throw "Unrecognized source paragraph: $text" }
    }
}
if (($questions.number -join ',') -ne ((1..55) -join ',')) { throw 'Expected questions 1-55' }
if (@($questions | Where-Object {-not $_.answer -or -not $_.takeaway}).Count) { throw 'Incomplete question' }
if ($groups.Count -ne 8 -or $review.Count -ne 12 -or $sources.Count -ne 5 -or $chronology.Count -ne 16 -or $sectionNotes.Count -ne 1 -or -not $note) { throw 'Unexpected supplementary content' }
$previous = [IO.File]::ReadAllText((Resolve-Path $PreviousContentPath),[Text.Encoding]::UTF8) | ConvertFrom-Json
if ($previous.questions.Count -ne 35) { throw 'Expected 35 previous questions' }
# Each prior question stays verbatim, linked once to a matching new topic.
$parents=@(1,4,5,1,6,7,9,10,11,47,48,12,13,52,14,15,17,49,50,18,19,20,22,23,51,51,31,32,27,29,53,54,55)
foreach ($q in $questions) {
    $related=@($previous.questions | Where-Object { $_.number -le 33 -and $parents[$_.number-1] -eq $q.number })
    $q['previousQuestionNumbers']=@($related | ForEach-Object number)
    foreach ($old in $related) { $q.tags += $old.tags }
    $q.tags=@($q.tags | Select-Object -Unique)
    $group=$groups | Where-Object title -eq $q.section
    $group.tags += $q.tags
}
# Canonical spelling applies only to navigation tags; source texts remain intact.
$tagLabels=@{}
foreach ($q in $questions) {
    $q.tags=@($q.tags | ForEach-Object {
        if (-not $tagLabels.ContainsKey($_)) { $tagLabels[$_]=$_ }
        $tagLabels[$_]
    } | Select-Object -Unique)
}
foreach ($group in $groups) { $group.tags=@($questions | Where-Object section -eq $group.title | ForEach-Object { $_.tags }) }
$seen=@{}
foreach ($group in $groups) {
    $group.tags=@($group.tags | Where-Object {if(-not $seen.ContainsKey($_)) {$seen[$_]=$true; $true} else {$false}})
}
$data=[ordered]@{
    title='Новые и нетрадиционные религиозные движения'
    sourceDocument=[IO.Path]::GetFileName($DocumentPath)
    sourceNote=$note
    previousMaterial=$previous
    previousReviewQuestionNumbers=@(34,35)
    introduction=$intro
    contents=$contents
    sectionNotes=$sectionNotes
    answerLabels=@{short='Краткий ответ'; expanded='Расширенный ответ'}
    courseMeta=@{'1'=@{title='Новые и нетрадиционные религиозные движения'; kicker='НРД'; description=$intro[1]; color='var(--course-3)'; soft='var(--course-3-soft)'}}
    filterGroups=$groups; questions=$questions; review=$review; reviewHeading=$reviewHeading
    sourceParagraphs=$sources; sourcesHeading=$sourcesHeading; chronology=$chronology; chronologyHeading=$chronologyHeading
}
$destination=Join-Path $PSScriptRoot '../content/religious-movements-questions.json'
$json=($data | ConvertTo-Json -Depth 12)+"`n"
if ($VerifyOnly) {
    $stored=[IO.File]::ReadAllText((Resolve-Path $destination),[Text.Encoding]::UTF8) | ConvertFrom-Json
    if ($stored.questions.Count -ne 55) { throw 'Question count mismatch' }
    for ($i=0; $i -lt $questions.Count; $i++) {
        foreach ($field in @('id','number','course','question','takeaway','answer','section','tags','previousQuestionNumbers')) {
            if (($stored.questions[$i].$field -join "`n") -cne ($questions[$i][$field] -join "`n")) { throw "Source mismatch: question $($i+1), $field" }
        }
    }
    foreach ($field in @('title','sourceDocument','sourceNote','introduction','contents','review','reviewHeading','sourceParagraphs','sourcesHeading','chronologyHeading')) {
        if (($stored.$field -join "`n") -cne ($data[$field] -join "`n")) { throw "Source mismatch: $field" }
    }
    if (($stored.chronology | ConvertTo-Json -Depth 4) -cne ($chronology | ConvertTo-Json -Depth 4)) { throw 'Chronology mismatch' }
    if ($stored.sectionNotes.Count -ne 1 -or $stored.sectionNotes[0].text -cne $sectionNotes[0].text -or $stored.sectionNotes[0].section -cne $sectionNotes[0].section) { throw 'Section note mismatch' }
    for ($i=0; $i -lt $groups.Count; $i++) {
        if ($stored.filterGroups[$i].title -cne $groups[$i].title -or ($stored.filterGroups[$i].tags -join "`n") -cne ($groups[$i].tags -join "`n")) { throw 'Filter group mismatch' }
    }
    if (($stored.previousMaterial | ConvertTo-Json -Depth 12) -cne ($previous | ConvertTo-Json -Depth 12)) { throw 'Previous material mismatch' }
    'Verified 55 questions, exact answers, eight sections, chronology, introduction, review and references against DOCX.'
} else {
    [IO.File]::WriteAllText($destination,$json,[Text.UTF8Encoding]::new($false))
    'Extracted 55 questions, eight sections, 15 chronology rows, 12 review points and five source paragraphs.'
}
