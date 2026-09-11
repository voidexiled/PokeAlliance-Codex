[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputPath = (Join-Path $RepositoryRoot 'data\reports\public-map-source-profile.json')
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

function Get-JsonProfile {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$SourceId,
        [Parameter(Mandatory)][string]$Description
    )

    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
    $text = [string]$response.Content
    $json = $text | ConvertFrom-Json -Depth 100
    $items = if ($json -is [array]) { @($json) } elseif ($json.PSObject.Properties.Name -contains 'pokemon') { @($json.pokemon) } else { @($json) }
    $first = if ($items.Count -gt 0) { $items[0] } else { $null }
    $fieldNames = if ($first) { @($first.PSObject.Properties.Name) } else { @() }
    $coordinateFieldNames = @($fieldNames | Where-Object { $_ -match '(?i)^(x|y|z|floor|coordinates?|position|geometry|map|spawn)' })
    $numericCoordinatePatterns = [regex]::Matches($text, '"(?:x|y|z|floor)"\s*:\s*-?\d+', [Text.RegularExpressions.RegexOptions]::IgnoreCase).Count

    $topLevelFields = if ($json -is [array]) { @('array_payload') } else { @($json.PSObject.Properties.Name) }

    [ordered]@{
        id = $Id
        description = $Description
        sourceId = $SourceId
        url = $Url
        httpStatus = [int]$response.StatusCode
        bytes = [Text.Encoding]::UTF8.GetByteCount($text)
        sha256 = Get-TextDigest -Text $text
        recordCount = $items.Count
        topLevelFields = $topLevelFields
        firstRecordFields = $fieldNames
        coordinateFieldNames = $coordinateFieldNames
        numericCoordinateFieldHits = $numericCoordinatePatterns
    }
}

$communityCommit = '0135ccdef08109ff04dfc3343dbeb8fdfe9989b1'
$communityBase = "https://raw.githubusercontent.com/thiagobfo/pokealliance-wiki/$communityCommit/data"
$profiles = @(
    (Get-JsonProfile -Id 'official-pokemon-api' -SourceId 'source:pka-admin-wiki' -Description 'Official-candidate wiki roster API' -Url 'https://wiki.pokealliance.com/api/pokemon'),
    (Get-JsonProfile -Id 'community-locations' -SourceId 'source:thiagobfo-repository' -Description 'Pinned community location dataset' -Url "$communityBase/locations.json"),
    (Get-JsonProfile -Id 'community-hoenn-hunts' -SourceId 'source:thiagobfo-repository' -Description 'Pinned community hunt-location dataset' -Url "$communityBase/hoennHunts.json"),
    (Get-JsonProfile -Id 'community-tasks' -SourceId 'source:thiagobfo-repository' -Description 'Pinned community task/NPC lead dataset' -Url "$communityBase/tasks.json")
)

$result = [ordered]@{
    schemaVersion = '0.1.0'
    generatedAt = '2026-09-09T00:00:00-06:00'
    status = 'research_profile'
    profiles = $profiles
    semanticOnlySources = @(
        [ordered]@{
            id = 'official-teleport-guide'
            sourceId = 'source:pka-admin-wiki'
            url = 'https://wiki.pokealliance.com/tutoriais/como-usar-tp'
            kind = 'city_destination_guide'
            semanticFieldsObserved = @('region', 'city', 'destination', 'unlock_condition', 'teleport_command')
            structuredCoordinateFieldsObserved = $false
            notes = 'Useful for destination aliases and travel semantics only. It must not populate x/y/z map points.'
        },
        [ordered]@{
            id = 'community-hoenn-hunts-page'
            sourceId = 'source:lukkezin-community-wiki'
            url = 'https://pokealliance-wiki.vercel.app/hunts'
            kind = 'pokemon_hunt_map_link_index'
            semanticFieldsObserved = @('pokemon', 'types', 'hunt_scope', 'map_album_url')
            structuredCoordinateFieldsObserved = $false
            notes = 'Provides 137 Hoenn/Tubos hunt entries with external map-album links. Each image needs manual review before it can become a map claim.'
        }
    )
    sampledOfficialDetailPages = @(
        [ordered]@{ url = 'https://wiki.pokealliance.com/api/page/gen/1/063_abra'; inspectedFor = @('location', 'spawn', 'map', 'coordinate'); structuredCoordinateFieldsObserved = $false },
        [ordered]@{ url = 'https://wiki.pokealliance.com/api/page/gen/3/337_lunatone'; inspectedFor = @('location', 'spawn', 'map', 'coordinate'); structuredCoordinateFieldsObserved = $false },
        [ordered]@{ url = 'https://wiki.pokealliance.com/api/page/sistemas/pokelog'; inspectedFor = @('location', 'spawn', 'map', 'coordinate'); structuredCoordinateFieldsObserved = $false }
    )
    conclusions = @(
        'The public official roster endpoint is suitable for Pokémon identity staging, but it does not expose coordinate or location fields.',
        'Sampled official detail payloads contain prose and system information, but no structured spawn-coordinate table.',
        'Pinned community location-like datasets contain area labels or image links, not x/y/z coordinate records.',
        'The official teleport guide provides city, region and destination semantics, but no structured coordinate fields; it is a label/alias source only.',
        'The community Hoenn Hunts page provides 137 Pokémon entries and external map-album links, but the rendered index does not expose structured x/y/z coordinates.',
        'The interactive map can be built from the OTMM/config layers now; Pokémon location markers require a permitted client-visible capture or a later reviewed contribution.'
    )
}

$result | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8NoBOM
$result | ConvertTo-Json -Depth 100
