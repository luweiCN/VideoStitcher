# Windows 更新元数据生成脚本
# 用于生成 electron-updater 需要的 latest.yml 文件

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

$SquirrelDir = "out/make/squirrel.windows/x64"

Write-Host "=== 生成 Windows 更新元数据 ===" -ForegroundColor Cyan
Write-Host "版本: $Version"
Write-Host "目录: $SquirrelDir"

# 查找 nupkg 文件
$NupkgFile = Get-ChildItem $SquirrelDir -Filter "*-full.nupkg" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $NupkgFile) {
    Write-Host "错误: 未找到 full.nupkg 文件" -ForegroundColor Red
    exit 1
}

Write-Host "找到包: $($NupkgFile.Name)"

$NupkgName = $NupkgFile.Name
$NupkgSize = $NupkgFile.Length
$NupkgHash = (Get-FileHash -Algorithm SHA256 -Path $NupkgFile.FullName).Hash.ToLower()

Write-Host "SHA256: $NupkgHash"
Write-Host "大小: $NupkgSize bytes"

# 生成 YAML 内容
$YamlContent = @"
version: $Version
files:
  - url: $NupkgName
    sha512: $NupkgHash
    size: $NupkgSize
path: $NupkgName
sha512: $NupkgHash
releaseNotes: Release v$Version
"@

$OutputPath = Join-Path $SquirrelDir "latest.yml"
$YamlContent | Out-File -FilePath $OutputPath -Encoding UTF8 -NoNewline

Write-Host "已生成: $OutputPath" -ForegroundColor Green
Get-Content $OutputPath
