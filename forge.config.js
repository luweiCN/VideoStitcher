const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    asarUnpack: [
      'node_modules/ffmpeg-static/**',
      'node_modules/sharp/**',
      'node_modules/@img/sharp-darwin-arm64/**',
      'node_modules/@img/sharp-libvips-darwin-arm64/**',
    ],
    // Include renderer build directory despite .gitignore
    ignore: [
      /^\/out\/make/,
      /^\/\.worktrees/,
    ],
  },
  rebuildConfig: {},
  makers: [
    // macOS DMG 安装包
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        // icon: './build/icon.icns',  // TODO: 添加应用图标
      },
    },
    // macOS ZIP（免安装，直接运行）
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      // config: {
      //   icon: './build/icon.icns',  // TODO: 添加应用图标
      // },
    },
    // Windows ZIP 打包（不需要安装，直接运行）
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
      config: {
        icon: './build/icon.ico',
      },
    },
    // Windows Squirrel 安装包（支持自动更新）
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'VideoMasterPro',
        authors: 'Your Name',
        description: '全能视频批处理工具箱',
        setupIcon: './build/icon.ico',
        loadingGif: './build/install-spinner.gif',
        remoteReleases: true,
      },
    },
    // Linux 相关（可选）
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  hooks: {
    postPackage: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
      // macOS: Copy native dependencies to fix runtime loading
      // buildPath.outputPaths[0] contains the directory with the .app bundle
      const packageDir = buildPath.outputPaths[0];
      const entries = fs.readdirSync(packageDir, { withFileTypes: true });
      const appEntry = entries.find(e => e.name.endsWith('.app') && e.isDirectory());

      if (!appEntry) {
        return; // Not macOS, skip this hook
      }

      const appPath = packageDir + '/' + appEntry.name;
      const resourcesPath = appPath + '/Contents/Resources';
      const asarUnpackedPath = resourcesPath + '/app.asar.unpacked';

      // Recursively copy directory
      const copyDir = (src, dest) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        entries.forEach(entry => {
          const srcPath = src + '/' + entry.name;
          const destPath = dest + '/' + entry.name;
          if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        });
      };

      // Copy Sharp libvips
      const sourceLibvips = process.cwd() + '/node_modules/@img/sharp-libvips-darwin-arm64';
      if (fs.existsSync(sourceLibvips)) {
        const targetImgDir = asarUnpackedPath + '/node_modules/@img';
        const sharpLibvipsPath = targetImgDir + '/sharp-libvips-darwin-arm64';
        fs.mkdirSync(targetImgDir, { recursive: true });
        fs.mkdirSync(sharpLibvipsPath, { recursive: true });
        copyDir(sourceLibvips, sharpLibvipsPath);
        console.log('✅ Copied sharp-libvips-darwin-arm64 for macOS packaging');
      }

      // Copy ffmpeg-static
      const sourceFfmpeg = process.cwd() + '/node_modules/ffmpeg-static';
      if (fs.existsSync(sourceFfmpeg)) {
        const targetFfmpegDir = asarUnpackedPath + '/node_modules/ffmpeg-static';
        fs.mkdirSync(targetFfmpegDir, { recursive: true });
        copyDir(sourceFfmpeg, targetFfmpegDir);
        console.log('✅ Copied ffmpeg-static for macOS packaging');
      }
    },
  },
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
