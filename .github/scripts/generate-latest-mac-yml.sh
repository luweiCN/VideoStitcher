#!/bin/bash
# macOS 更新元数据生成脚本
# 用于生成 electron-updater 需要的 latest-mac.yml 文件

set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
  echo "错误: 未提供版本号"
  echo "用法: $0 <version>"
  exit 1
fi

echo "=== 生成 macOS 更新元数据 ==="
echo "版本: $VERSION"

# 查找 ZIP 文件
ZIP_FILE=$(find out/make -name "*darwin*.zip" | head -1)

if [ -z "$ZIP_FILE" ]; then
  echo "错误: 未找到 macOS ZIP 文件"
  exit 1
fi

echo "找到包: $(basename "$ZIP_FILE")"

ZIP_NAME=$(basename "$ZIP_FILE")
ZIP_SIZE=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SHA512=$(shasum -a 512 "$ZIP_FILE" | awk '{print $1}')

echo "SHA512: $SHA512"
echo "大小: $ZIP_SIZE bytes"

# 生成 YAML 文件
cat > out/make/latest-mac.yml << EOF
version: ${VERSION}
date: "${DATE}"
files:
  - url: https://github.com/luweiCN/VideoStitcher/releases/download/v${VERSION}/${ZIP_NAME}
    sha512: ${SHA512}
    size: ${ZIP_SIZE}
path: ${ZIP_NAME}
sha512: ${SHA512}
releaseNotes: "发布版本 v${VERSION}"
EOF

echo "已生成: out/make/latest-mac.yml"
cat out/make/latest-mac.yml
