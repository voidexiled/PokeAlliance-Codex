[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
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
$requiredFiles = @(
    'docs\DATA_MODEL.md',
    'docs\ARCHITECTURE.md',
    'data\schemas\canonical-record.schema.json',
    'data\fixtures\phase2-import-correction.json',
    'supabase\README.md',
    'supabase\migrations\202609090001_phase2_extensions_enums.sql',
    'supabase\migrations\202609090002_phase2_governance_imports.sql',
    'supabase\migrations\202609090003_phase2_domain_model.sql',
    'supabase\migrations\202609090004_phase2_content_guild_rls.sql',
    'supabase\migrations\202609100001_phase5_guild_daily_history.sql'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $relativePath) -PathType Leaf)) {
        Add-Issue "Missing Phase 2 artifact: $relativePath"
    }
}

$schemaPath = Join-Path $RepositoryRoot 'data\schemas\canonical-record.schema.json'
try {
    $schema = Read-JsonFile -Path $schemaPath
    $schemaRequired = @($schema.properties.records.items.required)
    foreach ($field in @('id', 'entityType', 'canonicalSlug', 'canonicalName', 'facts')) {
        if ($field -notin $schemaRequired) {
            Add-Issue "Canonical schema is missing required record field: $field"
        }
    }
}
catch {
    Add-Issue "Invalid canonical-record.schema.json: $($_.Exception.Message)"
}

$migrationRoot = Join-Path $RepositoryRoot 'supabase\migrations'
$migrations = @(Get-ChildItem -LiteralPath $migrationRoot -File -Filter '*.sql' | Sort-Object Name)
$expectedMigrationNames = @(
    '202609090001_phase2_extensions_enums.sql',
    '202609090002_phase2_governance_imports.sql',
    '202609090003_phase2_domain_model.sql',
    '202609090004_phase2_content_guild_rls.sql',
    '202609100001_phase5_guild_daily_history.sql',
    '20260910084452_restrict_guild_rpc_execute.sql',
    '20260910084612_optimize_guild_rls_and_event_trigger.sql'
)
if ((@($migrations.Name) -join '|') -ne ($expectedMigrationNames -join '|')) {
    Add-Issue 'Supabase migrations are missing or not in the expected order.'
}

$sql = ($migrations | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"
$requiredSqlTokens = @(
    'create extension if not exists pgcrypto',
    'create type public.entity_type as enum',
    'create table public.source_registry',
    'create table public.source_snapshots',
    'create table public.evidence_records',
    'create table public.import_runs',
    'create table public.staging_records',
    'create table public.entities',
    'create table public.pokemon_species',
    'create table public.pokemon_variants',
    'create table public.claims',
    'create table public.claim_evidence',
    'create table public.entity_source_keys',
    'create table public.sync_events',
    'create table public.map_features',
    'create table public.map_feature_relations',
    'create table public.content_documents',
    'create table public.content_revisions',
    'create table public.guilds',
    'create table public.guild_snapshots',
    'create table public.guild_member_observations',
    'create table public.guild_daily_exports',
    'create table public.guild_daily_export_revisions',
    'create table public.guild_daily_member_totals',
    'create view public.guild_daily_member_deltas',
    'replace_guild_daily_export',
    'unique (guild_id, observation_date)',
    'guild_alias_member_scope_fk',
    'guild_observation_snapshot_scope_fk',
    'guild_observation_member_scope_fk',
    'enable row level security'
)
$sqlLower = $sql.ToLowerInvariant()
foreach ($token in $requiredSqlTokens) {
    if (-not $sqlLower.Contains($token)) {
        Add-Issue "SQL contract token missing: $token"
    }
}

if ($sqlLower -match '(?m)\b(drop\s+schema|drop\s+table|truncate\s+)') {
    Add-Issue 'Phase 2 migrations contain a destructive schema/data operation.'
}

$dataModel = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'docs\DATA_MODEL.md') -Raw
$architecture = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'docs\ARCHITECTURE.md') -Raw
foreach ($term in @('provenance', 'Temporal', 'localization', 'guild', 'map_features', 'staging_records', 'RLS')) {
    if ($dataModel.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -lt 0 -and
        $architecture.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
        Add-Issue "Phase 2 documents do not mention required concern: $term"
    }
}

