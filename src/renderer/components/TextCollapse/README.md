# TextCollapse

现代化、高性能的 React 文本折叠组件，用于处理多行文本溢出显示。

## 特性

- ⚡️ **高性能** - 使用 O(log n) 二分查找算法，优于传统 O(n) 线性查找
- 📐 **精确测量** - 使用 ResizeObserver 精确监听容器尺寸变化
- 🎯 **智能截断** - 优先在词边界、句子边界截断，提升可读性
- 💾 **测量缓存** - 自动缓存测量结果，避免重复计算
- 🔄 **自动响应** - 容器尺寸变化时自动重新测量
- 📦 **零依赖** - 仅依赖 React，无需额外安装
- 🎨 **完全可定制** - 支持自定义展开按钮、样式和行为
- 🌐 **TypeScript** - 完整的类型定义

## 性能对比

| 特性 | react-dotdotdot | TextCollapse |
|------|-----------------|--------------|
| 算法复杂度 | O(n) 线性查找 | O(log n) 二分查找 |
| 尺寸监听 | setInterval 轮询 | ResizeObserver |
| 测量缓存 | ❌ 无 | ✅ LRU 缓存 |
| 组件类型 | 类组件 | 函数组件 + Hooks |
| 最后更新 | 5 年前 | 持续维护 |

## 安装

```bash
# 项目内部组件，直接导入使用
import { TextCollapse } from './components/TextCollapse';
```

## 快速开始

### 基础用法

```tsx
import { TextCollapse } from './components/TextCollapse';

function App() {
  return (
    <TextCollapse lines={2}>
      这是一段很长的文本内容，当内容超过两行时会显示省略号，
      用户可以点击展开按钮查看完整内容。组件会自动测量文本高度
      并判断是否需要显示展开按钮。
    </TextCollapse>
  );
}
```

### 自定义展开按钮

```tsx
<TextCollapse
  lines={3}
  ellipsis="……"
  expandButton={(props) => (
    <button
      onClick={props.onClick}
      className="text-blue-500 hover:text-blue-600"
    >
      {props.expanded ? '收起内容 ▲' : '展开更多 ▼'}
    </button>
  )}
>
  {longText}
</TextCollapse>
```

### 受控模式

```tsx
function App() {
  const [expanded, setExpanded] = useState(false);

  return (
    <TextCollapse
      lines={2}
      expanded={expanded}
      onExpandedChange={setExpanded}
    >
      {content}
    </TextCollapse>
  );
}
```

## API 文档

### TextCollapse 组件

```tsx
<TextCollapse
  lines={2}              // 最大显示行数，默认 2
  ellipsis="..."         // 省略号文本，默认 "..."
  defaultExpanded={false}// 是否默认展开
  expanded={false}       // 受控模式：是否展开
  onExpandedChange={(expanded) => {}}  // 展开/收起回调
  expandButton={Button}  // 自定义展开按钮
  className=""           // 自定义类名
  style={{}}             // 自定义样式
>
  {children}
</TextCollapse>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `children` | `ReactNode` | - | 文本内容 |
| `lines` | `number` | `2` | 最大显示行数 |
| `ellipsis` | `string` | `"..."` | 省略号文本 |
| `defaultExpanded` | `boolean` | `false` | 是否默认展开（非受控） |
| `expanded` | `boolean` | - | 受控模式：是否展开 |
| `onExpandedChange` | `(expanded: boolean) => void` | - | 展开/收起变化回调 |
| `expandButton` | `(props: ExpandButtonProps) => ReactNode` | `DefaultExpandButton` | 自定义展开按钮 |
| `className` | `string` | - | 自定义容器类名 |
| `style` | `CSSProperties` | - | 自定义容器样式 |

#### ExpandButtonProps

```tsx
interface ExpandButtonProps {
  expanded: boolean;      // 是否已展开
  onClick: () => void;    // 点击回调
  needsCollapse: boolean; // 是否需要折叠（有溢出内容）
}
```

### useTextCollapse Hook

用于需要完全自定义渲染的场景。

```tsx
import { useTextCollapse } from './components/TextCollapse';

function CustomComponent() {
  const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { needsCollapse, isMeasuring, displayText, remeasure } = useTextCollapse({
    textRef,
    containerRef,
    lines: 2,
    ellipsis: '...',
    disabled: false,        // 是否禁用折叠
    measureDelay: 0,        // 测量延迟（毫秒）
  });

  return (
    <div ref={containerRef}>
      <span ref={textRef}>{displayText}</span>
      {needsCollapse && <button onClick={remeasure}>重新测量</button>}
    </div>
  );
}
```

#### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `needsCollapse` | `boolean` | 是否需要折叠（内容溢出） |
| `isMeasuring` | `boolean` | 是否正在测量中 |
| `displayText` | `string` | 截断后的文本内容 |
| `remeasure` | `() => void` | 重新测量 |
| `forceMeasure` | `() => void` | 强制测量（跳过调度） |

### useNeedsCollapse Hook

简化版 Hook，专门配合 CSS `line-clamp` 使用。

```tsx
import { useNeedsCollapse } from './components/TextCollapse';

