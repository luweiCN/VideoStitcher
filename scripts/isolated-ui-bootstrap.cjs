const path = require('path');
const { app } = require('electron');

// 仅供自动化截图验收使用，允许测试实例与用户正在运行的实例并存。
app.requestSingleInstanceLock = () => true;

process.chdir(path.resolve(__dirname, '..'));
require('../out/main/index.js');
