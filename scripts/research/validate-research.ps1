[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [switch]$WriteCoverageReport
)

$ErrorActionPreference = 'Stop'

function Read-JsonFile {
    param([Parameter(Mandatory)][string]$Path)
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -Depth 100
}

function Add-Issue {
    param([Parameter(Mandatory)][string]$Message)
    $script:issues.Add($Message)
}

$issues = [System.Collections.Generic.List[string]]::new()
$dataRoot = Join-Path $RepositoryRoot 'data'
$jsonFiles = @(Get-ChildItem -LiteralPath $dataRoot -Recurse -File -Filter '*.json')

foreach ($file in $jsonFiles) {
    try {
        $null = Read-JsonFile -Path $file.FullName
    }
    catch {
        Add-Issue "Invalid JSON: $($file.FullName): $($_.Exception.Message)"
    }
}

$sources = Read-JsonFile -Path (Join-Path $dataRoot 'research\sources.json')
$evidence = Read-JsonFile -Path (Join-Path $dataRoot 'research\evidence.json')
$matrices = Read-JsonFile -Path (Join-Path $dataRoot 'research\field-matrices.json')
$allowedAuthorities = @('first_party', 'official_candidate', 'community', 'historical', 'discovery_only')

foreach ($group in @($sources.sources | Group-Object id | Where-Object Count -gt 1)) {
    Add-Issue "Duplicate source ID: $($group.Name)"
}
foreach ($source in $sources.sources) {
    if ($source.authority -notin $allowedAuthorities) {
        Add-Issue "Unsupported authority '$($source.authority)' in $($source.id)"
    }
}

$sourceIds = @($sources.sources.id)
foreach ($group in @($evidence.evidence | Group-Object id | Where-Object Count -gt 1)) {
    Add-Issue "Duplicate evidence ID: $($group.Name)"
}
foreach ($item in $evidence.evidence) {
    if ($item.sourceId -notin $sourceIds) {
        Add-Issue "Evidence $($item.id) references missing source $($item.sourceId)"
    }
}

$evidenceIds = @($evidence.evidence.id)
$normalizedFiles = @(Get-ChildItem -LiteralPath (Join-Path $dataRoot 'normalized') -File -Filter '*.json')
foreach ($file in $normalizedFiles) {
    $collection = Read-JsonFile -Path $file.FullName
    if ($null -eq $collection.records) { continue }
    foreach ($record in $collection.records) {
        foreach ($factProperty in $record.facts.PSObject.Properties) {
            $fact = $factProperty.Value
            if (@($fact.evidenceIds).Count -eq 0) {
                Add-Issue "Normalized fact $($record.id).$($factProperty.Name) has no evidence IDs"
            }
            foreach ($evidenceId in @($fact.evidenceIds)) {
                if ($evidenceId -notin $evidenceIds) {
                    Add-Issue "Normalized fact $($record.id).$($factProperty.Name) references missing evidence $evidenceId"
                }
            }
        }
    }
}

$domainFiles = @{
    pokemon_variant = 'pokemon.sample.json'
    move = 'moves.sample.json'
    location_hunt = 'locations.sample.json'
    item = 'items.sample.json'
    quest = 'quests.sample.json'
    rotation_tier_assertion = 'rotation-tier-assertions.sample.json'
    map_feature = 'map-features.sample.json'
}
$domainResults = foreach ($domain in $matrices.domains) {
    $requiredFields = @(
        $domain.fieldGroups.identity
        $domain.fieldGroups.core
        $domain.fieldGroups.relationships
        $domain.fieldGroups.localized
    ) | Where-Object { $_ } | Select-Object -Unique

    $records = @()
    if ($domainFiles.ContainsKey($domain.domain)) {
        $domainCollection = Read-JsonFile -Path (Join-Path $dataRoot "normalized\$($domainFiles[$domain.domain])")
        $records = @($domainCollection.records)
    }
    $present = 0
    $possible = $records.Count * $requiredFields.Count
    foreach ($record in $records) {
        foreach ($field in $requiredFields) {
            if ($record.PSObject.Properties.Name -contains $field) {
                $present++
            }
            elseif ($record.facts -and $record.facts.PSObject.Properties.Name -contains $field) {
                $present++
            }
        }
    }

    [ordered]@{
        domain = $domain.domain
        recordCount = $records.Count
        requiredFieldCount = $requiredFields.Count
        presentFieldInstances = $present
        possibleFieldInstances = $possible
        measuredFieldCoveragePercent = if ($possible -gt 0) { [math]::Round(($present / $possible) * 100, 2) } else { 0 }
    }
}

$result = [ordered]@{
    schemaVersion = '0.1.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    jsonFilesParsed = $jsonFiles.Count
    sourceCount = @($sources.sources).Count
    evidenceCount = @($evidence.evidence).Count
    validationIssueCount = $issues.Count
    issues = @($issues)
    domains = @($domainResults)
    notes = @(
        'Coverage is measured only against normalized research records currently present in the repository.',
        'A zero can mean no normalized records exist yet; it does not mean the game domain has no data.',
        'Field-name mismatches are intentionally counted as missing until Phase 2 resolves the canonical model.'
    )
}

if ($WriteCoverageReport) {
    $reportPath = Join-Path $dataRoot 'reports\measured-coverage.json'
    $result | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $reportPath -Encoding utf8NoBOM
}

$result | ConvertTo-Json -Depth 100

if ($issues.Count -gt 0) {
    exit 1
}
