# 导演模式完整工作流重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构导演模式的聊天工作流和画板交互，实现艺术总监、选角导演、分镜师、摄像导演四个 Agent 的完整协作流程，包含消息展示、用户确认、画板实时更新等功能。

**Architecture:**
- 前端：React 组件（ChatPanel、NodeCanvas、CanvasPanel）管理消息流和画板状态
- 后端：LangGraph 工作流执行 5 个 Agent（剧本写作、艺术总监、选角导演、分镜师、摄像导演）
- 通信：Electron IPC 连接前后端，支持流式消息推送

**Tech Stack:** React, TypeScript, Electron, LangGraph, SQLite

---

## 前置修复

### Task 0: 修复角色生成的 forEach 错误

**问题:** `convertToCharacter` 函数期望艺术总监的完整输出对象，但被传入了数组。

**Files:**
- Modify: `src/main/ipc/director-mode-handlers.ts:110-135`

**Step 1: 修复 convertToCharacter 调用**

```typescript
// 当前错误代码：
const characters = result.state.step2_characters.content;
return {
  success: true,
  characters: convertToCharacter(characters),
};

// 修复为：
const artDirectorOutput = result.state.step2_characters.content;
return {
  success: true,
  characters: convertToCharacter(artDirectorOutput),
};
```

**Step 2: 验证修复**

运行: `npm run build`
Expected: 构建成功，无 forEach 错误

**Step 3: Commit**

```bash
git add src/main/ipc/director-mode-handlers.ts
git commit -m "fix: 修复角色生成的 forEach 错误

convertToCharacter 函数期望艺术总监的完整输出对象
而不是数组，修正调用方式"
```

---

## 阶段一：艺术总监流程

### Task 1: 重构 ChatPanel - 艺术总监确定视频规格

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:100-250`

**Step 1: 修改初始消息逻辑**

删除所有 `addAgentMessageWithDelay` 调用，改为用户选择视频规格后的响应。

**Step 2: 添加视频规格选择消息**

```typescript
// 在 useEffect 中添加
useEffect(() => {
  setTimeout(() => {
    addAgentMessageWithDelay(
      'art-director',
      '您好！我是您的AI艺术总监。在开始创作前，请确认视频规格：',
      1500,
      [
        { label: '短视频 (15s以下)', value: 'short' },
        { label: '长视频 (15-30s)', value: 'long' },
      ]
    );
  }, 800);
}, []);
```

**Step 3: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx
git commit -m "refactor: 艺术总监首先询问视频规格"
```

---

### Task 2: 艺术总监创作角色和场景

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:120-250`

**Step 1: 修改视频规格选择后的处理**

```typescript
// 在 handleOptionClick 中添加
if (currentStep === 'art-director' && optionKey === 'duration') {
  videoSpec.duration = optionValue as 'short' | 'long';

  // 记录用户选择
  const userMessage: Message = {
    id: `user-duration-${Date.now()}`,
    agentId: 'user',
    type: 'text',
    content: `已选择：${optionLabel}`,
    timestamp: new Date(),
  };
  setMessages((prev) => [...prev, userMessage]);

  // 艺术总监继续询问方向
  setTimeout(() => {
    addAgentMessage(
      'art-director',
      '请选择视频方向：',
      [
        { label: '竖版 (9:16)', value: 'portrait' },
        { label: '横版 (16:9)', value: 'landscape' },
      ]
    );
  }, 500);
}

