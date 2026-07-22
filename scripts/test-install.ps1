[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $repoRoot 'install.ps1'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("a3s-installer-test-$([Guid]::NewGuid().ToString('D'))")
$fixtureRoot = Join-Path $testRoot 'fixture'

function Fail-Test {
    param([string]$Message)
    throw "installer test failed: $Message"
}

function Assert-File {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Fail-Test "expected file $Path"
    }
}

function Assert-Content {
    param(
        [string]$Expected,
        [string]$Path
    )
    $actual = (Get-Content -LiteralPath $Path -Raw).TrimEnd("`r", "`n")
    if ($actual -cne $Expected) {
        Fail-Test "unexpected content in $Path"
    }
}

function Assert-NoGeneratedPaths {
    param([string]$Root)
    $leftovers = @(Get-ChildItem -LiteralPath $Root -Recurse -Force |
        Where-Object { $_.Name -match '^\.a3s(?:-web|-webview|-support)?\.(new|backup|failed)\.' })
    if ($leftovers.Count -ne 0) {
        Fail-Test "installer left temporary path $($leftovers[0].FullName)"
    }
}

function Expect-Failure {
    param(
        [string]$Description,
        [scriptblock]$Action
    )
    try {
        & $Action
    } catch {
        return
    }
    Fail-Test "$Description unexpectedly succeeded"
}

$global:A3sInstallerMockRelease = $null
$global:A3sInstallerMockArchive = ''
$global:A3sInstallerMoveFault = ''
$global:A3sInstallerMoveFaultVersion = ''
$global:A3sInstallerMoveFaultTriggered = $false
$global:A3sInstallerRestFailures = 0
$global:A3sInstallerWebFailures = 0
$global:A3sInstallerRetryDelays = 0

function Invoke-RestMethod {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Uri,
        [Parameter(Mandatory = $true)]$Headers,
        [int]$TimeoutSec
    )
    if ($global:A3sInstallerRestFailures -gt 0) {
        $global:A3sInstallerRestFailures--
        throw 'injected transient release lookup failure'
    }
    if ($null -eq $global:A3sInstallerMockRelease) {
        throw 'mock release was not configured'
    }
    return $global:A3sInstallerMockRelease
}

function Invoke-WebRequest {
    [CmdletBinding()]
    param(
        [switch]$UseBasicParsing,
        [Parameter(Mandatory = $true)]$Uri,
        [Parameter(Mandatory = $true)][string]$OutFile,
        [Parameter(Mandatory = $true)]$Headers,
        [int]$TimeoutSec
    )
    if ($global:A3sInstallerWebFailures -gt 0) {
        $global:A3sInstallerWebFailures--
        throw 'injected transient asset download failure'
    }
    Copy-Item -LiteralPath $global:A3sInstallerMockArchive -Destination $OutFile
}

function Start-Sleep {
    [CmdletBinding()]
    param([double]$Seconds)
    $global:A3sInstallerRetryDelays++
}

function Move-Item {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][string]$Destination,
        [switch]$Force
    )

    Microsoft.PowerShell.Management\Move-Item @PSBoundParameters
    if ([string]::IsNullOrEmpty($global:A3sInstallerMoveFault) -or
        $global:A3sInstallerMoveFaultTriggered) {
        return
    }

    $sourceLeaf = Split-Path -Leaf $LiteralPath
    $destinationLeaf = Split-Path -Leaf $Destination
    $inject = switch ($global:A3sInstallerMoveFault) {
        'web-backup' {
            $sourceLeaf -ceq $global:A3sInstallerMoveFaultVersion -and
                $destinationLeaf -match '^\.a3s-web\.backup\.'
            break
        }
        'web-activate' {
            $sourceLeaf -match '^\.a3s-web\.new\.' -and
                $destinationLeaf -ceq $global:A3sInstallerMoveFaultVersion
            break
        }
        'binary-activate' {
            $sourceLeaf -match '^\.a3s\.new\.[0-9a-f-]+\.exe$' -and
                $destinationLeaf -ceq 'a3s.exe'
            break
        }
        'webview-activate' {
            $sourceLeaf -match '^\.a3s-webview\.new\.[0-9a-f-]+\.exe$' -and
                $destinationLeaf -ceq 'a3s-webview.exe'
            break
        }
        'support-activate' {
            $sourceLeaf -match '^\.a3s-support\.new\.[0-9a-f-]+$' -and
                $destinationLeaf -ceq 'support'
            break
        }
        default { $false }
    }
    if ($inject) {
        $global:A3sInstallerMoveFaultTriggered = $true
        throw "injected interruption after $($global:A3sInstallerMoveFault) mutation"
    }
}

