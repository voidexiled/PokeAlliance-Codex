$ErrorActionPreference = 'Stop'

$nodeCommand = Get-Command node -ErrorAction Stop
$process = Start-Process `
  -FilePath $nodeCommand.Source `
  -ArgumentList @('node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', '4321') `
  -WorkingDirectory (Get-Location).Path `
  -NoNewWindow `
  -PassThru `
  -Wait

exit $process.ExitCode
