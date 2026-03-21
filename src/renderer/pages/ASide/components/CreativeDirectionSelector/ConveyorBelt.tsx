/**
 * 传送带组件
 * 展示创意方向卡片，单行无限循环滚动
 * 使用 react-fast-marquee 实现丝滑的无缝循环
 */

import { CreativeDirection } from '@shared/types/aside';
import { DirectionCard } from './DirectionCard';
import Marquee from 'react-fast-marquee';

interface ConveyorBeltProps {
  directions: CreativeDirection[];
  selectedId: string | null;
  onSelect: (direction: CreativeDirection) => void;
  onEdit?: (direction: CreativeDirection) => void;
  onDelete: (directionId: string) => void;
}

/**
 * 传送带组件
 * 使用 react-fast-marquee 实现平滑的无限循环滚动
 */
export function ConveyorBelt({ directions, selectedId, onSelect, onEdit, onDelete }: ConveyorBeltProps) {
  return (
    <Marquee
      speed={30}
      gradient={false}
      pauseOnHover={true}
      className="py-6"
    >
      {directions.map((direction) => (
        <div key={direction.id} className="mx-2 w-[360px]">
          <DirectionCard
            direction={direction}
            isSelected={selectedId === direction.id}
            onSelect={() => onSelect(direction)}
            onEdit={onEdit ? () => onEdit(direction) : undefined}
            onDelete={() => onDelete(direction.id)}
          />
        </div>
      ))}
    </Marquee>
  );
}