function New-FixtureExecutable {
    param(
        [string]$Version,
        [string]$Destination,
        [ValidateSet('a3s', 'webview')][string]$Product = 'a3s'
    )
    $typeName = 'Program_' + $Version.Replace('.', '_') + '_' + [Guid]::NewGuid().ToString('N')
    $source = if ($Product -eq 'webview') {
        @"
using System;
public static class $typeName
{
    public static int Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--agent-island")
        {
            Console.Error.WriteLine("usage: a3s-webview --agent-island --snapshot <absolute-path> --lock-file <absolute-path>");
            return 2;
        }
        Console.WriteLine("a3s-webview $Version");
        return 0;
    }
}
"@
    } else {
        @"
using System;
public static class $typeName
{
    public static int Main(string[] args)
    {
        Console.WriteLine("a3s $Version");
        return 0;
    }
}
"@
    }
    $compilerCandidates = @(
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
    )
    $compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $compiler) {
        throw 'could not find the Windows C# compiler required by this test'
    }

    $sourcePath = Join-Path $fixtureRoot "$typeName.cs"
    try {
        Set-Content -LiteralPath $sourcePath -Value $source -Encoding UTF8
        & $compiler /nologo /target:exe "/out:$Destination" $sourcePath
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Destination -PathType Leaf)) {
            throw "fixture compilation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Remove-Item -LiteralPath $sourcePath -Force -ErrorAction SilentlyContinue
    }
}

function Set-ReleaseFixture {
    param(
        [string]$Version,
        [switch]$UnsafeMember,
        [switch]$WithoutWebview,
        [switch]$WithoutSupport
    )

    $payload = Join-Path $fixtureRoot 'payload'
    if (Test-Path -LiteralPath $payload) {
        Remove-Item -LiteralPath $payload -Recurse -Force
    }
    [IO.Directory]::CreateDirectory((Join-Path $payload 'web')) | Out-Null
    New-FixtureExecutable -Version $Version -Destination (Join-Path $payload 'a3s.exe')
    if (-not $WithoutWebview) {
        New-FixtureExecutable -Version $Version -Destination (Join-Path $payload 'a3s-webview.exe') -Product webview
    }
    Set-Content -LiteralPath (Join-Path $payload 'web\index.html') -Value "<!doctype html><title>A3S $Version</title>" -Encoding UTF8
    if (-not $WithoutSupport) {
        $supportRoot = Join-Path $payload 'support\managed-srt'
        $supportDist = Join-Path $supportRoot 'node_modules\@anthropic-ai\sandbox-runtime\dist'
        [IO.Directory]::CreateDirectory($supportDist) | Out-Null
        Set-Content -LiteralPath (Join-Path $supportRoot 'package.json') `
            -Value "{`"name`":`"a3s-managed-srt-fixture`",`"version`":`"$Version`"}" -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $supportRoot 'package-lock.json') `
            -Value '{"name":"a3s-managed-srt-fixture","lockfileVersion":3}' -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $supportDist 'cli.js') `
            -Value "managed-srt $Version" -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $payload 'support\managed-srt.tree-sha256') `
            -Value "fixture-tree-sha256-$Version" -Encoding UTF8
    }
    if ($UnsafeMember) {
        Set-Content -LiteralPath (Join-Path $payload 'escape.txt') -Value 'unexpected' -Encoding UTF8
    }

    $assetName = "a3s-v$Version-x86_64-pc-windows-msvc.zip"
    $archive = Join-Path $fixtureRoot $assetName
    if (Test-Path -LiteralPath $archive) {
        Remove-Item -LiteralPath $archive -Force
    }
    Compress-Archive -Path (Join-Path $payload '*') -DestinationPath $archive
    $digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $asset = [pscustomobject]@{
        name = $assetName
        state = 'uploaded'
        digest = "sha256:$digest"
        browser_download_url = "https://github.com/A3S-Lab/CLI/releases/download/v$Version/$assetName"
    }
    $global:A3sInstallerMockRelease = [pscustomobject]@{
        tag_name = "v$Version"
        draft = $false
        prerelease = $false
        assets = @($asset)
    }
    $global:A3sInstallerMockArchive = $archive
}

