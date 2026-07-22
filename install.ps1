# Install the latest stable A3S CLI release on Windows x64.
#
# Environment overrides:
#   A3S_VERSION          Release tag (for example v0.9.8); defaults to latest.
#   A3S_INSTALL_DIR      Binary directory; defaults to LocalAppData\Programs\a3s\bin.
#   A3S_DATA_HOME        Data directory for versioned Web assets.
#   A3S_MODIFY_PATH      Set to 1 to add the install directory to the user PATH.
#   A3S_GITHUB_TOKEN     Optional GitHub token for release API rate limits.

[CmdletBinding()]
param(
    [string]$Version = $env:A3S_VERSION,
    [string]$InstallDir = $env:A3S_INSTALL_DIR,
    [switch]$ModifyPath
)

& {
    param(
        [string]$RequestedVersion,
        [string]$RequestedInstallDir,
        [bool]$UpdatePath
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'

    $repository = 'A3S-Lab/CLI'
    $target = 'x86_64-pc-windows-msvc'

    if ($PSVersionTable.PSVersion -lt [Version]'5.1') {
        throw 'install.ps1 requires Windows PowerShell 5.1 or PowerShell 7 or newer'
    }

    function Write-InstallerInfo {
        param([string]$Message)
        Write-Host "a3s installer: $Message"
    }

    function Write-InstallerWarning {
        param([string]$Message)
        Write-Warning "a3s installer: $Message"
    }

    function Invoke-InstallerRequest {
        param(
            [Parameter(Mandatory = $true)][scriptblock]$Operation,
            [Parameter(Mandatory = $true)][string]$Description,
            [int]$MaximumAttempts = 4
        )

        for ($attempt = 1; $attempt -le $MaximumAttempts; $attempt++) {
            try {
                return & $Operation
            } catch {
                if ($attempt -eq $MaximumAttempts) {
                    throw
                }
                $delaySeconds = [Math]::Pow(2, $attempt - 1)
                Write-InstallerWarning "$Description failed on attempt $attempt of $MaximumAttempts; retrying in $delaySeconds second(s): $($_.Exception.Message)"
                Start-Sleep -Seconds $delaySeconds
            }
        }
    }

    function Remove-GeneratedDirectory {
        param(
            [string]$Path,
            [string]$ExpectedParent
        )

        if ([string]::IsNullOrEmpty($Path) -or -not (Test-Path -LiteralPath $Path)) {
            return
        }
        $fullParent = [IO.Path]::GetFullPath($ExpectedParent).TrimEnd('\', '/')
        $fullPath = [IO.Path]::GetFullPath($Path)
        $parentWithSeparator = $fullParent + [IO.Path]::DirectorySeparatorChar
        $leaf = [IO.Path]::GetFileName($fullPath)
        if (-not $fullPath.StartsWith($parentWithSeparator, [StringComparison]::OrdinalIgnoreCase) -or
            $leaf -notmatch '^\.a3s-(?:web|support)\.(new|backup|failed)\.[0-9a-f-]+$') {
            throw "refusing to remove unexpected directory $fullPath"
        }
        Remove-Item -LiteralPath $fullPath -Recurse -Force
    }

    function Remove-GeneratedFile {
        param(
            [string]$Path,
            [string]$ExpectedParent
        )

        if ([string]::IsNullOrEmpty($Path) -or -not (Test-Path -LiteralPath $Path)) {
            return
        }
        $fullParent = [IO.Path]::GetFullPath($ExpectedParent).TrimEnd('\', '/')
        $fullPath = [IO.Path]::GetFullPath($Path)
        $parentWithSeparator = $fullParent + [IO.Path]::DirectorySeparatorChar
        $leaf = [IO.Path]::GetFileName($fullPath)
        if (-not $fullPath.StartsWith($parentWithSeparator, [StringComparison]::OrdinalIgnoreCase) -or
            $leaf -notmatch '^\.a3s(?:-webview)?\.(new|backup|failed)\.[0-9a-f-]+\.exe$') {
            throw "refusing to remove unexpected file $fullPath"
        }
        Remove-Item -LiteralPath $fullPath -Force
    }

    function Remove-InstallerTempDirectory {
        param([string]$Path)

        if ([string]::IsNullOrEmpty($Path) -or -not (Test-Path -LiteralPath $Path)) {
            return
        }
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
        $fullPath = [IO.Path]::GetFullPath($Path)
        $tempWithSeparator = $tempRoot + [IO.Path]::DirectorySeparatorChar
        $leaf = [IO.Path]::GetFileName($fullPath)
        if (-not $fullPath.StartsWith($tempWithSeparator, [StringComparison]::OrdinalIgnoreCase) -or
            $leaf -notmatch '^a3s-install-[0-9a-f-]+$') {
            throw "refusing to remove unexpected temporary directory $fullPath"
        }
        Remove-Item -LiteralPath $fullPath -Recurse -Force
    }

    function Assert-NoReparsePoint {
        param([string]$Path)

        $item = Get-Item -LiteralPath $Path -Force
        while ($null -ne $item) {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "installer-owned path traverses a reparse point: $($item.FullName)"
            }
            $item = $item.Parent
        }
    }

    function Assert-A3sVersion {
        param(
            [string]$Path,
            [string]$ExpectedVersion
        )

        $versionOutput = (& $Path --version 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) {
            throw "the a3s binary at $Path failed its version check"
        }
        if ($versionOutput -cne "a3s $ExpectedVersion") {
            throw "binary at $Path reported '$versionOutput', expected version $ExpectedVersion"
        }
    }

    function Test-AbsoluteWindowsPath {
        param([string]$Path)

        if ([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path)) {
            return $false
        }
        $root = [IO.Path]::GetPathRoot($Path)
        return -not ([string]::IsNullOrEmpty($root) -or
            $root -eq '\' -or $root -eq '/' -or $root -match '^[A-Za-z]:$')
    }

    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'install.ps1 supports Windows only; use install.sh on macOS or Linux'
    }

    $architecture = if (-not [string]::IsNullOrEmpty($env:PROCESSOR_ARCHITEW6432)) {
        $env:PROCESSOR_ARCHITEW6432
    } else {
        $env:PROCESSOR_ARCHITECTURE
    }
    if ($architecture -notmatch '^(AMD64|x86_64)$') {
        throw "unsupported Windows architecture '$architecture'; the published CLI requires x64"
    }

    if ([string]::IsNullOrWhiteSpace($RequestedVersion) -or $RequestedVersion -eq 'latest') {
        $RequestedVersion = 'latest'
    } elseif ($RequestedVersion -match '^\d') {
        $RequestedVersion = "v$RequestedVersion"
    }
    if ($RequestedVersion -ne 'latest' -and $RequestedVersion -notmatch '^v\d+\.\d+\.\d+$') {
        throw "invalid stable release tag '$RequestedVersion' (expected vX.Y.Z)"
    }

    $localAppData = $env:LOCALAPPDATA
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
    }
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        throw 'LocalAppData could not be resolved'
    }
    if (-not (Test-AbsoluteWindowsPath -Path $localAppData)) {
        throw 'LOCALAPPDATA must be an absolute path'
    }

    if ([string]::IsNullOrWhiteSpace($RequestedInstallDir)) {
        $RequestedInstallDir = Join-Path $localAppData 'Programs\a3s\bin'
    }
    if (-not (Test-AbsoluteWindowsPath -Path $RequestedInstallDir)) {
        throw 'the install directory must be an absolute path'
    }
    $installDir = [IO.Path]::GetFullPath($RequestedInstallDir).TrimEnd('\', '/')
    if ($installDir -eq [IO.Path]::GetPathRoot($installDir).TrimEnd('\', '/')) {
        throw 'refusing to install directly into a filesystem root'
    }
    [IO.Directory]::CreateDirectory($installDir) | Out-Null
    Assert-NoReparsePoint -Path $installDir
    $installDir = (Get-Item -LiteralPath $installDir -Force).FullName.TrimEnd('\', '/')

    if (-not [string]::IsNullOrWhiteSpace($env:A3S_DATA_HOME)) {
        if (-not (Test-AbsoluteWindowsPath -Path $env:A3S_DATA_HOME)) {
            throw 'A3S_DATA_HOME must be absolute for installer-managed Web assets'
        }
        $requestedDataRoot = [IO.Path]::GetFullPath($env:A3S_DATA_HOME).TrimEnd('\', '/')
        if ($requestedDataRoot -eq [IO.Path]::GetPathRoot($requestedDataRoot).TrimEnd('\', '/')) {
            throw 'A3S_DATA_HOME cannot be a filesystem root'
        }
    }

    if ($env:A3S_MODIFY_PATH -match '^(1|true|yes)$') {
        $UpdatePath = $true
    }

    # Windows PowerShell 5.1 may not enable TLS 1.2 by default.
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $apiHeaders = @{
        Accept = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'
        'User-Agent' = 'a3s-installer'
    }
    if (-not [string]::IsNullOrWhiteSpace($env:A3S_GITHUB_TOKEN)) {
        $apiHeaders.Authorization = "Bearer $($env:A3S_GITHUB_TOKEN)"
    }

    $releaseApi = if ($RequestedVersion -eq 'latest') {
        "https://api.github.com/repos/$repository/releases/latest"
    } else {
        "https://api.github.com/repos/$repository/releases/tags/$RequestedVersion"
    }

    Write-InstallerInfo "resolving $RequestedVersion release for $target"
    $release = Invoke-InstallerRequest -Description 'GitHub release lookup' -Operation {
        Invoke-RestMethod -Uri $releaseApi -Headers $apiHeaders -TimeoutSec 60
    }
    $releaseTag = [string]$release.tag_name
    if ($releaseTag -notmatch '^v\d+\.\d+\.\d+$') {
        throw 'GitHub returned an invalid stable release tag'
    }
    if ($RequestedVersion -ne 'latest' -and $releaseTag -ne $RequestedVersion) {
        throw "GitHub returned release '$releaseTag' while '$RequestedVersion' was requested"
    }
    if ([bool]$release.draft -or [bool]$release.prerelease) {
        throw "release '$releaseTag' is not a published stable release"
    }

    $expectedVersion = $releaseTag.Substring(1)
    $assetName = "a3s-$releaseTag-$target.zip"
    $assets = @($release.assets | Where-Object { $_.name -ceq $assetName })
    if ($assets.Count -ne 1) {
        throw "release $releaseTag does not contain exactly one asset named '$assetName'"
    }
    $asset = $assets[0]
    if ([string]$asset.state -cne 'uploaded') {
        throw "release asset '$assetName' is not in the uploaded state"
    }
    $digestProperty = $asset.PSObject.Properties['digest']
    $digest = if ($null -eq $digestProperty) { '' } else { [string]$digestProperty.Value }
    if ($digest -notmatch '^sha256:([0-9a-fA-F]{64})$') {
        throw "release asset '$assetName' has no valid GitHub SHA-256 digest"
    }
    $expectedSha = $Matches[1].ToLowerInvariant()

    $expectedAssetUrl = "https://github.com/$repository/releases/download/$releaseTag/$assetName"
    if ([string]$asset.browser_download_url -cne $expectedAssetUrl) {
        throw "release asset '$assetName' returned an unexpected download URL"
    }

    $tempDir = Join-Path ([IO.Path]::GetTempPath()) ("a3s-install-$([Guid]::NewGuid().ToString('D'))")
    $archive = Join-Path $tempDir $assetName
    $extracted = Join-Path $tempDir 'extracted'
    $binaryPath = Join-Path $installDir 'a3s.exe'
    $webviewPath = Join-Path $installDir 'a3s-webview.exe'
    $supportPath = Join-Path $installDir 'support'

    $webParent = ''
    $webDir = ''
    $stagedWeb = ''
    $backupWeb = ''
    $failedWeb = ''
    $stagedBinary = ''
    $backupBinary = ''
    $failedBinary = ''
    $stagedWebview = ''
    $backupWebview = ''
    $failedWebview = ''
    $stagedSupport = ''
    $backupSupport = ''
    $failedSupport = ''
    $webActive = $false
    $oldWebSaved = $false
    $binaryActive = $false
    $oldBinarySaved = $false
    $webviewActive = $false
    $oldWebviewSaved = $false
    $supportActive = $false
    $oldSupportSaved = $false
    $webActivationStarted = $false
    $binaryActivationStarted = $false
    $webviewActivationStarted = $false
    $supportActivationStarted = $false
    $hasBundledWebview = $false
    $hasBundledSupport = $false
    $committed = $false
    $installerMutex = $null
    $mutexAcquired = $false
    try {
        $installerMutex = New-Object Threading.Mutex($false, 'Local\A3SInstaller')
        try {
            $mutexAcquired = $installerMutex.WaitOne(0)
        } catch [Threading.AbandonedMutexException] {
            $mutexAcquired = $true
        }
        if (-not $mutexAcquired) {
            throw 'another A3S installer is running'
        }
    } catch {
        if ($null -ne $installerMutex) {
            $installerMutex.Dispose()
        }
        throw "could not acquire the A3S installer lock: $($_.Exception.Message)"
    }

    try {
        [IO.Directory]::CreateDirectory($tempDir) | Out-Null
        Write-InstallerInfo "downloading $assetName"
        Invoke-InstallerRequest -Description "download of $assetName" -Operation {
            if (Test-Path -LiteralPath $archive) {
                Remove-Item -LiteralPath $archive -Force
            }
            Invoke-WebRequest -UseBasicParsing -Uri $expectedAssetUrl -OutFile $archive -TimeoutSec 600 -Headers @{
                'User-Agent' = 'a3s-installer'
            }
        } | Out-Null

        $actualSha = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualSha -ne $expectedSha) {
            throw "SHA-256 mismatch for $assetName (expected $expectedSha, got $actualSha)"
        }
        Write-InstallerInfo "verified SHA-256 $actualSha"

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($archive)
        try {
            $entries = @($zip.Entries)
            if ($entries.Count -gt 50000) {
                throw "release archive contains too many entries: $($entries.Count)"
            }
            [long]$expandedBytes = 0
            foreach ($entry in $entries) {
                $expandedBytes += $entry.Length
                if ($entry.Length -gt 4GB -or $expandedBytes -gt 4GB) {
                    throw 'release archive expands beyond the 4 GiB safety limit'
                }
            }
            $entryNames = @($entries | ForEach-Object { $_.FullName.Replace('\', '/') })
            $webviewEntryCount = @($entryNames | Where-Object { $_ -ceq 'a3s-webview.exe' }).Count
            if (@($entryNames | Where-Object { $_ -ceq 'a3s.exe' }).Count -ne 1 -or
                $webviewEntryCount -gt 1 -or
                @($entryNames | Where-Object { $_ -ceq 'web/index.html' }).Count -ne 1) {
                throw 'release archive must contain exactly one a3s.exe and web/index.html, and at most one a3s-webview.exe'
            }
            $hasBundledWebview = $webviewEntryCount -eq 1
            $supportEntryCount = @($entryNames | Where-Object {
                $_ -ceq 'support' -or $_.StartsWith('support/', [StringComparison]::Ordinal)
            }).Count
            if ($supportEntryCount -gt 0) {
                foreach ($requiredSupportEntry in @(
                    'support/managed-srt/package.json',
                    'support/managed-srt/package-lock.json',
                    'support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js',
                    'support/managed-srt.tree-sha256'
                )) {
                    if (@($entryNames | Where-Object { $_ -ceq $requiredSupportEntry }).Count -ne 1) {
                        throw "release support payload must contain exactly one $requiredSupportEntry"
                    }
                }
                $hasBundledSupport = $true
            }
            $entryKeys = @($entryNames | ForEach-Object { $_.TrimEnd('/') })
            if (@($entryKeys | Group-Object | Where-Object { $_.Count -ne 1 }).Count -ne 0) {
                throw 'release archive contains duplicate paths'
            }
            foreach ($entry in $entries) {
                $entryName = $entry.FullName.Replace('\', '/')
                $unixFileType = (($entry.ExternalAttributes -shr 16) -band 0xF000)
                if ($entryName -notmatch '^(a3s\.exe|a3s-webview\.exe|web/?|web/.+|support/?|support/.+)$' -or
                    ('/' + $entryName + '/') -match '/(\.|\.\.)/' -or
                    $unixFileType -notin @(0, 0x4000, 0x8000) -or
                    ($entry.ExternalAttributes -band [int][IO.FileAttributes]::ReparsePoint) -ne 0) {
                    throw "release archive contains an unsafe or unexpected path: $entryName"
                }
            }
        } finally {
            $zip.Dispose()
        }

        Expand-Archive -LiteralPath $archive -DestinationPath $extracted
        $extractedBinary = Join-Path $extracted 'a3s.exe'
        $extractedWebview = Join-Path $extracted 'a3s-webview.exe'
        $extractedWeb = Join-Path $extracted 'web'
        $extractedSupport = Join-Path $extracted 'support'
        if (-not (Test-Path -LiteralPath $extractedBinary -PathType Leaf) -or
            ($hasBundledWebview -and -not (Test-Path -LiteralPath $extractedWebview -PathType Leaf)) -or
            -not (Test-Path -LiteralPath (Join-Path $extractedWeb 'index.html') -PathType Leaf)) {
            throw 'the extracted release layout is invalid'
        }
        if ($hasBundledSupport) {
            foreach ($requiredSupportPath in @(
                'managed-srt\package.json',
                'managed-srt\package-lock.json',
                'managed-srt\node_modules\@anthropic-ai\sandbox-runtime\dist\cli.js',
                'managed-srt.tree-sha256'
            )) {
                if (-not (Test-Path -LiteralPath (Join-Path $extractedSupport $requiredSupportPath) -PathType Leaf)) {
                    throw "the extracted managed sandbox support payload is missing $requiredSupportPath"
                }
            }
        }
        $reparseEntries = @(Get-ChildItem -LiteralPath $extracted -Recurse -Force |
            Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
        if ($reparseEntries.Count -ne 0) {
            throw "release archive extracted a reparse point: $($reparseEntries[0].FullName)"
        }

        if (-not [string]::IsNullOrWhiteSpace($env:A3S_DATA_HOME)) {
            if (-not (Test-AbsoluteWindowsPath -Path $env:A3S_DATA_HOME)) {
                throw 'A3S_DATA_HOME must be absolute for installer-managed Web assets'
            }
            $dataRoot = [IO.Path]::GetFullPath($env:A3S_DATA_HOME)
        } else {
            $dataRoot = Join-Path $localAppData 'A3S\Data'
        }
        if ($dataRoot.TrimEnd('\', '/') -eq [IO.Path]::GetPathRoot($dataRoot).TrimEnd('\', '/')) {
            throw 'refusing to install Web assets directly below a filesystem root'
        }
        $webParent = Join-Path $dataRoot 'web'
        $webDir = Join-Path $webParent $expectedVersion

        [IO.Directory]::CreateDirectory($webParent) | Out-Null
        Assert-NoReparsePoint -Path $webParent
        $webParent = (Get-Item -LiteralPath $webParent -Force).FullName.TrimEnd('\', '/')
        $webDir = Join-Path $webParent $expectedVersion

        $siblingWeb = Join-Path $installDir 'web\index.html'
        if (Test-Path -LiteralPath $siblingWeb -PathType Leaf) {
            throw "$($siblingWeb | Split-Path -Parent) would override the versioned Web assets; remove that packaged Web directory and retry"
        }
        if ((Split-Path -Leaf $installDir) -ieq 'bin') {
            $prefixWeb = Join-Path (Split-Path -Parent $installDir) 'share\a3s\web'
            if (Test-Path -LiteralPath (Join-Path $prefixWeb 'index.html') -PathType Leaf) {
                throw "$prefixWeb would override the versioned Web assets; remove that packaged Web directory and retry"
            }
        }

        $activationId = [Guid]::NewGuid().ToString('D')
        $stagedWeb = Join-Path $webParent ".a3s-web.new.$activationId"
        $backupWeb = Join-Path $webParent ".a3s-web.backup.$activationId"
        $failedWeb = Join-Path $webParent ".a3s-web.failed.$activationId"
        $stagedBinary = Join-Path $installDir ".a3s.new.$activationId.exe"
        $backupBinary = Join-Path $installDir ".a3s.backup.$activationId.exe"
        $failedBinary = Join-Path $installDir ".a3s.failed.$activationId.exe"
        $stagedWebview = Join-Path $installDir ".a3s-webview.new.$activationId.exe"
        $backupWebview = Join-Path $installDir ".a3s-webview.backup.$activationId.exe"
        $failedWebview = Join-Path $installDir ".a3s-webview.failed.$activationId.exe"
        $stagedSupport = Join-Path $installDir ".a3s-support.new.$activationId"
        $backupSupport = Join-Path $installDir ".a3s-support.backup.$activationId"
        $failedSupport = Join-Path $installDir ".a3s-support.failed.$activationId"

        foreach ($generatedPath in @(
            $stagedWeb, $backupWeb, $failedWeb,
            $stagedBinary, $backupBinary, $failedBinary,
            $stagedWebview, $backupWebview, $failedWebview,
            $stagedSupport, $backupSupport, $failedSupport
        )) {
            if (Test-Path -LiteralPath $generatedPath) {
                throw "temporary activation path already exists: $generatedPath"
            }
        }

        Move-Item -LiteralPath $extractedWeb -Destination $stagedWeb
        Copy-Item -LiteralPath $extractedBinary -Destination $stagedBinary
        if ($hasBundledWebview) {
            Copy-Item -LiteralPath $extractedWebview -Destination $stagedWebview
        }
        if ($hasBundledSupport) {
            Move-Item -LiteralPath $extractedSupport -Destination $stagedSupport
        }
        Assert-A3sVersion -Path $stagedBinary -ExpectedVersion $expectedVersion

        $webActivationStarted = $true
        if (Test-Path -LiteralPath $webDir) {
            Assert-NoReparsePoint -Path $webDir
            $existingReparseEntries = @(Get-ChildItem -LiteralPath $webDir -Recurse -Force |
                Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
            if ($existingReparseEntries.Count -ne 0) {
                throw "refusing to replace Web assets containing a reparse point: $($existingReparseEntries[0].FullName)"
            }
            Move-Item -LiteralPath $webDir -Destination $backupWeb
            $oldWebSaved = $true
        }
        Move-Item -LiteralPath $stagedWeb -Destination $webDir
        $webActive = $true
        $stagedWeb = ''

        if ($hasBundledSupport) {
            $supportActivationStarted = $true
            if (Test-Path -LiteralPath $supportPath) {
                Assert-NoReparsePoint -Path $supportPath
                $existingSupport = Get-Item -LiteralPath $supportPath -Force
                if (-not $existingSupport.PSIsContainer) {
                    throw "$supportPath is not a directory"
                }
                if (-not (Test-Path -LiteralPath (Join-Path $supportPath 'managed-srt\package.json') -PathType Leaf)) {
                    throw "$supportPath is not an installer-managed support directory"
                }
                $supportReparseEntries = @(Get-ChildItem -LiteralPath $supportPath -Recurse -Force |
                    Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
                if ($supportReparseEntries.Count -ne 0) {
                    throw "refusing to replace support assets containing a reparse point: $($supportReparseEntries[0].FullName)"
                }
                Move-Item -LiteralPath $supportPath -Destination $backupSupport
                $oldSupportSaved = $true
            }
            Move-Item -LiteralPath $stagedSupport -Destination $supportPath
            $supportActive = $true
            $stagedSupport = ''
        }

        if ($hasBundledWebview) {
            $webviewActivationStarted = $true
            if (Test-Path -LiteralPath $webviewPath) {
                $existingWebview = Get-Item -LiteralPath $webviewPath -Force
                if (($existingWebview.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                    throw "refusing to replace reparse-point companion $webviewPath"
                }
                if (-not $existingWebview.PSIsContainer) {
                    try {
                        [IO.File]::Replace($stagedWebview, $webviewPath, $backupWebview, $true)
                    } catch {
                        throw "failed to replace $webviewPath; close Agent Island and all running a3s processes, then retry: $($_.Exception.Message)"
                    }
                    $oldWebviewSaved = $true
                    $webviewActive = $true
                    $stagedWebview = ''
                } else {
                    throw "$webviewPath is not a regular file"
                }
            } else {
                Move-Item -LiteralPath $stagedWebview -Destination $webviewPath
                $webviewActive = $true
                $stagedWebview = ''
            }
        }

        $binaryActivationStarted = $true
        if (Test-Path -LiteralPath $binaryPath) {
            $existingBinary = Get-Item -LiteralPath $binaryPath -Force
            if (($existingBinary.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "refusing to replace reparse-point binary $binaryPath"
            }
            try {
                [IO.File]::Replace($stagedBinary, $binaryPath, $backupBinary, $true)
            } catch {
                throw "failed to replace $binaryPath; close all running a3s processes and retry: $($_.Exception.Message)"
            }
            $oldBinarySaved = $true
            $binaryActive = $true
            $stagedBinary = ''
        } else {
            Move-Item -LiteralPath $stagedBinary -Destination $binaryPath
            $binaryActive = $true
            $stagedBinary = ''
        }

        Assert-A3sVersion -Path $binaryPath -ExpectedVersion $expectedVersion

        $committed = $true
        if ($oldWebSaved) {
            try {
                Remove-GeneratedDirectory -Path $backupWeb -ExpectedParent $webParent
                $oldWebSaved = $false
                $backupWeb = ''
            } catch {
                Write-InstallerWarning "could not remove the old Web backup at $backupWeb`: $($_.Exception.Message)"
            }
        }
        if ($oldBinarySaved) {
            try {
                Remove-GeneratedFile -Path $backupBinary -ExpectedParent $installDir
                $oldBinarySaved = $false
                $backupBinary = ''
            } catch {
                Write-InstallerWarning "could not remove the old binary backup at $backupBinary`: $($_.Exception.Message)"
            }
        }
        if ($oldWebviewSaved) {
            try {
                Remove-GeneratedFile -Path $backupWebview -ExpectedParent $installDir
                $oldWebviewSaved = $false
                $backupWebview = ''
            } catch {
                Write-InstallerWarning "could not remove the old WebView helper backup at $backupWebview`: $($_.Exception.Message)"
            }
        }
        if ($oldSupportSaved) {
            try {
                Remove-GeneratedDirectory -Path $backupSupport -ExpectedParent $installDir
                $oldSupportSaved = $false
                $backupSupport = ''
            } catch {
                Write-InstallerWarning "could not remove the old support payload backup at $backupSupport`: $($_.Exception.Message)"
            }
        }

        $pathEntries = @($env:Path -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $pathContainsInstallDir = $false
        foreach ($entry in $pathEntries) {
            if ($entry.TrimEnd('\', '/') -eq $installDir) {
                $pathContainsInstallDir = $true
                break
            }
        }
        if ($UpdatePath) {
            try {
                $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
                $userEntries = @($userPath -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
                $userHasInstallDir = $false
                foreach ($entry in $userEntries) {
                    $expandedEntry = [Environment]::ExpandEnvironmentVariables($entry).TrimEnd('\', '/')
                    if ($expandedEntry -ieq $installDir) {
                        $userHasInstallDir = $true
                        break
                    }
                }
                if (-not $userHasInstallDir) {
                    $newUserPath = (@($userEntries) + $installDir) -join ';'
                    [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
                    Write-InstallerInfo "added $installDir to the user PATH"
                }
                if (-not $pathContainsInstallDir) {
                    $env:Path = (@($pathEntries) + $installDir) -join ';'
                }
                Write-InstallerWarning 'restart your terminal before invoking a3s from a new process'
            } catch {
                Write-InstallerWarning "could not update the user PATH: $($_.Exception.Message)"
                Write-InstallerWarning "add it for this session with: `$env:Path = '$installDir;' + `$env:Path"
            }
        } elseif (-not $pathContainsInstallDir) {
            Write-InstallerWarning "$installDir is not on PATH"
            Write-InstallerWarning "add it for this session with: `$env:Path = '$installDir;' + `$env:Path"
        }

        $resolvedA3s = Get-Command a3s.exe -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($null -ne $resolvedA3s -and $resolvedA3s.Source -ine $binaryPath) {
            Write-InstallerWarning "a3s currently resolves to $($resolvedA3s.Source); ensure $installDir precedes it on PATH"
        }

        Write-InstallerInfo "installed a3s $expectedVersion to $binaryPath"
        if ($hasBundledWebview) {
            Write-InstallerInfo "installed a3s-webview to $webviewPath"
        } else {
            Write-InstallerInfo "release $releaseTag has no bundled a3s-webview; a3s code will install the verified component on first use"
        }
        if ($hasBundledSupport) {
            Write-InstallerInfo "installed managed sandbox support to $supportPath"
        }
        Write-InstallerInfo "installed Web assets to $webDir"
    } finally {
        if (-not $committed) {
            if ($binaryActivationStarted) {
                $stagedBinaryPresent = -not [string]::IsNullOrEmpty($stagedBinary) -and
                    (Test-Path -LiteralPath $stagedBinary)
                if (-not $stagedBinaryPresent) {
                    if (Test-Path -LiteralPath $binaryPath) {
                        try {
                            Move-Item -LiteralPath $binaryPath -Destination $failedBinary
                            $binaryActive = $false
                        } catch {
                            $binaryActive = $true
                            Write-InstallerWarning "could not move the failed binary; the previous binary is preserved at $backupBinary"
                        }
                    } else {
                        $binaryActive = $false
                    }
                } else {
                    $binaryActive = $false
                }

                if (Test-Path -LiteralPath $backupBinary) {
                    if (-not (Test-Path -LiteralPath $binaryPath)) {
                        try {
                            Move-Item -LiteralPath $backupBinary -Destination $binaryPath
                            $oldBinarySaved = $false
                        } catch {
                            $oldBinarySaved = $true
                            Write-InstallerWarning "could not restore the previous binary; its backup is preserved at $backupBinary"
                        }
                    } elseif ($stagedBinaryPresent) {
                        # Activation did not consume the staged binary; the original is still active.
                        $oldBinarySaved = $false
                    } else {
                        $oldBinarySaved = $true
                        Write-InstallerWarning "could not restore the previous binary; its backup is preserved at $backupBinary"
                    }
                } else {
                    $oldBinarySaved = $false
                }
            }

            if ($webviewActivationStarted) {
                $stagedWebviewPresent = -not [string]::IsNullOrEmpty($stagedWebview) -and
                    (Test-Path -LiteralPath $stagedWebview)
                if (-not $stagedWebviewPresent) {
                    if (Test-Path -LiteralPath $webviewPath) {
                        try {
                            Move-Item -LiteralPath $webviewPath -Destination $failedWebview
                            $webviewActive = $false
                        } catch {
                            $webviewActive = $true
                            Write-InstallerWarning "could not move the failed WebView helper; the previous helper is preserved at $backupWebview"
                        }
                    } else {
                        $webviewActive = $false
                    }
                } else {
                    $webviewActive = $false
                }

                if (Test-Path -LiteralPath $backupWebview) {
                    if (-not (Test-Path -LiteralPath $webviewPath)) {
                        try {
                            Move-Item -LiteralPath $backupWebview -Destination $webviewPath
                            $oldWebviewSaved = $false
                        } catch {
                            $oldWebviewSaved = $true
                            Write-InstallerWarning "could not restore the previous WebView helper; its backup is preserved at $backupWebview"
                        }
                    } elseif ($stagedWebviewPresent) {
                        # Activation did not consume the staged companion; the original is still active.
                        $oldWebviewSaved = $false
                    } else {
                        $oldWebviewSaved = $true
                        Write-InstallerWarning "could not restore the previous WebView helper; its backup is preserved at $backupWebview"
                    }
                } else {
                    $oldWebviewSaved = $false
                }
            }

            if ($supportActivationStarted) {
                $stagedSupportPresent = -not [string]::IsNullOrEmpty($stagedSupport) -and
                    (Test-Path -LiteralPath $stagedSupport)
                if (-not $stagedSupportPresent) {
                    if (Test-Path -LiteralPath $supportPath) {
                        try {
                            Move-Item -LiteralPath $supportPath -Destination $failedSupport
                            $supportActive = $false
                        } catch {
                            $supportActive = $true
                            Write-InstallerWarning "could not move the failed support payload; the previous payload is preserved at $backupSupport"
                        }
                    } else {
                        $supportActive = $false
                    }
                } else {
                    $supportActive = $false
                }

                if (Test-Path -LiteralPath $backupSupport) {
                    if (-not (Test-Path -LiteralPath $supportPath)) {
                        try {
                            Move-Item -LiteralPath $backupSupport -Destination $supportPath
                            $oldSupportSaved = $false
                        } catch {
                            $oldSupportSaved = $true
                            Write-InstallerWarning "could not restore the previous support payload; its backup is preserved at $backupSupport"
                        }
                    } elseif ($stagedSupportPresent) {
                        # Activation did not consume the staged payload; the original is still active.
                        $oldSupportSaved = $false
                    } else {
                        $oldSupportSaved = $true
                        Write-InstallerWarning "could not restore the previous support payload; its backup is preserved at $backupSupport"
                    }
                } else {
                    $oldSupportSaved = $false
                }
            }

            if ($webActivationStarted) {
                $stagedWebPresent = -not [string]::IsNullOrEmpty($stagedWeb) -and
                    (Test-Path -LiteralPath $stagedWeb)
                if (-not $stagedWebPresent) {
                    if (Test-Path -LiteralPath $webDir) {
                        try {
                            Move-Item -LiteralPath $webDir -Destination $failedWeb
                            $webActive = $false
                        } catch {
                            $webActive = $true
                            Write-InstallerWarning "could not move the failed Web assets; the previous assets are preserved at $backupWeb"
                        }
                    } else {
                        $webActive = $false
                    }
                } else {
                    $webActive = $false
                }

                if (Test-Path -LiteralPath $backupWeb) {
                    if (-not (Test-Path -LiteralPath $webDir)) {
                        try {
                            Move-Item -LiteralPath $backupWeb -Destination $webDir
                            $oldWebSaved = $false
                        } catch {
                            $oldWebSaved = $true
                            Write-InstallerWarning "could not restore the previous Web assets; their backup is preserved at $backupWeb"
                        }
                    } else {
                        $oldWebSaved = $true
                        Write-InstallerWarning "could not restore the previous Web assets; their backup is preserved at $backupWeb"
                    }
                } else {
                    $oldWebSaved = $false
                }
            }
        }

        if (-not [string]::IsNullOrEmpty($webParent)) {
            foreach ($path in @($stagedWeb, $failedWeb)) {
                try {
                    Remove-GeneratedDirectory -Path $path -ExpectedParent $webParent
                } catch {
                    Write-InstallerWarning "cleanup failed for $path`: $($_.Exception.Message)"
                }
            }
            if ($oldWebSaved) {
                Write-InstallerWarning "preserved the previous Web assets at $backupWeb"
            } else {
                try {
                    Remove-GeneratedDirectory -Path $backupWeb -ExpectedParent $webParent
                } catch {
                    Write-InstallerWarning "cleanup failed for $backupWeb`: $($_.Exception.Message)"
                }
            }
        }
        foreach ($path in @($stagedBinary, $failedBinary)) {
            try {
                Remove-GeneratedFile -Path $path -ExpectedParent $installDir
            } catch {
                Write-InstallerWarning "cleanup failed for $path`: $($_.Exception.Message)"
            }
        }
        foreach ($path in @($stagedWebview, $failedWebview)) {
            try {
                Remove-GeneratedFile -Path $path -ExpectedParent $installDir
            } catch {
                Write-InstallerWarning "cleanup failed for $path`: $($_.Exception.Message)"
            }
        }
        foreach ($path in @($stagedSupport, $failedSupport)) {
            try {
                Remove-GeneratedDirectory -Path $path -ExpectedParent $installDir
            } catch {
                Write-InstallerWarning "cleanup failed for $path`: $($_.Exception.Message)"
            }
        }
        if ($oldBinarySaved) {
            Write-InstallerWarning "preserved the previous binary at $backupBinary"
        } else {
            try {
                Remove-GeneratedFile -Path $backupBinary -ExpectedParent $installDir
            } catch {
                Write-InstallerWarning "cleanup failed for $backupBinary`: $($_.Exception.Message)"
            }
        }
        if ($oldWebviewSaved) {
            Write-InstallerWarning "preserved the previous WebView helper at $backupWebview"
        } else {
            try {
                Remove-GeneratedFile -Path $backupWebview -ExpectedParent $installDir
            } catch {
                Write-InstallerWarning "cleanup failed for $backupWebview`: $($_.Exception.Message)"
            }
        }
        if ($oldSupportSaved) {
            Write-InstallerWarning "preserved the previous support payload at $backupSupport"
        } else {
            try {
                Remove-GeneratedDirectory -Path $backupSupport -ExpectedParent $installDir
            } catch {
                Write-InstallerWarning "cleanup failed for $backupSupport`: $($_.Exception.Message)"
            }
        }
        try {
            Remove-InstallerTempDirectory -Path $tempDir
        } catch {
            Write-InstallerWarning "temporary cleanup failed for $tempDir`: $($_.Exception.Message)"
        }
        if ($null -ne $installerMutex) {
            try {
                if ($mutexAcquired) {
                    $installerMutex.ReleaseMutex()
                }
                $installerMutex.Dispose()
            } catch {
                Write-InstallerWarning "could not release the installer lock: $($_.Exception.Message)"
            }
        }
    }
} $Version $InstallDir $ModifyPath.IsPresent
