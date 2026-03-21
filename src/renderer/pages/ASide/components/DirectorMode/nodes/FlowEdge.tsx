/**
 * 自定义连线 - 复现现有流动橙色虚线效果
 *
 * 颜色规则：
 * - 普通：#f97316（橙），opacity 60%
 * - 选中：#f97316，opacity 100%，strokeWidth 4
 * - source 类型为 storyboard/video：#3b82f6（蓝）
 */
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  // source 节点类型由父组件注入到 data
  const isBlueEdge = data?.sourceType === 'storyboard' || data?.sourceType === 'video';
  const stroke = isBlueEdge ? '#3b82f6' : '#f97316';
  const strokeWidth = selected ? 4 : 3;
  const opacity = selected ? 1 : 0.6;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke,
        strokeWidth,
        strokeDasharray: '8,8',
        opacity,
        animation: 'flow 1s linear infinite',
      }}
    />
  );
}
