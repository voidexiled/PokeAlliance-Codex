[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Path,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$item = Get-Item -LiteralPath $Path
$lines = Get-Content -LiteralPath $Path
$startMatch = $lines | Select-String -Pattern '^Minimap:\s*$' | Select-Object -First 1
if ($null -eq $startMatch) { throw 'Minimap block was not found.' }
$start = $startMatch.LineNumber
$endMatch = $lines | Select-String -Pattern '^last-used-character:' | Select-Object -First 1
$end = if ($null -ne $endMatch) { $endMatch.LineNumber - 1 } else { $lines.Count }

$records = [System.Collections.Generic.List[object]]::new()
$current = $null
for ($index = $start; $index -lt $end; $index++) {
    $line = $lines[$index]
    $entryMatch = [regex]::Match($line, '^\s+(\d+):\s*$')
    if ($entryMatch.Success -and $entryMatch.Groups[1].Value -ne 'flags') {
        if ($null -ne $current) { $records.Add([pscustomobject]$current) }
        $current = [ordered]@{ flagId = [int]$entryMatch.Groups[1].Value; description = $null; x = $null; y = $null; z = $null; icon = $null }
        continue
    }
    if ($null -eq $current) { continue }
    $descriptionMatch = [regex]::Match($line, '^\s+description:\s*(.*)$')
    if ($descriptionMatch.Success) { $current.description = $descriptionMatch.Groups[1].Value.Trim(); continue }
    $positionMatch = [regex]::Match($line, '^\s+position:\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$')
    if ($positionMatch.Success) {
        $current.x = [int]$positionMatch.Groups[1].Value
        $current.y = [int]$positionMatch.Groups[2].Value
        $current.z = [int]$positionMatch.Groups[3].Value
        continue
    }
    $iconMatch = [regex]::Match($line, '^\s+icon:\s*(-?\d+)\s*$')
    if ($iconMatch.Success) { $current.icon = [int]$iconMatch.Groups[1].Value }
}
if ($null -ne $current) { $records.Add([pscustomobject]$current) }

$result = [ordered]@{
    schemaVersion = '0.1.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    sourcePath = $item.FullName
    sourceSizeBytes = $item.Length
    sourceModifiedAt = $item.LastWriteTimeUtc.ToString('o')
    sourceSha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    sourceLocator = 'Minimap.flags in config.otml'
    recordCount = $records.Count
    records = @($records)
    limitations = @(
        'Records are client-local minimap markers and may reflect one account/client state.',
        'Descriptions and icons are not independently mapped to cities, regions or official entity IDs.',
        'Absence from this block does not prove absence from the game world.'
    )
}

$json = $result | ConvertTo-Json -Depth 100
if ($OutputPath) { Set-Content -LiteralPath $OutputPath -Value $json -Encoding utf8NoBOM }
$json