function Invoke-TestInstall {
    param(
        [string]$Version,
        [string]$InstallDir,
        [string]$DataHome
    )
    $env:A3S_DATA_HOME = $DataHome
    & $installer -Version $Version -InstallDir $InstallDir
}

$savedEnvironment = @{
    A3S_DATA_HOME = $env:A3S_DATA_HOME
    A3S_MODIFY_PATH = $env:A3S_MODIFY_PATH
    A3S_GITHUB_TOKEN = $env:A3S_GITHUB_TOKEN
    LOCALAPPDATA = $env:LOCALAPPDATA
    PROCESSOR_ARCHITECTURE = $env:PROCESSOR_ARCHITECTURE
    PROCESSOR_ARCHITEW6432 = $env:PROCESSOR_ARCHITEW6432
}

[IO.Directory]::CreateDirectory($fixtureRoot) | Out-Null

try {
    $env:A3S_MODIFY_PATH = $null
    $env:A3S_GITHUB_TOKEN = $null
    $env:PROCESSOR_ARCHITECTURE = 'AMD64'
    $env:PROCESSOR_ARCHITEW6432 = $null
    $env:LOCALAPPDATA = Join-Path $testRoot 'Local AppData 用户'

    # Transient API and archive transport failures are retried without leaving
    # a partial download or requiring the user to restart the installer.
    $retryRoot = Join-Path $testRoot 'transient-network-retry'
    Set-ReleaseFixture -Version '1.2.1' -WithoutWebview -WithoutSupport
    $global:A3sInstallerRestFailures = 1
    $global:A3sInstallerWebFailures = 1
    $global:A3sInstallerRetryDelays = 0
    Invoke-TestInstall -Version '1.2.1' -InstallDir (Join-Path $retryRoot 'bin') `
        -DataHome (Join-Path $retryRoot 'data')
    Assert-File (Join-Path $retryRoot 'bin\a3s.exe')
    if ($global:A3sInstallerRestFailures -ne 0 -or
        $global:A3sInstallerWebFailures -ne 0 -or
        $global:A3sInstallerRetryDelays -ne 2) {
        Fail-Test 'transient network failures were not retried exactly once each'
    }
    Assert-NoGeneratedPaths -Root $retryRoot

    # Stable archives published before the companion bundle remain installable;
    # Code owns their verified WebView first-use setup.
    $legacyRoot = Join-Path $testRoot 'legacy-without-webview'
    Set-ReleaseFixture -Version '1.2.2' -WithoutWebview -WithoutSupport
    Invoke-TestInstall -Version '1.2.2' -InstallDir (Join-Path $legacyRoot 'bin') `
        -DataHome (Join-Path $legacyRoot 'data')
    Assert-File (Join-Path $legacyRoot 'bin\a3s.exe')
    Assert-File (Join-Path $legacyRoot 'data\web\1.2.2\index.html')
    if (Test-Path -LiteralPath (Join-Path $legacyRoot 'bin\a3s-webview.exe')) {
        Fail-Test 'legacy release unexpectedly installed a WebView companion'
    }
    if (Test-Path -LiteralPath (Join-Path $legacyRoot 'bin\support')) {
        Fail-Test 'legacy release unexpectedly installed a support payload'
    }
    Assert-NoGeneratedPaths -Root $legacyRoot

    # Initial installation and upgrade keep both versioned Web caches.
    $upgradeRoot = Join-Path $testRoot 'upgrade path 用户'
    $installDir = Join-Path $upgradeRoot 'bin'
    $dataHome = Join-Path $upgradeRoot 'data'
    Set-ReleaseFixture -Version '1.2.3'
    Invoke-TestInstall -Version '1.2.3' -InstallDir $installDir -DataHome $dataHome
    Assert-File (Join-Path $installDir 'a3s.exe')
    Assert-File (Join-Path $installDir 'a3s-webview.exe')
    $supportCli = Join-Path $installDir 'support\managed-srt\node_modules\@anthropic-ai\sandbox-runtime\dist\cli.js'
    Assert-File $supportCli
    Assert-File (Join-Path $dataHome 'web\1.2.3\index.html')
    $installedVersion = (& (Join-Path $installDir 'a3s.exe') --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 1.2.3') {
        Fail-Test "initial binary reported $installedVersion"
    }
    $installedWebviewVersion = (& (Join-Path $installDir 'a3s-webview.exe') | Out-String).Trim()
    if ($installedWebviewVersion -cne 'a3s-webview 1.2.3') {
        Fail-Test "initial WebView companion reported $installedWebviewVersion"
    }
    Assert-Content -Expected 'managed-srt 1.2.3' -Path $supportCli

    Set-ReleaseFixture -Version '1.2.4'
    Invoke-TestInstall -Version '1.2.4' -InstallDir $installDir -DataHome $dataHome
    $installedVersion = (& (Join-Path $installDir 'a3s.exe') --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 1.2.4') {
        Fail-Test "upgraded binary reported $installedVersion"
    }
    $installedWebviewVersion = (& (Join-Path $installDir 'a3s-webview.exe') | Out-String).Trim()
    if ($installedWebviewVersion -cne 'a3s-webview 1.2.4') {
        Fail-Test "upgraded WebView companion reported $installedWebviewVersion"
    }
    Assert-Content -Expected 'managed-srt 1.2.4' -Path $supportCli
    Assert-File (Join-Path $dataHome 'web\1.2.3\index.html')
    Assert-File (Join-Path $dataHome 'web\1.2.4\index.html')
    Assert-NoGeneratedPaths -Root $upgradeRoot

    # Digest errors fail before activation and preserve the old installation.
    Set-ReleaseFixture -Version '1.2.5'
    $global:A3sInstallerMockRelease.assets[0].digest = 'sha256:' + ('f' * 64)
    Expect-Failure 'digest mismatch' {
        Invoke-TestInstall -Version '1.2.5' -InstallDir $installDir -DataHome $dataHome
    }
    $installedVersion = (& (Join-Path $installDir 'a3s.exe') --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 1.2.4') {
        Fail-Test 'digest failure changed the installed binary'
    }
    $installedWebviewVersion = (& (Join-Path $installDir 'a3s-webview.exe') | Out-String).Trim()
    if ($installedWebviewVersion -cne 'a3s-webview 1.2.4') {
        Fail-Test 'digest failure changed the installed WebView companion'
    }
    Assert-Content -Expected 'managed-srt 1.2.4' -Path $supportCli

    # Missing digest metadata fails closed.
    Set-ReleaseFixture -Version '1.2.6'
    $global:A3sInstallerMockRelease.assets[0].PSObject.Properties.Remove('digest')
    Expect-Failure 'missing digest' {
        Invoke-TestInstall -Version '1.2.6' -InstallDir $installDir -DataHome $dataHome
    }

    # Unexpected archive members are rejected before activation.
    Set-ReleaseFixture -Version '1.2.7' -UnsafeMember
    Expect-Failure 'unsafe archive member' {
        Invoke-TestInstall -Version '1.2.7' -InstallDir $installDir -DataHome $dataHome
    }
    $installedVersion = (& (Join-Path $installDir 'a3s.exe') --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 1.2.4') {
        Fail-Test 'unsafe archive changed the installed binary'
    }
    $installedWebviewVersion = (& (Join-Path $installDir 'a3s-webview.exe') | Out-String).Trim()
    if ($installedWebviewVersion -cne 'a3s-webview 1.2.4') {
        Fail-Test 'unsafe archive changed the installed WebView companion'
    }
    Assert-Content -Expected 'managed-srt 1.2.4' -Path $supportCli

    # A locked executable forces rollback without losing the old binary or Web cache.
    $lockedRoot = Join-Path $testRoot 'locked'
    $lockedInstallDir = Join-Path $lockedRoot 'bin'
    $lockedDataHome = Join-Path $lockedRoot 'data'
    Set-ReleaseFixture -Version '2.0.0'
    Invoke-TestInstall -Version '2.0.0' -InstallDir $lockedInstallDir -DataHome $lockedDataHome
    Set-ReleaseFixture -Version '2.0.1'
    $lockedBinary = Join-Path $lockedInstallDir 'a3s.exe'
    $lock = [IO.File]::Open($lockedBinary, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        Expect-Failure 'locked executable upgrade' {
            Invoke-TestInstall -Version '2.0.1' -InstallDir $lockedInstallDir -DataHome $lockedDataHome
        }
    } finally {
        $lock.Dispose()
    }
    $installedVersion = (& $lockedBinary --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 2.0.0') {
        Fail-Test 'locked upgrade did not preserve the old binary'
    }
    $installedWebviewVersion = (& (Join-Path $lockedInstallDir 'a3s-webview.exe') | Out-String).Trim()
    if ($installedWebviewVersion -cne 'a3s-webview 2.0.0') {
        Fail-Test 'locked upgrade did not restore the old WebView companion'
    }
    Assert-Content -Expected 'managed-srt 2.0.0' -Path `
        (Join-Path $lockedInstallDir 'support\managed-srt\node_modules\@anthropic-ai\sandbox-runtime\dist\cli.js')
    Assert-File (Join-Path $lockedDataHome 'web\2.0.0\index.html')
    if (Test-Path -LiteralPath (Join-Path $lockedDataHome 'web\2.0.1')) {
        Fail-Test 'locked upgrade left the failed Web version active'
    }
    Assert-NoGeneratedPaths -Root $lockedRoot

    # Faults raised after successful filesystem mutations but before the next
    # state assignment must restore the state visible before the installation.
    $faultRoot = Join-Path $testRoot 'fault-injection'
    $faultInstallDir = Join-Path $faultRoot 'bin'
    $faultDataHome = Join-Path $faultRoot 'data'
    Set-ReleaseFixture -Version '4.0.0'
    Invoke-TestInstall -Version '4.0.0' -InstallDir $faultInstallDir -DataHome $faultDataHome
    $faultWeb = Join-Path $faultDataHome 'web\4.0.0\index.html'
    Set-Content -LiteralPath $faultWeb -Value 'old Web sentinel' -Encoding UTF8
    $faultSupportCli = Join-Path $faultInstallDir 'support\managed-srt\node_modules\@anthropic-ai\sandbox-runtime\dist\cli.js'
    Set-Content -LiteralPath $faultSupportCli -Value 'old support sentinel' -Encoding UTF8

    $global:A3sInstallerMoveFault = 'web-backup'
    $global:A3sInstallerMoveFaultVersion = '4.0.0'
    $global:A3sInstallerMoveFaultTriggered = $false
    Expect-Failure 'interruption after Web backup' {
        Invoke-TestInstall -Version '4.0.0' -InstallDir $faultInstallDir -DataHome $faultDataHome
    }
    if (-not $global:A3sInstallerMoveFaultTriggered) {
        Fail-Test 'Web backup fault was not injected'
    }
    Assert-Content -Expected 'old Web sentinel' -Path $faultWeb
    Assert-Content -Expected 'old support sentinel' -Path $faultSupportCli
    $installedVersion = (& (Join-Path $faultInstallDir 'a3s.exe') --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 4.0.0') {
        Fail-Test 'Web backup interruption changed the installed binary'
    }
    Assert-NoGeneratedPaths -Root $faultRoot

    $global:A3sInstallerMoveFault = 'web-activate'
    $global:A3sInstallerMoveFaultTriggered = $false
    Expect-Failure 'interruption after Web activation' {
        Invoke-TestInstall -Version '4.0.0' -InstallDir $faultInstallDir -DataHome $faultDataHome
    }
    if (-not $global:A3sInstallerMoveFaultTriggered) {
        Fail-Test 'Web activation fault was not injected'
    }
    Assert-Content -Expected 'old Web sentinel' -Path $faultWeb
    Assert-Content -Expected 'old support sentinel' -Path $faultSupportCli
    $installedVersion = (& (Join-Path $faultInstallDir 'a3s.exe') --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 4.0.0') {
        Fail-Test 'Web activation interruption changed the installed binary'
    }
    Assert-NoGeneratedPaths -Root $faultRoot

    $global:A3sInstallerMoveFault = 'support-activate'
    $global:A3sInstallerMoveFaultTriggered = $false
    Expect-Failure 'interruption after support payload activation' {
        Invoke-TestInstall -Version '4.0.0' -InstallDir $faultInstallDir -DataHome $faultDataHome
    }
    if (-not $global:A3sInstallerMoveFaultTriggered) {
        Fail-Test 'support payload fault was not injected'
    }
    Assert-Content -Expected 'old Web sentinel' -Path $faultWeb
    Assert-Content -Expected 'old support sentinel' -Path $faultSupportCli
    $installedVersion = (& (Join-Path $faultInstallDir 'a3s.exe') --version | Out-String).Trim()
    if ($installedVersion -cne 'a3s 4.0.0') {
        Fail-Test 'support activation interruption changed the installed binary'
    }
    Assert-NoGeneratedPaths -Root $faultRoot

    $initialWebviewFaultRoot = Join-Path $testRoot 'initial-webview-fault'
    $global:A3sInstallerMoveFault = 'webview-activate'
    $global:A3sInstallerMoveFaultVersion = '4.0.1'
    $global:A3sInstallerMoveFaultTriggered = $false
    Set-ReleaseFixture -Version '4.0.1'
    Expect-Failure 'interruption after initial WebView companion activation' {
        Invoke-TestInstall -Version '4.0.1' -InstallDir (Join-Path $initialWebviewFaultRoot 'bin') `
            -DataHome (Join-Path $initialWebviewFaultRoot 'data')
    }
    if (-not $global:A3sInstallerMoveFaultTriggered) {
        Fail-Test 'WebView companion fault was not injected'
    }
    if (Test-Path -LiteralPath (Join-Path $initialWebviewFaultRoot 'bin\a3s-webview.exe')) {
        Fail-Test 'WebView activation interruption left the new companion active'
    }
    if (Test-Path -LiteralPath (Join-Path $initialWebviewFaultRoot 'bin\a3s.exe')) {
        Fail-Test 'WebView activation interruption left the new binary active'
    }
    if (Test-Path -LiteralPath (Join-Path $initialWebviewFaultRoot 'bin\support')) {
        Fail-Test 'WebView activation interruption left the new support payload active'
    }
    if (Test-Path -LiteralPath (Join-Path $initialWebviewFaultRoot 'data\web\4.0.1')) {
        Fail-Test 'WebView activation interruption left the new Web cache active'
    }
    Assert-NoGeneratedPaths -Root $initialWebviewFaultRoot

    $initialFaultRoot = Join-Path $testRoot 'initial-binary-fault'
    $global:A3sInstallerMoveFault = 'binary-activate'
    $global:A3sInstallerMoveFaultVersion = '4.1.0'
    $global:A3sInstallerMoveFaultTriggered = $false
    Set-ReleaseFixture -Version '4.1.0'
    Expect-Failure 'interruption after initial binary activation' {
        Invoke-TestInstall -Version '4.1.0' -InstallDir (Join-Path $initialFaultRoot 'bin') `
            -DataHome (Join-Path $initialFaultRoot 'data')
    }
    if (-not $global:A3sInstallerMoveFaultTriggered) {
        Fail-Test 'binary activation fault was not injected'
    }
    if (Test-Path -LiteralPath (Join-Path $initialFaultRoot 'bin\a3s.exe')) {
        Fail-Test 'binary activation interruption left the new binary active'
    }
    if (Test-Path -LiteralPath (Join-Path $initialFaultRoot 'bin\a3s-webview.exe')) {
        Fail-Test 'binary activation interruption left the new WebView companion active'
    }
    if (Test-Path -LiteralPath (Join-Path $initialFaultRoot 'bin\support')) {
        Fail-Test 'binary activation interruption left the new support payload active'
    }
    if (Test-Path -LiteralPath (Join-Path $initialFaultRoot 'data\web\4.1.0')) {
        Fail-Test 'binary activation interruption left the new Web cache active'
    }
    Assert-NoGeneratedPaths -Root $initialFaultRoot
    $global:A3sInstallerMoveFault = ''
    $global:A3sInstallerMoveFaultVersion = ''

    # Relative install/data roots and unsupported Windows architectures fail closed.
    Set-ReleaseFixture -Version '3.0.0'
    $env:A3S_DATA_HOME = Join-Path $testRoot 'absolute-data'
    Push-Location $testRoot
    try {
        Expect-Failure 'relative install directory' {
            & $installer -Version '3.0.0' -InstallDir 'relative-bin'
        }
    } finally {
        Pop-Location
    }
    if (Test-Path -LiteralPath (Join-Path $testRoot 'relative-bin')) {
        Fail-Test 'relative install directory was created'
    }

    $env:A3S_DATA_HOME = 'relative-data'
    Expect-Failure 'relative A3S_DATA_HOME' {
        & $installer -Version '3.0.0' -InstallDir (Join-Path $testRoot 'relative\bin')
    }

    $env:PROCESSOR_ARCHITECTURE = 'ARM64'
    $env:PROCESSOR_ARCHITEW6432 = $null
    Expect-Failure 'Windows ARM64' {
        Invoke-TestInstall -Version '3.0.0' -InstallDir (Join-Path $testRoot 'arm\bin') -DataHome (Join-Path $testRoot 'arm\data')
    }

    Write-Host 'install.ps1 tests passed'
} finally {
    foreach ($name in $savedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
    Remove-Variable -Name A3sInstallerMockRelease -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name A3sInstallerMockArchive -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name A3sInstallerMoveFault -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name A3sInstallerMoveFaultVersion -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name A3sInstallerMoveFaultTriggered -Scope Global -ErrorAction SilentlyContinue
    $fullTestRoot = [IO.Path]::GetFullPath($testRoot)
    $fullTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if ($fullTestRoot.StartsWith($fullTempRoot, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($fullTestRoot) -match '^a3s-installer-test-[0-9a-f-]+$') {
        Remove-Item -LiteralPath $fullTestRoot -Recurse -Force
    } else {
        Write-Warning "refusing to remove unexpected test directory $fullTestRoot"
    }
}
