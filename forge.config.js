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
  makers: [
    // Windows ZIP 打包（不需要安装，直接运行）
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    // Windows Squirrel 安装包（可选，可能因路径问题失败）
    // {
    //   name: '@electron-forge/maker-squirrel',
    //   config: {
    //     name: 'VideoStitcher',
    //     authors: 'Your Name',
    //     description: '视频拼接工具 - 将两个视频文件前后拼接合成',
    //   },
    // },
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
