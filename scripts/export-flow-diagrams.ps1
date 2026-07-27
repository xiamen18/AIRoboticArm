param(
  [string]$Source = '',
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\docs\flows'),
  [string]$Drawio = "$env:LOCALAPPDATA\Programs\draw.io\draw.io.exe"
)

$ErrorActionPreference = 'Stop'

if (-not $Source) {
  $Source = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '..\docs\flows') -Filter '*.drawio' |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Draw.io source file not found: $Source"
}
if (-not (Test-Path -LiteralPath $Drawio)) {
  throw "draw.io executable not found: $Drawio"
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

[xml]$sourceXml = Get-Content -LiteralPath $Source -Raw -Encoding UTF8
$sourceDiagrams = @($sourceXml.mxfile.diagram)
if ($sourceDiagrams.Count -lt 2) {
  throw 'The source diagram must contain at least two pages.'
}

$tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$tempDirectory = Join-Path $tempBase ("armmatch-flow-export-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDirectory | Out-Null

function Export-Svg {
  param(
    [string]$InputFile,
    [string]$OutputFile,
    [int]$PageIndex = 1
  )

  $arguments = @(
    '--export',
    '--format', 'svg',
    '--crop',
    '--border', '16',
    '--theme', 'light',
    '--embed-svg-fonts', 'false',
    '--page-index', [string]$PageIndex,
    '--output', ('"{0}"' -f $OutputFile),
    ('"{0}"' -f $InputFile)
  )
  $process = Start-Process `
    -FilePath $Drawio `
    -ArgumentList $arguments `
    -WindowStyle Hidden `
    -Wait `
    -PassThru

  if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $OutputFile)) {
    throw "draw.io export failed for $InputFile"
  }

  $svg = Get-Content -LiteralPath $OutputFile -Raw -Encoding UTF8
  if ($svg -notmatch 'data-flow-background') {
    $svg = $svg -replace '(<svg\b[^>]*>)', '$1<rect data-flow-background="true" width="100%" height="100%" fill="#ffffff"/>'
    [System.IO.File]::WriteAllText($OutputFile, $svg, [System.Text.UTF8Encoding]::new($false))
  }
}

function New-SplitPage {
  param(
    [string]$Name,
    [double]$MinimumX,
    [double]$MaximumX,
    [string]$OutputFile
  )

  [xml]$splitXml = $sourceXml.OuterXml
  $diagrams = @($splitXml.mxfile.diagram)
  for ($index = $diagrams.Count - 1; $index -ge 1; $index--) {
    $splitXml.mxfile.RemoveChild($diagrams[$index]) | Out-Null
  }

  $diagram = @($splitXml.mxfile.diagram)[0]
  $diagram.SetAttribute('name', $Name)
  $root = $diagram.mxGraphModel.root
  $cells = @($root.mxCell)
  $included = [System.Collections.Generic.HashSet[string]]::new()
  [void]$included.Add('0')
  [void]$included.Add('1')

  foreach ($cell in $cells) {
    if ([string]$cell.vertex -ne '1') {
      continue
    }
    $xText = [string]$cell.mxGeometry.x
    if (-not $xText) {
      continue
    }
    $x = [double]$xText
    if ($x -ge $MinimumX -and $x -lt $MaximumX) {
      [void]$included.Add([string]$cell.id)
    }
  }

  do {
    $changed = $false
    foreach ($cell in $cells) {
      $id = [string]$cell.id
      if ($included.Contains($id)) {
        continue
      }

      $parent = [string]$cell.parent
      if ($parent -and $parent -notin @('0', '1') -and $included.Contains($parent)) {
        $changed = $included.Add($id) -or $changed
        continue
      }

      if ([string]$cell.edge -eq '1') {
        $source = [string]$cell.source
        $target = [string]$cell.target
        $sourceIncluded = $source -and $included.Contains($source)
        $targetIncluded = $target -and $included.Contains($target)
        $allEndpointsIncluded = (-not $source -or $sourceIncluded) -and (-not $target -or $targetIncluded)
        if ($allEndpointsIncluded -and ($sourceIncluded -or $targetIncluded)) {
          $changed = $included.Add($id) -or $changed
        }
      }
    }
  } while ($changed)

  foreach ($cell in @($root.mxCell)) {
    if (-not $included.Contains([string]$cell.id)) {
      $root.RemoveChild($cell) | Out-Null
    }
  }

  $splitXml.Save([string]$OutputFile)
  if (-not (Test-Path -LiteralPath $OutputFile)) {
    throw "Failed to write temporary draw.io page: $OutputFile"
  }
}

try {
  $flows = @(
    @{ Name = 'Sample exchange flow'; MinimumX = -10000; MaximumX = 100; File = 'sample-exchange-flow' },
    @{ Name = 'Single sample-in flow'; MinimumX = 100; MaximumX = 1200; File = 'single-sample-in-flow' },
    @{ Name = 'Single sample-out flow'; MinimumX = 1200; MaximumX = 10000; File = 'single-sample-out-flow' }
  )

  foreach ($flow in $flows) {
    $temporaryDrawio = Join-Path $tempDirectory ($flow.File + '.drawio')
    $outputSvg = Join-Path $OutputDirectory ($flow.File + '.svg')
    New-SplitPage -Name $flow.Name -MinimumX $flow.MinimumX -MaximumX $flow.MaximumX -OutputFile $temporaryDrawio
    Export-Svg -InputFile $temporaryDrawio -OutputFile $outputSvg
  }

  Export-Svg `
    -InputFile $Source `
    -OutputFile (Join-Path $OutputDirectory 'move-plate-flow.svg') `
    -PageIndex 2
}
finally {
  $resolvedTemp = [System.IO.Path]::GetFullPath($tempDirectory)
  if ($resolvedTemp.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTemp)) {
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
  }
}