if (currentStep === 'art-director' && optionKey === 'aspectRatio') {
  videoSpec.aspectRatio = optionValue as 'portrait' | 'landscape';

  const userMessage: Message = {
    id: `user-aspect-${Date.now()}`,
    agentId: 'user',
    type: 'text',
    content: `已选择：${optionLabel}`,
    timestamp: new Date(),
  };
  setMessages((prev) => [...prev, userMessage]);

  // 艺术总监确认规格并开始创作
  const durationText = videoSpec.duration === 'short' ? '短视频 (15s以下)' : '长视频 (15-30s)';
  const ratioText = videoSpec.aspectRatio === 'portrait' ? '竖版 (9:16)' : '横版 (16:9)';

  addAgentMessageWithDelay(
    'art-director',
    `【已确认规格】 ${durationText} | ${ratioText} 接下来我将根据您的剧本为您设计人物角色和场景`,
    1200
  );

  // 进入创作状态
  setCurrentStep('art-director-creating');
  setIsProcessing(true);

  // 发送 typing 消息
  const typingMessage: Message = {
    id: `typing-${Date.now()}`,
    agentId: 'art-director',
    type: 'typing',
    content: '正在创作角色和场景...',
    timestamp: new Date(),
  };
  setMessages((prev) => [...prev, typingMessage]);
}
```

**Step 2: 调用后台 API 创作角色**

```typescript
// 在确认规格后调用
try {
  await delay(2000);
  const result = await directorMode.generateCharacters();

  // 移除 typing 消息
  setMessages((prev) => prev.filter(m => m.type !== 'typing'));

  if (result && result.length > 0) {
    const characterNames = result.map(c => c.name).join('、');

    addAgentMessage(
      'art-director',
      `创作完成！我为您创作了以下角色：\n\n${result.map((c, i) =>
      `${i + 1}. ${c.name}（${c.description.split('\n')[0]}）`
    ).join('\n')}\n\n故事的场景设定是：${getSceneDescription(result)}，您看是否需要修改`,
      [
        { label: '重新生成', value: 'regenerate' },
        { label: '无需修改', value: 'confirm' },
      ]
    );

    setIsProcessing(false);
    setCurrentStep('art-director-confirm');
  }
} catch (error) {
  addAgentMessage('art-director', `创作失败：${error.message}`);
  setIsProcessing(false);
}
```

**Step 3: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx
git commit -m "feat: 艺术总监创作角色和场景流程"
```

---

