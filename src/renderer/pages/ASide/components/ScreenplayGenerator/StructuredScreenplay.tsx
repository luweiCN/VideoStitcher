/**
 * 结构化剧本展示组件
 * 解析并美化展示 JSON 格式的剧本数据
 */

import { FileText, MapPin, Sparkles, Users } from 'lucide-react';

interface StructuredScreenplayProps {
  /** 剧本内容（JSON 字符串或已解析对象） */
  content: string | any;
  /** 最大高度 */
  maxHeight?: string;
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
 * 结构化剧本展示组件
 */
export function StructuredScreenplay({ content, maxHeight = '400px' }: StructuredScreenplayProps) {
  // 解析剧本内容
  let screenplay: any = null;

  try {
    // 如果是字符串，先提取 JSON 内容
    const jsonContent = typeof content === 'string' ? extractJSON(content) : content;
    screenplay = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
  } catch (error) {
    // 如果解析失败，显示原始内容
    return (
      <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3" style={{ maxHeight, overflow: 'auto' }}>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" style={{ maxHeight, overflow: 'auto' }}>
      {/* 标题和元信息 */}
      <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3">
        <h3 className="text-base font-medium text-slate-200 mb-2">
          {screenplay.script_title || '未命名剧本'}
        </h3>

        {/* 元信息标签 */}
        <div className="flex flex-wrap gap-2 text-xs">
          {screenplay.creative_direction_name && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-600/20 text-violet-400 rounded">
              <Sparkles className="w-3 h-3" />
              <span>{screenplay.creative_direction_name}</span>
            </div>
          )}
          {screenplay.region_style && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 text-blue-400 rounded">
              <MapPin className="w-3 h-3" />
              <span>{screenplay.region_style}</span>
            </div>
          )}
        </div>
      </div>

      {/* 黄金3秒钩子 */}
      {screenplay.hook_3s && (
        <div className="bg-gradient-to-r from-amber-600/10 to-orange-600/10 border border-amber-600/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-amber-600/20 rounded flex items-center justify-center text-amber-400 text-xs font-bold">
              3s
            </div>
            <h4 className="text-sm font-medium text-amber-400">黄金3秒钩子</h4>
          </div>

          {screenplay.hook_3s.visual && (
            <div className="mb-2">
              <p className="text-xs text-slate-500 mb-1">🎬 画面</p>
              <p className="text-sm text-slate-300">{screenplay.hook_3s.visual}</p>
            </div>
          )}

          {screenplay.hook_3s.dialogue && (
            <div>
              <p className="text-xs text-slate-500 mb-1">💬 台词</p>
              <p className="text-sm text-slate-300 italic">"{screenplay.hook_3s.dialogue}"</p>
            </div>
          )}
        </div>
      )}

      {/* 无厘头反转 */}
      {screenplay.absurd_twist && (
        <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-600/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-purple-600/20 rounded flex items-center justify-center text-purple-400 text-lg">
              😂
            </div>
            <h4 className="text-sm font-medium text-purple-400">无厘头反转</h4>
          </div>

          {screenplay.absurd_twist.visual && (
            <div className="mb-2">
              <p className="text-xs text-slate-500 mb-1">🎬 画面</p>
              <p className="text-sm text-slate-300">{screenplay.absurd_twist.visual}</p>
            </div>
          )}

          {screenplay.absurd_twist.dialogue && (
            <div>
              <p className="text-xs text-slate-500 mb-1">💬 台词</p>
              <p className="text-sm text-slate-300 italic">"{screenplay.absurd_twist.dialogue}"</p>
            </div>
          )}
        </div>
      )}

      {/* B面衔接 */}
      {screenplay.bside_transition && (
        <div className="bg-gradient-to-r from-green-600/10 to-emerald-600/10 border border-green-600/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-green-600/20 rounded flex items-center justify-center text-green-400 text-lg">
              🎮
            </div>
            <h4 className="text-sm font-medium text-green-400">B面衔接</h4>
          </div>

          {screenplay.bside_transition.visual && (
            <div className="mb-2">
              <p className="text-xs text-slate-500 mb-1">🎬 画面</p>
              <p className="text-sm text-slate-300">{screenplay.bside_transition.visual}</p>
            </div>
          )}

          {screenplay.bside_transition.dialogue && (
            <div>
              <p className="text-xs text-slate-500 mb-1">💬 台词</p>
              <p className="text-sm text-slate-300 italic">"{screenplay.bside_transition.dialogue}"</p>
            </div>
          )}
        </div>
      )}

      {/* 完整剧本（供艺术总监） */}
      {screenplay.full_script_for_art_director && (
        <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-medium text-slate-400">完整剧本</h4>
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{screenplay.full_script_for_art_director}</p>
        </div>
      )}

      {/* 地区特色元素 */}
      {screenplay.regional_elements && screenplay.regional_elements.length > 0 && (
        <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-medium text-blue-400">地区特色元素</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {screenplay.regional_elements.map((element: string, idx: number) => (
              <span key={idx} className="px-2 py-1 bg-blue-600/10 text-blue-300 rounded text-xs">
                {element}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 对齐说明 */}
      {(screenplay.creative_direction_alignment || screenplay.persona_alignment) && (
        <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-medium text-slate-400">对齐说明</h4>
          </div>

          {screenplay.creative_direction_alignment && (
            <div className="mb-2">
              <p className="text-xs text-slate-500 mb-1">创意方向对齐</p>
              <p className="text-sm text-slate-300">{screenplay.creative_direction_alignment}</p>
            </div>
          )}

          {screenplay.persona_alignment && (
            <div>
              <p className="text-xs text-slate-500 mb-1">人设对齐</p>
              <p className="text-sm text-slate-300">{screenplay.persona_alignment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
