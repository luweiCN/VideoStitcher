#!/usr/bin/env node

/**
 * 授权管理脚本
 * 用于管理 VideoStitcher 的授权文件
 *
 * 使用方法:
 *   node scripts/manage-license.js add <machine-id> --user "用户名"
 *   node scripts/manage-license.js remove <machine-id>
 *   node scripts/manage-license.js list
 *   node scripts/manage-license.js enable <machine-id>
 *   node scripts/manage-license.js disable <machine-id>
 */

const fs = require('fs');
const path = require('path');

// 授权文件路径
const LICENSE_FILE_PATH = path.join(__dirname, '..', 'licenses.json');

/**
 * 初始化授权文件
 */
function initLicenseFile() {
  if (!fs.existsSync(LICENSE_FILE_PATH)) {
    const initialData = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      licenses: []
    };
    fs.writeFileSync(LICENSE_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    console.log('✅ 已创建新的授权文件:', LICENSE_FILE_PATH);
  }
}

/**
 * 读取授权文件
 */
function readLicenseFile() {
  if (!fs.existsSync(LICENSE_FILE_PATH)) {
    initLicenseFile();
  }
  const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * 写入授权文件
 */
function writeLicenseFile(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(LICENSE_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ 授权文件已更新');
}

/**
 * 添加授权
 */
function addLicense(machineId, user = '未知用户') {
  const data = readLicenseFile();

  // 检查是否已存在
  const existingIndex = data.licenses.findIndex(l => l.machineId === machineId);
  if (existingIndex !== -1) {
    // 更新现有授权
    data.licenses[existingIndex] = {
      machineId,
      user,
      enabled: true,
      updatedAt: new Date().toISOString()
    };
    console.log(`✅ 已更新授权: ${user} (${machineId})`);
  } else {
    // 添加新授权
    data.licenses.push({
      machineId,
      user,
      enabled: true,
      createdAt: new Date().toISOString()
    });
    console.log(`✅ 已添加授权: ${user} (${machineId})`);
  }

  writeLicenseFile(data);
}

/**
 * 移除授权
 */
function removeLicense(machineId) {
  const data = readLicenseFile();

  const index = data.licenses.findIndex(l => l.machineId === machineId);
  if (index === -1) {
    console.log(`❌ 未找到机器 ID: ${machineId}`);
    return;
  }

  const removed = data.licenses.splice(index, 1)[0];
  console.log(`✅ 已移除授权: ${removed.user} (${machineId})`);

  writeLicenseFile(data);
}

/**
 * 启用授权
 */
function enableLicense(machineId) {
  const data = readLicenseFile();

  const license = data.licenses.find(l => l.machineId === machineId);
  if (!license) {
    console.log(`❌ 未找到机器 ID: ${machineId}`);
    return;
  }

  if (license.enabled) {
    console.log(`ℹ️ 授权已是启用状态: ${license.user} (${machineId})`);
    return;
  }

  license.enabled = true;
  console.log(`✅ 已启用授权: ${license.user} (${machineId})`);

  writeLicenseFile(data);
}

/**
 * 禁用授权
 */
function disableLicense(machineId) {
  const data = readLicenseFile();

  const license = data.licenses.find(l => l.machineId === machineId);
  if (!license) {
    console.log(`❌ 未找到机器 ID: ${machineId}`);
    return;
  }

  if (!license.enabled) {
    console.log(`ℹ️ 授权已是禁用状态: ${license.user} (${machineId})`);
    return;
  }

  license.enabled = false;
  console.log(`✅ 已禁用授权: ${license.user} (${machineId})`);

  writeLicenseFile(data);
}

/**
 * 列出所有授权
 */
function listLicenses() {
  const data = readLicenseFile();

  console.log('\n📋 授权列表:');
  console.log(`版本: ${data.version}`);
  console.log(`更新时间: ${data.updatedAt}`);
  console.log(`总数: ${data.licenses.length}\n`);

  if (data.licenses.length === 0) {
    console.log('暂无授权');
    return;
  }

  data.licenses.forEach((license, index) => {
    const status = license.enabled ? '✅ 启用' : '❌ 禁用';
    console.log(`${index + 1}. ${status}`);
    console.log(`   用户: ${license.user}`);
    console.log(`   机器 ID: ${license.machineId}`);
    if (license.createdAt) {
      console.log(`   创建时间: ${license.createdAt}`);
    }
    if (license.updatedAt) {
      console.log(`   更新时间: ${license.updatedAt}`);
    }
    console.log('');
  });
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
授权管理脚本

使用方法:
  node scripts/manage-license.js <命令> [参数]

命令:
  add <machine-id> --user "用户名"    添加新授权
  remove <machine-id>                 移除授权
  enable <machine-id>                 启用授权
  disable <machine-id>                禁用授权
  list                                列出所有授权

示例:
  node scripts/manage-license.js add abc123 --user "张三"
  node scripts/manage-license.js remove abc123
  node scripts/manage-license.js list
  node scripts/manage-license.js disable abc123

注意:
  添加或修改授权后，需要将 licenses.json 文件上传到 GitHub Release
  Release 标签: licenses
`);
}

// 主函数
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'add': {
      const machineId = args[1];
      const userIndex = args.indexOf('--user');
      const user = userIndex !== -1 ? args[userIndex + 1] : '未知用户';

      if (!machineId) {
        console.log('❌ 请提供机器 ID');
        printHelp();
        return;
      }

      addLicense(machineId, user);
      break;
    }

    case 'remove': {
      const machineId = args[1];

      if (!machineId) {
        console.log('❌ 请提供机器 ID');
        printHelp();
        return;
      }

      removeLicense(machineId);
      break;
    }

    case 'enable': {
      const machineId = args[1];

      if (!machineId) {
        console.log('❌ 请提供机器 ID');
        printHelp();
        return;
      }

      enableLicense(machineId);
      break;
    }

    case 'disable': {
      const machineId = args[1];

      if (!machineId) {
        console.log('❌ 请提供机器 ID');
        printHelp();
        return;
      }

      disableLicense(machineId);
      break;
    }

    case 'list': {
      listLicenses();
      break;
    }

    case 'help':
    case '--help':
    case '-h': {
      printHelp();
      break;
    }

    default: {
      console.log(`❌ 未知命令: ${command}`);
      printHelp();
    }
  }
}

// 运行
main();
