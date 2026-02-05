const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    asarUnpack: [
      'node_modules/ffmpeg-static/**',
    ],
  },
  rebuildConfig: {},
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'your-username',
          name: 'videomaster-pro',
        },
        prerelease: false,
      },
    },
  ],
  makers: [
    // Windows ZIP 打包（不需要安装，直接运行）
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    // Windows Squirrel 安装包（支持自动更新）
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'VideoMasterPro',
        authors: 'Your Name',
        description: '全能视频批处理工具箱',
        // 启用增量更新 - Squirrel.Windows 默认支持
        setupIcon: './build/icon.ico',
        loadingGif: './build/install-spinner.gif',
        // 远程更新配置
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
