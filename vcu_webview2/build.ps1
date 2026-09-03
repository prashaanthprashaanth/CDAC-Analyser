param(
    [string]$Version = "5.0.0"
)

$ErrorActionPreference = "Stop"

if ($Version -ne "5.0.0")
{
    throw "This source tree contains v5.0.0 assembly metadata. Update Program.cs and app.manifest before building another version."
}

$sourceRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $sourceRoot ".."))
$viewerSource = Join-Path $repositoryRoot "vcu_fault_viewer"
$buildRoot = Join-Path $sourceRoot "dist"
$payloadRoot = Join-Path $buildRoot "payload"
$cacheRoot = Join-Path $sourceRoot ".cache"
$webViewVersion = "1.0.4191.47"
$webViewSha256 = "F492BBF547D0DA329553B6727435B677579B1E9F91CC9E4A1AD029366D5F23D0"
$packageName = "microsoft.web.webview2.$webViewVersion.nupkg"
$packagePath = Join-Path $cacheRoot $packageName
$sdkRoot = Join-Path $cacheRoot "microsoft.web.webview2.$webViewVersion"

function Assert-ChildPath([string]$Path, [string]$Parent)
{
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullParent = [System.IO.Path]::GetFullPath($Parent)
    if (-not $fullPath.StartsWith($fullParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase))
    {
        throw "Path escaped expected directory: $fullPath"
    }
}

New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null

$downloadPackage = $true
if (Test-Path -LiteralPath $packagePath)
{
    $downloadPackage = (Get-FileHash -Algorithm SHA256 -LiteralPath $packagePath).Hash -ne $webViewSha256
}

if ($downloadPackage)
{
    Invoke-WebRequest `
        -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$webViewVersion/$packageName" `
        -OutFile $packagePath `
        -UseBasicParsing
}

$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $packagePath).Hash
if ($actualHash -ne $webViewSha256)
{
    throw "WebView2 SDK checksum mismatch: $actualHash"
}

$sdkProbe = Join-Path $sdkRoot "lib\net462\Microsoft.Web.WebView2.Core.dll"
if (-not (Test-Path -LiteralPath $sdkProbe))
{
    if (Test-Path -LiteralPath $sdkRoot)
    {
        Assert-ChildPath $sdkRoot $cacheRoot
        [System.IO.Directory]::Delete($sdkRoot, $true)
    }

    New-Item -ItemType Directory -Path $sdkRoot -Force | Out-Null
    & tar.exe -xf $packagePath -C $sdkRoot
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $sdkProbe))
    {
        throw "WebView2 SDK extraction failed."
    }
}

if (Test-Path -LiteralPath $buildRoot)
{
    Assert-ChildPath $buildRoot $sourceRoot
    [System.IO.Directory]::Delete($buildRoot, $true)
}

New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null
$viewerDestination = Join-Path $payloadRoot "viewer"
New-Item -ItemType Directory -Path $viewerDestination -Force | Out-Null

foreach ($fileName in @("index.html", "styles.css", "decoder.js", "app.js"))
{
    Copy-Item -LiteralPath (Join-Path $viewerSource $fileName) -Destination $viewerDestination
}

Copy-Item -LiteralPath (Join-Path $viewerSource "data") -Destination $viewerDestination -Recurse
Copy-Item -LiteralPath (Join-Path $viewerSource "vendor") -Destination $viewerDestination -Recurse

$coreAssembly = Join-Path $sdkRoot "lib\net462\Microsoft.Web.WebView2.Core.dll"
$winFormsAssembly = Join-Path $sdkRoot "lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$loader = Join-Path $sdkRoot "runtimes\win-x64\native\WebView2Loader.dll"
$applicationExe = Join-Path $payloadRoot "CDAC VCU Fault Analyser.exe"
$applicationConfig = Join-Path $sourceRoot "CDAC VCU Fault Analyser.exe.config"
$icon = Join-Path $sourceRoot "icon.ico"
$manifest = Join-Path $sourceRoot "app.manifest"
$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

foreach ($requiredPath in @($coreAssembly, $winFormsAssembly, $loader, $applicationConfig, $icon, $manifest, $compiler))
{
    if (-not (Test-Path -LiteralPath $requiredPath))
    {
        throw "Required build file is missing: $requiredPath"
    }
}

$compilerArguments = @(
    "/nologo",
    "/target:winexe",
    "/platform:x64",
    "/optimize+",
    "/debug-",
    "/out:$applicationExe",
    "/win32icon:$icon",
    "/win32manifest:$manifest",
    "/reference:System.dll",
    "/reference:System.Core.dll",
    "/reference:System.Drawing.dll",
    "/reference:System.Windows.Forms.dll",
    "/reference:$coreAssembly",
    "/reference:$winFormsAssembly",
    (Join-Path $sourceRoot "Program.cs")
)

& $compiler $compilerArguments
if ($LASTEXITCODE -ne 0)
{
    throw "C# compilation failed with exit code $LASTEXITCODE"
}

Copy-Item -LiteralPath $coreAssembly -Destination $payloadRoot
Copy-Item -LiteralPath $winFormsAssembly -Destination $payloadRoot
Copy-Item -LiteralPath $loader -Destination $payloadRoot
Copy-Item -LiteralPath $applicationConfig -Destination $payloadRoot

$makeNsisCandidates = @(
    "C:\Program Files (x86)\NSIS\Bin\makensis.exe",
    "C:\Program Files (x86)\NSIS\makensis.exe"
)
$cachedNsis = Get-ChildItem `
    -LiteralPath (Join-Path $env:LOCALAPPDATA "electron-builder\Cache\nsis-3.0.4.1") `
    -Recurse `
    -File `
    -Filter "makensis.exe" `
    -ErrorAction SilentlyContinue |
    Where-Object { $_.Directory.Name -eq "Bin" } |
    Select-Object -First 1
if ($cachedNsis)
{
    $makeNsisCandidates += $cachedNsis.FullName
}

$makeNsis = $makeNsisCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $makeNsis)
{
    throw "NSIS 3 is required to build the setup executable."
}

$installerOutput = Join-Path $buildRoot "CDAC-VCU-Fault-Analyser-Setup-$Version.exe"
$nsisArguments = @(
    "/V2",
    "/DPRODUCT_VERSION=$Version",
    "/DPAYLOAD_DIR=$($payloadRoot.Replace('\', '/'))",
    "/DOUTPUT_FILE=$($installerOutput.Replace('\', '/'))",
    "/DAPP_ICON=$($icon.Replace('\', '/'))",
    (Join-Path $sourceRoot "installer.nsi")
)

& $makeNsis $nsisArguments
if ($LASTEXITCODE -ne 0)
{
    throw "NSIS compilation failed with exit code $LASTEXITCODE"
}

Write-Output "Built $installerOutput"
