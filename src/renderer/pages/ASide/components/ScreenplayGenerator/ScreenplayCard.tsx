/**
 * 剧本卡片组件（精简版）
 * 用于列表展示的紧凑格式，显示剧本的关键信息
 */

import { Sparkles, MapPin, Clock, FileText } from 'lucide-react';

interface ScreenplayCardProps {
  /** 剧本内容（JSON 字符串或已解析对象） */
  content: string | any;
  /** 创建时间（可选） */
  createdAt?: string;
  /** 是否显示完整剧本（用于待产库弹窗） */
  showFull?: boolean;
}

/**
 * 提取 JSON 内容（支持 markdown 代码块）
 */
function extractJSON(content: string): string {
  // 尝试提取 ```json ... ``` 代码块
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // 尝试提取 ``` ... ``` 代码块（无语言标识）
  const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
  if (codeMatch) {
    return codeMatch[1].trim();
  }

  // 返回原始内容
  return content.trim();
}

/**
 * 剧本卡片组件（精简版）
 */
export function ScreenplayCard({ content, createdAt, showFull = false }: ScreenplayCardProps) {
  // 解析剧本内容
  let screenplay: any = null;

  try {
    // 如果是字符串，先提取 JSON 内容
    const jsonContent = typeof content === 'string' ? extractJSON(content) : content;
    screenplay = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
  } catch (error) {
    // 如果解析失败，显示原始内容（截断）
    const truncated = typeof content === 'string'
      ? (showFull ? content : content.slice(0, 100) + '...')
      : '剧本数据';
    return (
      <div className="text-sm text-slate-300">
        {truncated}
        {createdAt && (
          <p className="text-xs text-slate-500 mt-1">
            {new Date(createdAt).toLocaleString('zh-CN')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 标题 */}
      <div className="text-sm font-medium text-slate-200">
        {screenplay.script_title || '未命名剧本'}
      </div>

      {/* 元信息标签 */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {screenplay.creative_direction_name && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-violet-600/20 text-violet-400 rounded">
            <Sparkles className="w-3 h-3" />
            <span>{screenplay.creative_direction_name}</span>
          </div>
        )}
        {screenplay.region_style && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">
            <MapPin className="w-3 h-3" />
            <span>{screenplay.region_style}</span>
          </div>
        )}
        {createdAt && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded">
            <Clock className="w-3 h-3" />
            <span>{new Date(createdAt).toLocaleString('zh-CN')}</span>
          </div>
        )}
      </div>

      {/* 完整剧本内容（仅在 showFull 时显示） */}
      {showFull && (
        <>
          {/* 对齐说明 */}
          {(screenplay.creative_direction_alignment || screenplay.persona_alignment) && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded p-2 space-y-1">
              {screenplay.creative_direction_alignment && (
                <div className="text-xs text-slate-400">
                  <span className="text-violet-400 font-medium">创意方向对齐：</span>
                  {screenplay.creative_direction_alignment}
                </div>
              )}
              {screenplay.persona_alignment && (
                <div className="text-xs text-slate-400">
                  <span className="text-violet-400 font-medium">人设对齐：</span>
                  {screenplay.persona_alignment}
                </div>
              )}
            </div>
          )}

          {/* 完整剧本 */}
          {screenplay.full_script_for_art_director && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded p-2">
              <div className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                完整剧本
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {screenplay.full_script_for_art_director}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