### Task 3: 用户确认角色，邀请选角导演

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:250-300`

**Step 1: 处理用户确认选择**

```typescript
// 在 handleOptionClick 中添加
if (currentStep === 'art-director-confirm') {
  if (optionValue === 'regenerate') {
    // 重新生成
    addAgentMessage('user', '请重新生成角色');
    // 重新调用创作流程...
  } else if (optionValue === 'confirm') {
    addAgentMessage('user', '无需修改，确认角色和场景');

    addAgentMessageWithDelay(
      'art-director',
      '好的，角色和场景已经确定。接下来需要选角导演为我们的剧本挑选演员。',
      1500
    );

    // 系统消息：邀请选角导演
    setTimeout(() => {
      const systemMessage: Message = {
        id: `system-invite-casting`,
        agentId: 'system',
        type: 'text',
        content: '系统消息：艺术总监邀请选角导演加入群聊',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, systemMessage]);

      // 选角导演自我介绍
      setTimeout(() => {
        addAgentMessage(
          'casting-director',
          '大家好！我是选角导演，负责为我们的剧本挑选演员。对于演员的形象，请问您这边有需要我参考的方向还是让我自由发挥呢？',
          [
            { label: '上传参考图', value: 'upload' },
            { label: '自由发挥', value: 'free' },
          ]
        );
        setCurrentStep('casting-director-start');
      }, 800);
    }, 1000);
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx
git commit -m "feat: 用户确认角色后邀请选角导演"
```

---

## 阶段二：选角导演流程

### Task 4: 选角导演生成人物形象（三视图）

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:300-450`
- Modify: `src/main/ipc/director-mode-handlers.ts:300-400` (添加生成人物形象的 API)

**Step 1: 添加生成人物形象的 IPC handler**

在 `director-mode-handlers.ts` 中添加：

```typescript
// ===== 生成人物形象 =====
ipcMain.handle('aside:generate-character-image', async (_event, data: {
  screenplayId: string,
  characterId: string,
  useReference: boolean
}) => {
  console.log('[DirectorMode] 生成人物形象:', data);

  try {
    const state = workflowStates.get(screenplayId);
    if (!state) {
      throw new Error('工作流状态不存在');
    }

    // 调用选角导演 Agent 生成人物形象（正、侧、后三视图）
    // TODO: 调用图像生成 API
    const imageUrl = `https://example.com/character-${characterId}.png`;

    return {
      success: true,
      imageUrl,
    };
  } catch (error) {
    console.error('[DirectorMode] 生成人物形象失败:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
});
```

**Step 2: 前端处理选角导演开始创作**

```typescript
// 在 ChatPanel.tsx 中
if (currentStep === 'casting-director-start') {
  if (optionValue === 'upload') {
    addAgentMessage('user', '我将上传参考图');
    addAgentMessage('casting-director', '请上传您的参考图...');
  } else {
    addAgentMessage('user', '自由发挥');

    addAgentMessageWithDelay(
      'casting-director',
      '收到！开始为您创作角色形象...',
      1200
    );

    setCurrentStep('casting-director-generating');
    setIsProcessing(true);

    // 获取角色列表
    const characters = directorMode.state.characters;

    // 逐个生成人物形象
    for (let i = 0; i < characters.length; i++) {
      const character = characters[i];

      // 发送 typing 消息
      const typingMessage: Message = {
        id: `typing-char-${i}`,
        agentId: 'casting-director',
        type: 'typing',
        content: `正在为 ${character.name} 生成形象（正、侧、后三视图）...`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, typingMessage]);

      try {
        // 调用 API 生成形象
        const result = await window.api.asideGenerateCharacterImage({
          screenplayId,
          characterId: character.id,
          useReference: false,
        });

        // 移除 typing 消息
        setMessages((prev) => prev.filter(m => m.id !== `typing-char-${i}`));

        if (result.success && result.imageUrl) {
          // 发送人物形象消息
          const characterMessage: Message = {
            id: `char-img-${i}`,
            agentId: 'casting-director',
            type: 'character-image',
            content: `这是我找到的${i === 0 ? '主演' : '演员'} ${character.name}（正、侧、后三视图），您看怎么样`,
            characterData: {
              name: character.name,
              description: character.description,
              imageUrl: result.imageUrl,
              isImageLoading: false,
            },
            options: [
              { label: '重新生成', value: `regenerate-${i}` },
              { label: '确认', value: `confirm-${i}` },
            ],
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, characterMessage]);

          // 更新画板角色卡片
          directorMode.updateCharacterImage(character.id, result.imageUrl);
        }
      } catch (error) {
        addAgentMessage('casting-director', `生成 ${character.name} 的形象失败：${error.message}`);
      }

      await delay(1000);
    }

    setIsProcessing(false);
    setCurrentStep('casting-director-confirm');
  }
}
```

**Step 3: Commit**

```bash
git add src/main/ipc/director-mode-handlers.ts src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx
git commit -m "feat: 选角导演生成人物形象（三视图）"
```

---

### Task 5: 用户确认所有人物形象

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:450-500`

**Step 1: 跟踪用户确认状态**

