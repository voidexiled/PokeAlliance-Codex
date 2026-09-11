[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputPath = (Join-Path $RepositoryRoot 'data\staging\pka-admin-wiki.pokemon-roster.json'),
    [string]$Url = 'https://wiki.pokealliance.com/api/pokemon'
)

$ErrorActionPreference = 'Stop'

function Get-TextDigest {
    param([Parameter(Mandatory)][string]$Text)

    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $stream = [IO.MemoryStream]::new($bytes)
    try {
        return (Get-FileHash -InputStream $stream -Algorithm SHA256).Hash
    }
    finally {
        $stream.Dispose()
    }
}

$response = Invoke-WebRequest -Uri $Url -UseBasicParsing
$text = [string]$response.Content
$payload = $text | ConvertFrom-Json -Depth 100
$records = @($payload.pokemon)

if ($records.Count -eq 0) {
    throw 'The public Pokémon roster did not return any records.'
}

$result = [ordered]@{
    schemaVersion = '0.1.0'
    generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    status = 'public_staging_snapshot'
    sourceId = 'source:pka-admin-wiki'
    sourceUrl = $Url
    retrieval = [ordered]@{
        httpStatus = [int]$response.StatusCode
        bytes = [Text.Encoding]::UTF8.GetByteCount($text)
        sha256 = Get-TextDigest -Text $text
        recordCount = $records.Count
    }
    fieldContract = @(
        'path', 'route', 'generation', 'number', 'name', 'displayName', 'image',
        'level', 'tier', 'displayTier', 'role', 'elements', 'variant', 'detailAvailable'
    )
    records = $records
    notes = @(
        'Public roster snapshot for comparison and tier exploration only.',
        'Records are not promoted to canonical normalized content by this importer.',
        'The snapshot does not include damage formulas, movesets, spawn coordinates or complete variant semantics.'
    )
}

$result | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8NoBOM
$result | ConvertTo-Json -Depth 100
