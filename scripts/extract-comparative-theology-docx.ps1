param(
    [Parameter(Mandatory = $true)][string]$FirstYearPath,
    [Parameter(Mandatory = $true)][string]$SecondYearPath,
    [Parameter(Mandatory = $true)][string]$CurriculumPath,
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\content\comparative-theology-questions.json')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
function Get-Paragraphs([string]$Path) {
    $stream = [IO.FileStream]::new($Path, 'Open', 'Read', [IO.FileShare]::ReadWrite)
    $archive = [IO.Compression.ZipArchive]::new($stream, 'Read')
    try {
        $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
        try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally { $archive.Dispose(); $stream.Dispose() }
    $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    foreach ($p in $xml.SelectNodes('//w:body/w:p | //w:body/w:tbl/w:tr/w:tc/w:p', $ns)) {
        $text = ($p.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
        if (-not $text) { continue }
        $s = $p.SelectSingleNode('./w:pPr/w:pStyle', $ns)
        [pscustomobject]@{ text=$text; style=$(if ($s) { $s.GetAttribute('val', $ns.LookupNamespace('w')) } else { '' }) }
    }
}
$questions = [Collections.Generic.List[object]]::new()
$courses = [Collections.Generic.List[object]]::new()
$groups = [Collections.Generic.List[object]]::new()
foreach ($spec in @(@{path=$FirstYearPath; course=3; year=1; count=48}, @{path=$SecondYearPath; course=4; year=2; count=46})) {
    $intro = [Collections.Generic.List[string]]::new()
    $review = [Collections.Generic.List[string]]::new()
    $sources = [Collections.Generic.List[string]]::new()
    $current=$null; $section=''; $tag=''; $mode='intro'; $sourceHeading=''
    foreach ($p in @(Get-Paragraphs $spec.path)) {
        if ($p.style -eq 'Heading1' -or $p.style -eq 'Heading2') {
            if ($current) {
                $current.takeaway = $current.takeawayParts -join "`n`n"
                $current.answer = $current.answerParts -join "`n`n"
                $current.Remove('takeawayParts'); $current.Remove('answerParts')
                $questions.Add([pscustomobject]$current); $current=$null
            }
            if ($p.style -eq 'Heading1') {
                if ($p.text -eq 'Что выучить в первую очередь') { $mode='review' }
                elseif ($p.text -in @('Источники','Основа документа')) { $mode='sources'; $sourceHeading=$p.text }
                else {
                    $section=$p.text; $tag=$section -replace '^[IVX]+\.\s*',''; $mode='section'
                    $groups.Add([pscustomobject]@{title=$tag; tags=@($tag)})
                }
            } elseif ($p.text -match '^(\d+)\.\s(.+)$') {
                $number=[int]$Matches[1]
                $current=[ordered]@{id="comparative-theology-course-$($spec.course)-question-$number";course=$spec.course;year=$spec.year;number=$number;section=$section;question=$Matches[2];takeaway='';answer='';tags=@($tag);takeawayParts=[Collections.Generic.List[string]]::new();answerParts=[Collections.Generic.List[string]]::new()}
                $mode='question'
            } else { throw "Не распознан вопрос: $($p.text)" }
            continue
        }
        if ($p.style -in @('RememberLabel','MemoryLabel')) {
            $mode='takeaway'
            if ($p.text -match '^Что запомнить: (.*)$') { $current.takeawayParts.Add($Matches[1]) }
            elseif ($p.text -ne 'Что запомнить') { throw "Не распознана памятка: $($p.text)" }
            continue
        }
        if ($p.style -eq 'ShortLabel') { $mode='answer'; continue }
        switch ($mode) {
            'intro' { $intro.Add($p.text) }
            'takeaway' { $current.takeawayParts.Add($p.text) }
            'answer' { $current.answerParts.Add($p.text) }
            'review' { $review.Add($p.text) }
            'sources' { $sources.Add($p.text) }
            default { throw "Не распознан абзац: $($p.text)" }
        }
    }
    $items=@($questions | Where-Object course -eq $spec.course)
    if ($items.Count -ne $spec.count -or @($items | Where-Object { -not $_.answer -or -not $_.takeaway }).Count) { throw 'Неполное извлечение материала' }
    for ($i=0; $i -lt $items.Count; $i++) { if ($items[$i].number -ne ($i+1)) { throw 'Нарушена нумерация' } }
    $courses.Add([pscustomobject]@{course=$spec.course;year=$spec.year;title="$($spec.year) год обучения · $($spec.course) курс";description=$(if($spec.year -eq 1){'Темы 1–12 учебной программы.'}else{'Темы 13–19 учебной программы.'});intro=@($intro);review=@($review);sourceHeading=$sourceHeading;sources=@($sources)})
}
# Shared topics use explicit source question ranges, without modifying source wording.
$shared = @(
    @{tag='Первородный грех'; first=@(28); second=@(7)},
    @{tag='Священное Писание и Предание'; first=@(40,41,42); second=@(10,30,34,36)},
    @{tag='Евхаристия'; first=@(36,39); second=@(16,19,24,35,46)}
)
foreach ($entry in $shared) {
    foreach ($q in $questions) {
        if (($q.course -eq 3 -and $q.number -in $entry.first) -or ($q.course -eq 4 -and $q.number -in $entry.second)) { $q.tags += $entry.tag }
    }
}
$sectionTags = @($groups | ForEach-Object { $_.tags[0] })
$groups.Clear()
foreach ($group in @(
    @{title='Введение и истоки';tags=@($sectionTags[0..2])},
    @{title='Католическое вероучение';tags=@($sectionTags[3..7])},
    @{title='Таинства, Предание и духовная жизнь';tags=@($sectionTags[8..10])},
    @{title='Реформация и протестантизм';tags=@($sectionTags[11..15])},
    @{title='Экуменическое движение';tags=@($sectionTags[16])},
    @{title='Общие темы двух курсов';tags=@($shared | ForEach-Object {$_.tag})}
)) { $groups.Add([pscustomobject]$group) }
# Exact source paragraphs establish the curriculum structure; ranges link to source question numbers.
$ranges=@(@(1,4),@(5,7),@(8,12),@(14,17),@(13,18),@(19,21),@(22,26),@(27,32),@(33,35),@(36,39),@(40,42),@(43,48),@(1,5),@(6,17),@(18,26),@(27,32),@(33,36),@(37,40),@(41,46))
$topics=[Collections.Generic.List[object]]::new(); $topic=$null
foreach ($p in @(Get-Paragraphs $CurriculumPath)) {
    if ($p.text -match '^Тема (\d+)\.') {
        $n=[int]$Matches[1]; $range=$ranges[$n-1]
        $topic=[pscustomobject]@{number=$n;course=$(if($n -le 12){3}else{4});title=$p.text;description=[Collections.Generic.List[string]]::new();questionNumbers=@($range[0]..$range[1])}
        $topics.Add($topic)
    } elseif ($topic -and $p.text -notmatch '^(РОЗДІЛ|2-й рік|ТЕМИ ТВОРІВ|Рекомендована література)') {
        $topic.description.Add($p.text)
    } else { $topic=$null }
    if ($topics.Count -eq 19 -and $p.text -match '^ТЕМИ ТВОРІВ') { break }
}
($topics | Where-Object number -eq 17).questionNumbers = @(7..17) + @(30,33,34,35,36)
($topics | Where-Object number -eq 18).questionNumbers = @(37..40) + @(43..46)
if ($topics.Count -ne 19) { throw 'Ожидалось 19 тем программы' }
$partialCoverage = @(
    @{topic=4;note='История папского примата дана обзорно: отдельные соборы, папы, Decretum Gelasianum, галликанизм и Lumen gentium подробно не разобраны.'},
    @{topic=5;note='Современная православно-католическая дискуссия о примате отдельно не раскрыта.'},
    @{topic=6;note='Исторические примеры ошибочных позиций пап упомянуты без разбора конкретных случаев.'},
    @{topic=7;note='Не раскрыты отдельно аргументы Григория Паламы и современное обсуждение Filioque.'},
    @{topic=11;note='Католические соборы и символические книги отдельно не разобраны.'},
    @{topic=12;note='Нет отдельного разбора адиафор и примеров молитвы из житий католических подвижников.'},
    @{topic=14;note='Биография Лютера дана кратко; современное состояние лютеранства отдельно не раскрыто.'},
    @{topic=15;note='Распространение кальвинизма за пределами Швейцарии и его современное состояние отдельно не раскрыты.'},
    @{topic=16;note='История православно-англиканских отношений отдельно не раскрыта.'},
    @{topic=19;note='Горизонтальный и вертикальный экуменизм, современные тенденции и перспективы участия во ВСЦ отдельно не раскрыты.'}
)
$result=[ordered]@{subject='Сравнительное богословие';counts=@{firstYear=48;secondYear=46;total=94};courses=@($courses);filterGroups=@($groups);verification=@{expectedCount=94;extractedCount=$questions.Count;partialCoverage=$partialCoverage;curriculumFile=[IO.Path]::GetFileName($CurriculumPath);topics=@($topics);note='Все 19 тем представлены; наличие вопросов по теме не означает полного раскрытия каждого подпункта программы.'};questions=@($questions)}
[IO.File]::WriteAllText($OutputPath, ($result | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
"Вопросов: $($questions.Count); тем программы: $($topics.Count)"
