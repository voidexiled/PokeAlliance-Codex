[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Path,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$item = Get-Item -LiteralPath $Path
$payload = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -Depth 100
$members = @($payload.members)
$memberFields = if ($members.Count -gt 0) { @($members[0].PSObject.Properties | ForEach-Object Name) } else { @() }

$fieldProfiles = [ordered]@{}
foreach ($field in $memberFields) {
    $values = @($members | ForEach-Object { $_.$field })
    $nonNull = @($values | Where-Object { $null -ne $_ })
    $types = @($nonNull | ForEach-Object { $_.GetType().Name } | Sort-Object -Unique)
    $fieldProfiles[$field] = [ordered]@{
        presentInRows = $nonNull.Count
        type = ($types -join '|')
        storedInProfile = ($field -ne 'name')
    }
}

$stableIdCandidates = @('id', 'memberId', 'characterId', 'playerId', 'accountId')
$result = [ordered]@{
    schemaVersion = '0.1.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    sourcePath = $item.FullName
    sourceSizeBytes = $item.Length
    sourceModifiedAt = $item.LastWriteTimeUtc.ToString('o')
    sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    topLevelFields = @($payload.PSObject.Properties | ForEach-Object Name)
    memberCount = $members.Count
    memberFields = $fieldProfiles
    stableMemberIdCandidatesPresent = @($stableIdCandidates | Where-Object { $_ -in $memberFields })
    privacy = [ordered]@{
        memberNamesPersisted = $false
        rawExportPersisted = $false
    }
}

$json = $result | ConvertTo-Json -Depth 100
if ($OutputPath) {
    Set-Content -LiteralPath $OutputPath -Value $json -Encoding utf8NoBOM
}
$json
