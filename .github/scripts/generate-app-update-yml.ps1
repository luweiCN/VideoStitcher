# 生成 app-update.yml 文件
# electron-updater 需要这个文件来配置更新服务器

param(
    [Parameter(Mandatory=$false)]
    [string]$PackageDir = "out"
)

$ErrorActionPreference = "Stop"

$Version = (node -p "require('./package.json').version")
$Owner = "luweiCN"
$Repo = "VideoStitcher"

Write-Host "=== 生成 app-update.yml ===" -ForegroundColor Cyan
Write-Host "版本: $Version"
Write-Host "仓库: $Owner/$Repo"

# 查找所有打包后的应用目录
$AppDirs = Get-ChildItem $PackageDir -Directory -Filter "VideoStitcher-*"

if ($AppDirs.Count -eq 0) {
    Write-Host "未找到打包的应用目录" -ForegroundColor Yellow
    exit 0
}

foreach ($AppDir in $AppDirs) {
    $ResourcesPath = Join-Path $AppDir.FullName "resources"

    if (-not (Test-Path $ResourcesPath)) {
        Write-Host "跳过 $($AppDir.Name): 不存在 resources 目录" -ForegroundColor Yellow
        continue
    }

    # 生成 app-update.yml 内容
    $YamlContent = @"
owner: ${Owner}
repo: ${Repo}
provider: github
"@

    $OutputPath = Join-Path $ResourcesPath "app-update.yml"
    $YamlContent | Out-File -FilePath $OutputPath -Encoding UTF8 -NoNewline

    Write-Host "已生成: $OutputPath" -ForegroundColor Green
}

Write-Host "完成！" -ForegroundColor Green
