param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = 'Stop'

$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$stream = [System.IO.File]::OpenRead($resolvedPath)
$reader = [System.IO.BinaryReader]::new($stream)

try {
    $signature = [System.Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
    if ($signature -ne 'OTMM') {
        throw "Unsupported signature '$signature'."
    }

    $dataStart = $reader.ReadUInt16()
    $version = $reader.ReadUInt16()
    $flags = $reader.ReadUInt32()
    if ($version -ne 1) {
        throw "Unsupported OTMM version '$version'."
    }

    $descriptionLength = $reader.ReadUInt16()
    $description = [System.Text.Encoding]::UTF8.GetString($reader.ReadBytes($descriptionLength))
    $stream.Position = $dataStart

    $blockSize = 64
    $tileBytes = 3
    $expectedBlockBytes = $blockSize * $blockSize * $tileBytes
    $floors = @{}
    $totalBlocks = 0
    $totalSeenTiles = [long]0
    $totalColoredTiles = [long]0
    $totalNotPathableTiles = [long]0
    $totalNotWalkableTiles = [long]0

    while ($stream.Position + 7 -le $stream.Length) {
        $x = $reader.ReadUInt16()
        $y = $reader.ReadUInt16()
        $z = $reader.ReadByte()

        if ($x -eq [uint16]::MaxValue -or $y -eq [uint16]::MaxValue -or $z -gt 15) {
            break
        }

        $compressedLength = $reader.ReadUInt16()
        if ($compressedLength -eq 0 -or $stream.Position + $compressedLength -gt $stream.Length) {
            throw "Invalid compressed block length at offset $($stream.Position - 2)."
        }

        $compressed = $reader.ReadBytes($compressedLength)
        $compressedStream = [System.IO.MemoryStream]::new($compressed, $false)
        $zlib = [System.IO.Compression.ZLibStream]::new(
            $compressedStream,
            [System.IO.Compression.CompressionMode]::Decompress
        )
        $decompressed = [System.IO.MemoryStream]::new()
        try {
            $zlib.CopyTo($decompressed)
        }
        finally {
            $zlib.Dispose()
            $compressedStream.Dispose()
        }

        $bytes = $decompressed.ToArray()
        $decompressed.Dispose()
        if ($bytes.Length -ne $expectedBlockBytes) {
            throw "Unexpected block size $($bytes.Length); expected $expectedBlockBytes."
        }

        $seenTiles = 0
        $coloredTiles = 0
        $notPathableTiles = 0
        $notWalkableTiles = 0
        for ($offset = 0; $offset -lt $bytes.Length; $offset += $tileBytes) {
            $tileFlags = $bytes[$offset]
            $color = $bytes[$offset + 1]
            if (($tileFlags -band 1) -ne 0) { $seenTiles++ }
            if ($color -ne 255) { $coloredTiles++ }
            if (($tileFlags -band 2) -ne 0) { $notPathableTiles++ }
            if (($tileFlags -band 4) -ne 0) { $notWalkableTiles++ }
        }

        if (-not $floors.ContainsKey($z)) {
            $floors[$z] = [ordered]@{
                z = [int]$z
                blocks = 0
                minX = [int]$x
                minY = [int]$y
                maxX = [int]($x + $blockSize - 1)
                maxY = [int]($y + $blockSize - 1)
                seenTiles = [long]0
                coloredTiles = [long]0
                notPathableTiles = [long]0
                notWalkableTiles = [long]0
            }
        }

        $floor = $floors[$z]
        $floor.blocks++
        $floor.minX = [Math]::Min($floor.minX, $x)
        $floor.minY = [Math]::Min($floor.minY, $y)
        $floor.maxX = [Math]::Max($floor.maxX, $x + $blockSize - 1)
        $floor.maxY = [Math]::Max($floor.maxY, $y + $blockSize - 1)
        $floor.seenTiles += $seenTiles
        $floor.coloredTiles += $coloredTiles
        $floor.notPathableTiles += $notPathableTiles
        $floor.notWalkableTiles += $notWalkableTiles

        $totalBlocks++
        $totalSeenTiles += $seenTiles
        $totalColoredTiles += $coloredTiles
        $totalNotPathableTiles += $notPathableTiles
        $totalNotWalkableTiles += $notWalkableTiles
    }

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedPath).Hash
    $file = Get-Item -LiteralPath $resolvedPath
    $result = [ordered]@{
        format = 'OTMM'
        formatVersion = $version
        description = $description
        headerFlags = $flags
        source = [ordered]@{
            path = $resolvedPath
            sizeBytes = $file.Length
            modifiedAt = $file.LastWriteTimeUtc.ToString('o')
            sha256 = $hash
        }
        blockSize = $blockSize
        tileRecordBytes = $tileBytes
        totalBlocks = $totalBlocks
        totalSeenTiles = $totalSeenTiles
        totalColoredTiles = $totalColoredTiles
        totalNotPathableTiles = $totalNotPathableTiles
        totalNotWalkableTiles = $totalNotWalkableTiles
        floors = @($floors.Values | Sort-Object z)
    }

    $result | ConvertTo-Json -Depth 6
}
finally {
    $reader.Dispose()
    $stream.Dispose()
}
