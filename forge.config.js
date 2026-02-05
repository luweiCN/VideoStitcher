const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: {
      unpack: [
        '**/node_modules/{ffmpeg-static,sharp,@img}/**',
      ],
    },
    // 在打包前确保 app-update.yml 存在
    // 使用 extraResource 将文件复制到 resources 目录
    extraResource: [
      'build/app-update.yml',
    ],
    // Include renderer build directory despite .gitignore
    ignore: [
      /^\/out\/make/,
      /^\/\.worktrees/,
    ],
  },
  rebuildConfig: {},
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'luweiCN',
          name: 'VideoStitcher',
        },
        draft: false,
        prerelease: false,
      },
    },
  ],
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
      // Note: icon requires ./build/icon.ico to exist
      // config: {
      //   icon: './build/icon.ico',
      // },
    },
    // Windows WiX 安装包（支持自动更新，替代已弃用的 Squirrel）
    {
      name: '@electron-forge/maker-wix',
      config: {
        name: 'VideoStitcher',
        manufacturer: 'Your Name',
        description: '全能视频批处理工具箱',
        // 创建桌面快捷方式
        shortcutDesktop: true,
        // 创建开始菜单快捷方式
        shortcutStartMenu: true,
        // 启用自动更新功能
        appUserModelId: 'com.videostitcher.app',
        // 安装目录
        installDirectory: '%LOCALAPPDATA%\\VideoStitcher',
        // 升级时无需管理员权限
        perMachine: false,
      },
    },
    // Linux 相关（可选）
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {},
    },
  ],
  hooks: {
    postPackage: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
      const packageDir = buildPath.outputPaths[0];

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

      // macOS handling
      if (platform === 'darwin') {
        const entries = fs.readdirSync(packageDir, { withFileTypes: true });
        const appEntry = entries.find(e => e.name.endsWith('.app') && e.isDirectory());

        if (appEntry) {
          const appPath = packageDir + '/' + appEntry.name;
          const resourcesPath = appPath + '/Contents/Resources';
          const asarUnpackedPath = resourcesPath + '/app.asar.unpacked';

          // Copy ffmpeg-static (note: sharp is handled by asar.unpack config)
          const sourceFfmpeg = process.cwd() + '/node_modules/ffmpeg-static';
          if (fs.existsSync(sourceFfmpeg)) {
            const targetFfmpegDir = asarUnpackedPath + '/node_modules/ffmpeg-static';
            fs.mkdirSync(targetFfmpegDir, { recursive: true });
            copyDir(sourceFfmpeg, targetFfmpegDir);
            console.log('✅ Copied ffmpeg-static for macOS packaging');
          }

          // 为 macOS 添加 app-update.yml
          const appUpdateYmlContent = 'owner: luweiCN\nrepo: VideoStitcher\nprovider: github\n';
          const appUpdatePath = resourcesPath + '/app-update.yml';
          fs.writeFileSync(appUpdatePath, appUpdateYmlContent, 'utf-8');
          console.log('✅ Added app-update.yml for macOS');
        }
      }

      // Windows handling
      if (platform === 'win32') {
        // Windows: resourcesPath is the exe directory
        const resourcesPath = packageDir + '/resources';
        const asarUnpackedPath = resourcesPath + '/app.asar.unpacked';

        // Copy ffmpeg-static
        const sourceFfmpeg = process.cwd() + '/node_modules/ffmpeg-static';
        if (fs.existsSync(sourceFfmpeg)) {
          const targetFfmpegDir = asarUnpackedPath + '/node_modules/ffmpeg-static';
          fs.mkdirSync(targetFfmpegDir, { recursive: true });
          copyDir(sourceFfmpeg, targetFfmpegDir);
          console.log('✅ Copied ffmpeg-static for Windows packaging');
        }

        // 生成 app-update.yml (electron-updater 需要此文件来配置更新服务器)
        const appUpdateYmlContent = 'owner: luweiCN\nrepo: VideoStitcher\nprovider: github\n';
        const appUpdatePath = resourcesPath + '/app-update.yml';
        fs.writeFileSync(appUpdatePath, appUpdateYmlContent, 'utf-8');
        console.log('✅ Generated app-update.yml for Windows auto-update');
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
