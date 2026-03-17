/**
 * 传送带组件
 * 展示创意方向卡片，两行反向滚动创造视觉吸引力
 */

import { CreativeDirection } from '@shared/types/aside';
import { DirectionCard } from './DirectionCard';

interface ConveyorBeltProps {
  directions: CreativeDirection[];
  selectedId: string | null;
  onSelect: (direction: CreativeDirection) => void;
  onDelete: (directionId: string) => void;
}

/**
 * 传送带组件
 * 使用 CSS 动画实现无缝循环滚动
 */
export function ConveyorBelt({ directions, selectedId, onSelect, onDelete }: ConveyorBeltProps) {
  // 复制列表以实现无缝循环
  const duplicatedDirections = [...directions, ...directions];

  return (
    <div className="conveyor-container overflow-hidden space-y-4">
      {/* 第一行：正向滚动 */}
      <div className="conveyor-row flex gap-4">
        {duplicatedDirections.map((direction, index) => (
          <DirectionCard
            key={`row1-${direction.id}-${index}`}
            direction={direction}
            isSelected={selectedId === direction.id}
            onSelect={() => onSelect(direction)}
            onDelete={() => onDelete(direction.id)}
          />
        ))}
      </div>

      {/* 第二行：反向滚动 */}
      <div className="conveyor-row conveyor-row-reverse flex gap-4">
        {duplicatedDirections.map((direction, index) => (
          <DirectionCard
            key={`row2-${direction.id}-${index}`}
            direction={direction}
            isSelected={selectedId === direction.id}
            onSelect={() => onSelect(direction)}
            onDelete={() => onDelete(direction.id)}
          />
        ))}
      </div>
    </div>
  );
}
