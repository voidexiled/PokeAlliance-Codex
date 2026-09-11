[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Path,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Get-PlainText {
    param([AllowNull()][string]$Html)
    if ([string]::IsNullOrWhiteSpace($Html)) { return '' }
    $text = [regex]::Replace($Html, '<[^>]+>', ' ')
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    return ([regex]::Replace($text, '\s+', ' ')).Trim()
}

function Get-Hash {
    param([Parameter(Mandatory)][string]$Value)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') }
    finally { $sha.Dispose() }
}

$item = Get-Item -LiteralPath $Path
$feed = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -Depth 100
$news = @($feed.news)
$records = foreach ($entry in $news) {
    $body = [string]$entry.body
    $plainText = Get-PlainText -Html $body
    $headings = @([regex]::Matches($body, '<h[1-6][^>]*>(.*?)</h[1-6]>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) | ForEach-Object {
        (Get-PlainText -Html $_.Groups[1].Value)
    } | Where-Object { $_ })
    [ordered]@{
        id = [string]$entry.id
        category = [string]$entry.cat
        title = [string]$entry.title
        createdAt = [string]$entry.created_at
        bodySha256 = Get-Hash -Value $body
        bodyCharacterCount = $body.Length
        plainTextCharacterCount = $plainText.Length
        headingCount = $headings.Count
        headings = $headings
    }
}

$result = [ordered]@{
    schemaVersion = '0.1.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    sourcePath = $item.FullName
    sourceSizeBytes = $item.Length
    sourceModifiedAt = $item.LastWriteTimeUtc.ToString('o')
    sourceSha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    feedUpdatedAt = [string]$feed.updated_at
    bannerCount = @($feed.banners).Count
    newsCount = $news.Count
    records = @($records)
    rawBodiesPersisted = $false
}

$json = $result | ConvertTo-Json -Depth 100
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $json -Encoding utf8NoBOM
}
$json