```typescript
// 添加状态
const [confirmedCharacters, setConfirmedCharacters] = useState<Set<string>>(new Set());

// 在 handleOptionClick 中处理
if (currentStep === 'casting-director-confirm') {
  if (optionValue.startsWith('regenerate-')) {
    const index = parseInt(optionValue.split('-')[1]);
    const character = directorMode.state.characters[index];

    addAgentMessage('user', `请重新生成 ${character.name} 的形象`);
    // 重新生成该角色形象...
  } else if (optionValue.startsWith('confirm-')) {
    const index = parseInt(optionValue.split('-')[1]);
    const character = directorMode.state.characters[index];

    setConfirmedCharacters(prev => new Set(prev).add(character.id));
    addAgentMessage('user', `确认 ${character.name} 的形象`);

    // 检查是否全部确认
    if (confirmedCharacters.size === directorMode.state.characters.length) {
      addAgentMessageWithDelay(
        'casting-director',
        '太好了！所有演员形象已确认。接下来需要分镜师为我们绘制分镜。',
        1500
      );

      // 系统消息：邀请分镜师
      setTimeout(() => {
        const systemMessage: Message = {
          id: `system-invite-storyboard`,
          agentId: 'system',
          type: 'text',
          content: '系统消息：艺术总监邀请分镜师加入群聊',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMessage]);

        // 分镜师自我介绍
        setTimeout(() => {
          addAgentMessageWithDelay(
            'storyboard-artist',
            '大家好！我是这个项目的分镜师。我看到了项目的剧本、人物和场景设定了，接下来我开始进行分镜绘制。',
            1200
          );

          setCurrentStep('storyboard-artist-generating');
          setIsProcessing(true);

          // 发送 typing 消息
          const typingMessage: Message = {
            id: `typing-storyboard`,
            agentId: 'storyboard-artist',
            type: 'typing',
            content: '正在绘制 5x5 分镜图...',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, typingMessage]);

          // 调用 API 生成分镜
          setTimeout(async () => {
            try {
              await directorMode.generateStoryboard();

              // 移除 typing 消息
              setMessages((prev) => prev.filter(m => m.id !== 'typing-storyboard'));

              addAgentMessage(
                'storyboard-artist',
                '这是我为我们项目绘制的分镜图（5x5），请审核',
                [
                  { label: '重新生成', value: 'regenerate-storyboard' },
                  { label: '确认', value: 'confirm-storyboard' },
                ]
              );

              setIsProcessing(false);
              setCurrentStep('storyboard-artist-confirm');
            } catch (error) {
              addAgentMessage('storyboard-artist', `分镜生成失败：${error.message}`);
              setIsProcessing(false);
            }
          }, 3000);
        }, 800);
      }, 1000);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx
git commit -m "feat: 用户确认人物形象后邀请分镜师"
```

---

## 阶段三：分镜师和摄像导演流程