$workflowFixturePath = Join-Path $RepositoryRoot 'data\fixtures\phase2-import-correction.json'
try {
    $workflowFixture = Read-JsonFile -Path $workflowFixturePath
    $scenarioIds = @($workflowFixture.scenarios.id)
    foreach ($scenarioId in @(
        'wiki-staging-to-reviewed-quest',
        'same-source-digest-is-idempotent',
        'changed-claim-keeps-history',
        'guild-before-after-comparison'
    )) {
        if ($scenarioId -notin $scenarioIds) {
            Add-Issue "Workflow fixture is missing scenario: $scenarioId"
        }
    }

    $questStaging = Read-JsonFile -Path (Join-Path $RepositoryRoot 'data\staging\pka-admin-wiki.quest.sample.json')
    $questNormalized = Read-JsonFile -Path (Join-Path $RepositoryRoot 'data\normalized\quests.sample.json')
    if ($questStaging.sourceId -ne 'source:pka-admin-wiki') {
        Add-Issue 'Representative quest staging record has an unexpected source key.'
    }
    if ('staging:pka-admin-wiki:quest:porygon-dr-vektor' -notin @($questStaging.records.stagingId)) {
        Add-Issue 'Representative quest staging record is not present.'
    }
    if ('quest:porygon-dr-vektor' -notin @($questNormalized.records.id)) {
        Add-Issue 'Representative quest normalized record is not present.'
    }

    $mapSample = Read-JsonFile -Path (Join-Path $RepositoryRoot 'data\normalized\map-features.sample.json')
    $mapRecord = @($mapSample.records)[0]
    foreach ($coordinate in @('x', 'y', 'z')) {
        if ($coordinate -notin @($mapRecord.PSObject.Properties.Name)) {
            Add-Issue "Representative map fixture is missing coordinate: $coordinate"
        }
    }
    if ($mapRecord.visibility -ne 'client_minimap_flag') {
        Add-Issue 'Representative map fixture does not retain client-observed visibility.'
    }
}
catch {
    Add-Issue "Representative import/correction fixture validation failed: $($_.Exception.Message)"
}

$researchValidator = Join-Path $RepositoryRoot 'scripts\research\validate-research.ps1'
$researchValidationExit = 0
if (Test-Path -LiteralPath $researchValidator -PathType Leaf) {
    & $researchValidator -RepositoryRoot $RepositoryRoot | Out-Null
    # Invoking another PowerShell script does not reliably populate
    # $LASTEXITCODE. `$?` does reflect whether the script completed with a
    # successful exit status, including explicit `exit 1` failures.
    $researchValidationExit = if ($?) { 0 } else { 1 }
    if ($researchValidationExit -ne 0) {
        Add-Issue "Phase 1 research validator returned exit code $researchValidationExit."
    }
}
else {
    Add-Issue 'Phase 1 research validator is missing; representative import validation cannot run.'
}

$result = [ordered]@{
    schemaVersion = '0.1.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    phase = 2
    migrationCount = $migrations.Count
    requiredArtifactCount = $requiredFiles.Count
    workflowScenarioCount = if ($null -ne $workflowFixture) { @($workflowFixture.scenarios).Count } else { 0 }
    researchValidationExitCode = $researchValidationExit
    validationIssueCount = $issues.Count
    issues = @($issues)
    scope = @(
        'Static artifact, migration-order and contract-token audit.',
        'Existing Phase 1 research validator rerun.',
        'Remote migration application is verified separately through the Supabase CLI.'
    )
}

$reportPath = Join-Path $RepositoryRoot 'data\reports\phase2-model-validation.json'
$result | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $reportPath -Encoding utf8NoBOM
$result | ConvertTo-Json -Depth 100

if ($issues.Count -gt 0) {
    exit 1
}
