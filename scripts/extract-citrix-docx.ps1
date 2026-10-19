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
$ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$paragraphs = @($document.SelectNodes('//w:p',$ns) | ForEach-Object {
    ($_.SelectNodes('.//w:t',$ns) | ForEach-Object { $_.InnerText }) -join ''
} | Where-Object { $_.Trim() })
$keywords = @(
 'Selbstvorstellung','GLG|Motivation','Citrix-Erfahrung|Motivation','Citrix-Erfahrung|Einarbeitung','Stärken','Einarbeitung',
 'Virtual Apps','Architektur','Delivery Controller','VDA','StoreFront|Workspace','Machine Catalog','Delivery Group',
 'MCS|Master Image','PVS','MCS|PVS','Hypervisor','Master Image','Master Image|Updates',
 'Anwendungsstart','VDA|Registrierung','Anmeldung|Profile','Sitzung','Anwendungsperformance','VDA|Serverprobleme','Monitoring',
 'Active Directory|GPO','DNS','Profile','Änderungen|Rollback','Rufbereitschaft','Planung','Hochverfügbarkeit','Dokumentation','Unbekannte Details'
)
$questions = @()
$groups = @()
$group = $null
$current = $null
$readingAnswer = $false
$review = @()
$readingReview = $false
$closing = ''
foreach ($text in $paragraphs) {
    if ($text -match '^([A-F])\. (.+)$') {
        $current = $null
        $group = [ordered]@{id=$Matches[1];title=$Matches[2];description='';tags=@()}
        $groups += $group
    } elseif ($text -match '^(★\s*)?(\d+)\. (.+)$' -and -not $readingReview) {
        $number = [int]$Matches[2]
        $current = [ordered]@{id="citrix-$number";number=$number;important=[bool]$Matches[1];question=$Matches[3];takeaway='';answer='';group=$group.id;tags=@($keywords[$number-1].Split('|'))}
        $questions += $current
        $readingAnswer = $false
    } elseif ($text.StartsWith('Was muss ich mir merken?') -and $current) {
        $current.takeaway = $text.Substring('Was muss ich mir merken?'.Length).TrimStart()
    } elseif ($text -eq 'Etwas ausführlicher:' -and $current) {
        $readingAnswer = $true
    } elseif ($text -eq 'Kurz vor dem Gespräch – diese 12 Antworten müssen sitzen') {
        $current = $null
        $readingReview = $true
    } elseif ($readingReview -and $text -match '^\d+\. ') {
        $review += $text
    } elseif ($text.StartsWith('Wichtig für das Gespräch:')) {
        $closing = $text
    } elseif ($current -and $readingAnswer) {
        $current.answer += $(if ($current.answer) { "`n`n" } else { '' }) + $text
    } elseif ($group -and -not $current -and -not $readingReview) {
        $group.description = $text
    }
}
if ($questions.Count -ne 35 -or ($questions.number -join ',') -ne ((1..35) -join ',') -or $review.Count -ne 12) { throw 'Expected 35 questions and 12 review points' }
foreach ($item in $questions) { if (-not $item.takeaway -or -not $item.answer) { throw "Empty content for $($item.number)" } }
$usedTags = [System.Collections.Generic.HashSet[string]]::new()
foreach ($item in $groups) {
    $item.tags = @($questions | Where-Object {$_.group -eq $item.id} | ForEach-Object {$_.tags} | Select-Object -Unique | Where-Object {$usedTags.Add($_)})
}
$data = [ordered]@{title='GLG – Systemadministrator/in Citrix';sourceDocument=[System.IO.Path]::GetFileName($DocumentPath);intro=($paragraphs | Where-Object {$_.StartsWith('Lernstrategie:')} | Select-Object -First 1);questions=$questions;filterGroups=$groups;review=$review;closing=$closing}
$json = ($data | ConvertTo-Json -Depth 12) + "`n"
$root = Split-Path -Parent $PSScriptRoot
[System.IO.File]::WriteAllText((Join-Path $root 'content/citrix-questions.json'),$json,[System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $root 'dist/glg-citrix/questions.js'),"window.QUESTIONS_DATA = $json;`n",[System.Text.UTF8Encoding]::new($false))
Write-Output 'Extracted 35 questions, six groups and 12 review points.'
