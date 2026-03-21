import type { AgentModelConfig, ModelType, PromptTemplate } from './types';

const STORAGE_KEY = 'vs_prompt_templates';
const MODEL_STORAGE_KEY = 'vs_agent_models';

// ─── 模板存储 ──────────────────────────────────────────────

function loadAllTemplates(): Record<string, PromptTemplate[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllTemplates(data: Record<string, PromptTemplate[]>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getAgentTemplates(agentId: string): PromptTemplate[] {
  return loadAllTemplates()[agentId] ?? [];
}

export function upsertTemplate(template: PromptTemplate): void {
  const all = loadAllTemplates();
  const list = all[template.agentId] ?? [];
  const idx = list.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    list[idx] = template;
  } else {
    list.push(template);
  }
  all[template.agentId] = list;
  saveAllTemplates(all);
}

export function deleteTemplate(agentId: string, templateId: string): void {
  const all = loadAllTemplates();
  all[agentId] = (all[agentId] ?? []).filter((t) => t.id !== templateId);
  saveAllTemplates(all);
}

export function setActiveTemplate(agentId: string, templateId: string): void {
  const all = loadAllTemplates();
  all[agentId] = (all[agentId] ?? []).map((t) => ({
    ...t,
    isActive: t.id === templateId,
  }));
  saveAllTemplates(all);
}

/** 清除所有自定义模板的生效状态，回退到内置模板 */
export function clearActiveTemplate(agentId: string): void {
  const all = loadAllTemplates();
  all[agentId] = (all[agentId] ?? []).map((t) => ({ ...t, isActive: false }));
  saveAllTemplates(all);
}

// ─── 模型选择存储 ──────────────────────────────────────────

/** 获取指定 Agent 当前各类型模型的选择（返回 per-type map） */
export function getAgentModelConfig(agentId: string): AgentModelConfig {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY);
    const data: Record<string, AgentModelConfig> = raw ? JSON.parse(raw) : {};
    return data[agentId] ?? {};
  } catch {
    return {};
  }
}

/** 保存指定 Agent 某类型的模型选择 */
export function saveAgentModelType(agentId: string, type: ModelType, modelId: string): void {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY);
    const data: Record<string, AgentModelConfig> = raw ? JSON.parse(raw) : {};
    data[agentId] = { ...(data[agentId] ?? {}), [type]: modelId };
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储失败静默处理
  }
}