### Task 6: 分镜师确认，邀请摄像导演

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:500-600`

**Step 1: 处理分镜确认**

```typescript
if (currentStep === 'storyboard-artist-confirm') {
  if (optionValue === 'regenerate-storyboard') {
    addAgentMessage('user', '请重新生成分镜图');
    // 重新生成分镜...
  } else if (optionValue === 'confirm-storyboard') {
    addAgentMessage('user', '确认分镜图');

    addAgentMessageWithDelay(
      'storyboard-artist',
      '分镜图已确认。接下来需要摄像导演进行拍摄。',
      1500
    );

    // 系统消息：邀请摄像导演
    setTimeout(() => {
      const systemMessage: Message = {
        id: `system-invite-camera`,
        agentId: 'system',
        type: 'text',
        content: '系统消息：艺术总监要求摄像导演加入群聊',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, systemMessage]);

      // 摄像导演自我介绍
      setTimeout(() => {
        addAgentMessageWithDelay(
          'camera-director',
          '大家好！我是这个项目的摄像导演。我现在去片场进行拍摄。',
          1200
        );

        setCurrentStep('camera-director-generating');
        setIsProcessing(true);

        // 发送 typing 消息
        const typingMessage: Message = {
          id: `typing-camera`,
          agentId: 'camera-director',
          type: 'typing',
          content: '正在拍摄视频...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, typingMessage]);

        // 调用 API 生成视频
        setTimeout(async () => {
          try {
            await directorMode.generateVideo();

            // 移除 typing 消息
            setMessages((prev) => prev.filter(m => m.id !== 'typing-camera'));

            // 根据视频时长可能生成1-2条视频
            addAgentMessage(
              'camera-director',
              '拍摄完成！我生成了以下视频片段，请审核：',
              [
                { label: '重新生成', value: 'regenerate-video' },
                { label: '确认', value: 'confirm-video' },
              ]
            );

            setIsProcessing(false);
            setCurrentStep('camera-director-confirm');
          } catch (error) {
            addAgentMessage('camera-director', `拍摄失败：${error.message}`);
            setIsProcessing(false);
          }
        }, 3000);
      }, 800);
    }, 1000);
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx
git commit -m "feat: 分镜师确认后邀请摄像导演"
```

---

### Task 7: 摄像导演确认，拼接视频

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:600-700`

**Step 1: 处理视频确认**

```typescript
if (currentStep === 'camera-director-confirm') {
  if (optionValue === 'regenerate-video') {
    addAgentMessage('user', '请重新生成视频');
    // 重新生成视频...
  } else if (optionValue === 'confirm-video') {
    addAgentMessage('user', '确认视频');

    setIsProcessing(true);

    // 拼接视频
    addAgentMessageWithDelay(
      'camera-director',
      '正在拼接视频...',
      1200
    );

    setTimeout(async () => {
      try {
        // 调用拼接 API
        const result = await window.api.asideComposeVideo(screenplayId);

        if (result.success) {
          addAgentMessageWithDelay(
            'camera-director',
            '✅ 视频拼接完成！已保存到本地。',
            1500
          );

          setIsProcessing(false);

          // 艺术总监总结祝贺
          setTimeout(() => {
            addAgentMessageWithDelay(
              'art-director',
              '🎉 恭喜！项目成功完成！感谢整个团队的协作！\n\n✨ 剧本创作：完成\n✨ 角色设计：完成\n✨ 演员形象：完成\n✨ 分镜绘制：完成\n✨ 视频拍摄：完成\n\n期待您的下一个作品！',
              2000
            );

            setCurrentStep('completed');

            // 触发完成回调
            onComplete?.();
          }, 1500);
        }
      } catch (error) {
        addAgentMessage('camera-director', `视频拼接失败：${error.message}`);
        setIsProcessing(false);
      }
    }, 2000);
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx
git commit -m "feat: 摄像导演确认后拼接视频并总结"
```

---

## 阶段四：画板同步更新

### Task 8: 实现画板卡片同步

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/CanvasPanel.tsx:100-230`
- Modify: `src/renderer/pages/ASide/hooks/useDirectorMode.ts`

**Step 1: 添加人物形象卡片更新**

```typescript
// 在 CanvasPanel.tsx 中
interface CanvasPanelProps {
  characters?: Character[];
  characterImages?: Map<string, string>; // characterId -> imageUrl
  storyboard?: Storyboard;
  videos?: Video[];
  // ... 其他 props
}

// 显示角色时使用 imageUrl
{characters.map((character) => {
  const imageUrl = characterImages?.get(character.id) || character.imageUrl;

  return (
    <div key={character.id}>
      {/* 角色头像 */}
      <div className="w-full aspect-square bg-slate-900 rounded-lg mb-3">
        {imageUrl ? (
          <img src={imageUrl} alt={character.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-16 h-16 text-slate-700" />
        )}
      </div>
      {/* ... */}
    </div>
  );
})}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/CanvasPanel.tsx
git commit -m "feat: 画板同步显示人物形象"
```

---

## 测试任务

### Task 9: 端到端测试

**Files:**
- Test: 手动测试完整流程

**Step 1: 启动应用**

Run: `npm run dev`

**Step 2: 测试完整流程**

1. 进入导演模式
2. 选择剧本
3. 艺术总监询问视频规格 → 选择"短视频"和"竖版"
4. 艺术总监创作角色和场景
5. 用户确认角色
6. 选角导演生成人物形象（逐个发送）
7. 用户确认所有形象
8. 分镜师生成分镜图
9. 用户确认分镜
10. 摄像导演生成视频
11. 用户确认视频
12. 视频拼接完成，艺术总监总结

**Step 3: 验证画板同步**

- 每个步骤完成后，检查右侧画板是否正确显示卡片
- 角色卡片、分镜卡片、视频卡片都要正确更新

**Step 4: Commit**

```bash
git add docs/plans/2026-03-19-director-mode-workflow.md
git commit -m "docs: 添加导演模式完整工作流实施计划"
```

---

## 总结

本计划实现了导演模式的完整工作流：

1. ✅ 艺术总监确定视频规格
2. ✅ 艺术总监创作角色和场景
3. ✅ 用户确认角色
4. ✅ 选角导演生成人物形象（三视图）
5. ✅ 用户确认所有形象
6. ✅ 分镜师生成分镜图（5x5）
7. ✅ 用户确认分镜
8. ✅ 摄像导演生成视频
9. ✅ 用户确认视频
10. ✅ 视频拼接和总结

每个步骤都包含：
- Agent 介绍自己
- 询问用户选择
- Loading 状态
- 展示结果
- 用户确认/重新生成选项
- 画板同步更新
- 邀请下一个 Agent
