param([Parameter(Mandatory=$true)][string]$DocumentPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.FileStream]::new($DocumentPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Read)
try {
    $reader = [System.IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { [xml]$document = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose(); $stream.Dispose() }
$ns = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
$ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$paragraphs = @($document.SelectNodes('//w:p', $ns) | ForEach-Object {
    ($_.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
} | Where-Object { $_.Trim() })
$keywords = @('Грех|Прилог|Помыслы','Грех|Классификация грехов','Страсти|Самолюбие','Чревоугодие|Пост','Блуд|Целомудрие','Сребролюбие','Гнев|Смирение','Печаль|Покаяние','Уныние','Тщеславие','Гордость|Смирение','Прелесть|Смирение|Помыслы')
$questions = @()
for ($i = 0; $i -lt $paragraphs.Count; $i++) {
    if ($paragraphs[$i] -match '^(\d+)\. (.+)$') {
        $number = [int]$Matches[1]; $question = $Matches[2]
        if ($paragraphs[$i+1] -ne 'Что запомнить:') { throw "Missing takeaway for $number" }
        $points = @(); $j = $i+2
        while ($j -lt $paragraphs.Count -and -not $paragraphs[$j].StartsWith('Короткий ответ: ')) {
            if ($paragraphs[$j] -match '^\d+\. ') { throw "Missing answer for $number" }
            $points += $paragraphs[$j]; $j++
        }
        if ($j -ge $paragraphs.Count) { throw "Missing answer for $number" }
        $questions += [ordered]@{id="moral-$number";number=$number;topicNumber=$number;course=4;year=2;question=$question;tags=@($keywords[$number-11].Split('|'));takeaway=($points -join "`n");answer=$paragraphs[$j].Substring('Короткий ответ: '.Length)}
    }
}
if (($questions.number -join ',') -ne ((11..22) -join ',')) { throw 'Expected questions 11-22' }
$data = [ordered]@{
    title='Нравственное богословие';sourceDocument=[System.IO.Path]::GetFileName($DocumentPath)
    courseMeta=@{'4'=@{title='Второй год · 4 курс';description='Темы 11–22. Ответы составлены только по предоставленной лекции.';color='var(--course-3)';soft='var(--course-3-soft)'}}
    filterGroups=@(
        @{title='Грех и страсти';tags=@('Грех','Прилог','Помыслы','Классификация грехов','Страсти','Самолюбие')},
        @{title='Восемь главных страстей';tags=@('Чревоугодие','Блуд','Сребролюбие','Гнев','Печаль','Уныние','Тщеславие','Гордость')},
        @{title='Борьба и духовное рассуждение';tags=@('Пост','Целомудрие','Смирение','Покаяние','Прелесть')}
    )
    questions=$questions
}
$destination = Join-Path $PSScriptRoot '../content/moral-theology-questions.json'
[System.IO.File]::WriteAllText($destination, ($data | ConvertTo-Json -Depth 12) + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Output 'Extracted 12 lecture questions (11-22) with all takeaway points.'