function LogEntry({ message }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const { needsCollapse, isMeasuring } = useNeedsCollapse({
    textRef,
    lines: 2,
  });

  return (
    <span
      ref={textRef}
      className={needsCollapse ? 'line-clamp-2' : ''}
    >
      {message}
    </span>
  );
}
```

#### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `needsCollapse` | `boolean` | 是否需要折叠（内容溢出） |
| `isMeasuring` | `boolean` | 是否正在测量中 |
| `remeasure` | `() => void` | 重新测量 |

### useResizeObserver Hook

封装的 ResizeObserver Hook，用于监听元素尺寸变化。

```tsx
import { useResizeObserver } from './components/TextCollapse';

function Component() {
  const { ref, trigger } = useResizeObserver((entries) => {
    for (const entry of entries) {
      console.log('Size:', entry.contentRect);
    }
  }, {
    throttle: 100,        // 节流延迟
    rafThrottle: true,    // 使用 RAF 节流
    triggerOnMount: true, // 首次是否触发
  });

  return <div ref={ref}>Content</div>;
}
```

## 高级用法

### 动态内容更新

```tsx
function DynamicContent() {
  const [content, setContent] = useState('');

  return (
    <TextCollapse lines={2} key={content}>
      {content}
    </TextCollapse>
  );
}
```

### 响应式行数

```tsx
function ResponsiveCollapse() {
  const [lines, setLines] = useState(2);

  useEffect(() => {
    const updateLines = () => {
      setLines(window.innerWidth < 640 ? 3 : 2);
    };

    updateLines();
    window.addEventListener('resize', updateLines);
    return () => window.removeEventListener('resize', updateLines);
  }, []);

  return <TextCollapse lines={lines}>{content}</TextCollapse>;
}
```

### 与 Tailwind CSS 集成

```tsx
<TextCollapse
  lines={2}
  className="prose prose-sm max-w-none"
  expandButton={(props) => (
    <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
      {props.expanded ? '显示更少' : '显示更多'}
    </button>
  )}
>
  {content}
</TextCollapse>
```

### 清空测量缓存

```tsx
import { clearMeasureCache } from './components/TextCollapse';

// 在大量内容更新后清空缓存
clearMeasureCache();
```

### 处理折叠按钮占用空间的问题

**问题场景**：当文本容器中包含折叠按钮或者当出现折叠按钮时文本容器的宽度会被压缩时，会出现"鸡生蛋、蛋生鸡"的循环依赖问题：

```
场景：日志文本恰好 2 行，不溢出
1. 用户点击选中 → 出现选框 → 容器变窄
2. 文本现在溢出了 → 显示折叠按钮
3. 折叠按钮占用宽度 → 文本仍然溢出
4. 用户取消选中 → 选框消失 → 容器恢复
5. 但折叠按钮还在 → 文本继续溢出（死循环）
```

**解决方案**：使用双重判断逻辑

```tsx
const { needsCollapse } = useNeedsCollapse({
  textRef,
  lines: 2,
  collapseButtonWidth: 12, // 折叠按钮宽度
});
```

**判断流程**：

```
第一次测量：当前容器宽度是否溢出？
    ↓ 不溢出
    返回 false（不需要折叠）

    ↓ 溢出
第二次测量：预留折叠按钮宽度后是否还溢出？
    ↓ 不溢出
    返回 false（按钮出现后文本仍能放下）

    ↓ 溢出
    返回 true（需要折叠）
```

**效果对比**：

| 场景 | 第一次测量 | 第二次测量 | 结果 |
|------|-----------|-----------|------|
| 文本很短 | 不溢出 | - | 不折叠 ✅ |
| 文本刚好 2 行（无按钮） | 溢出 | 不溢出 | 不折叠 ✅ |
| 文本很长 | 溢出 | 溢出 | 折叠 ✅ |

这个方案的优势：
- ✅ 不需要手动预留宽度
- ✅ 自动适应不同布局
- ✅ 避免循环依赖问题

## 算法说明

### 二分查找算法

组件使用二分查找算法来确定最佳截断位置：

```
1. 完整文本是否溢出？
   └─ 否 → 不需要折叠

2. 二分查找最佳截断位置：
   left = 0, right = textLength

   while (left <= right):
     mid = (left + right) / 2
     测试 text[0:mid] + ellipsis 是否溢出

     if 不溢出:
       bestFit = mid
       left = mid + 1  # 尝试更多字符
     else:
       right = mid - 1  # 减少字符

3. 智能优化截断位置：
   - 优先在段落边界（换行符）
   - 其次在句子边界（。！？.!?）
   - 最后在词边界（空格）
```

时间复杂度：O(log n)，其中 n 是文本长度。

### 测量缓存

相同文本、宽度和字体的测量结果会被缓存：

```typescript
缓存键 = hash(text + width + font)
缓存容量 = 100 条目
过期时间 = 10 分钟
```

## 常见问题

### Q: 为什么展开后文本还是有省略号？

A: 确保在展开状态下不应用 `line-clamp` 相关样式。检查是否有全局 CSS 影响了显示。

### Q: 如何处理动态加载的内容？

A: 添加 `key` 属性强制重新渲染，或调用 `remeasure()` 方法。

```tsx
<TextCollapse key={contentId} lines={2}>
  {content}
</TextCollapse>
```

### Q: 可以同时折叠多个元素吗？

A: 可以，每个组件实例独立工作。测量结果会被缓存，性能影响很小。

### Q: 如何禁用折叠功能？

A: 设置 `disabled` 属性（使用 Hook 时），或不使用 `line-clamp` 样式。

### Q: 支持服务端渲染（SSR）吗？

A: 支持。组件在客户端挂载后会自动测量，SSR 期间显示完整内容。

## License

MIT

## 作者

VideoStitcher Team
