# 测试夹具说明

此目录包含 E2E 测试所需的测试数据和资源。

## 目录结构

```
test/fixtures/
├── test-data.ts          # 测试数据定义
├── README.md             # 此说明文件
└── videos/               # 测试视频文件（需要自行添加）
    ├── sample-1.mp4      # 示例视频 1
    └── sample-2.mp4      # 示例视频 2
```

## 测试数据说明

### scriptStyles
- 脚本风格列表
- 用于测试风格选择功能

### scriptConfigs
- 脚本配置参数
- 用于测试参数配置功能

### generatedScripts
- 生成的脚本内容
- 用于测试脚本显示和编辑功能

### videoProjects
- 视频项目数据
- 用于测试待产库功能

### apiResponses
- API 响应模拟数据
- 用于模拟后端 API 响应

### userSettings
- 用户配置数据
- 用于测试设置功能

## 使用方法

在测试文件中导入测试数据：

```typescript
import { scriptStyles, generatedScripts } from '../fixtures/test-data';

test('测试风格选择', async () => {
  const styles = scriptStyles;
  // 使用测试数据...
});
```

## 注意事项

1. 测试视频文件需要自行添加到 `videos/` 目录
2. 测试视频应尽量小（< 10MB）以加快测试速度
3. 测试视频应具有代表性，覆盖不同场景
4. 不要提交版权内容到测试夹具

## 生成测试视频

可以使用 FFmpeg 生成简单的测试视频：

```bash
# 生成 5 秒的测试视频
ffmpeg -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:duration=5 \
  -c:v libx264 -c:a aac test/fixtures/videos/sample-1.mp4

# 生成带颜色的测试视频
ffmpeg -f lavfi -i color=c=blue:duration=5:size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=500:duration=5 \
  -c:v libx264 -c:a aac test/fixtures/videos/sample-2.mp4
```

## 更新测试数据

当应用功能变更时，需要同步更新测试数据：

1. 更新 `test-data.ts` 中的数据结构
2. 确保测试数据与实际 API 响应格式一致
3. 运行测试验证更新后的数据

## 测试数据维护

定期检查测试数据：

- [ ] 测试数据是否与生产数据格式一致
- [ ] 测试数据是否覆盖边界情况
- [ ] 测试数据是否足够多样化
- [ ] 测试数据是否包含必要的字段
