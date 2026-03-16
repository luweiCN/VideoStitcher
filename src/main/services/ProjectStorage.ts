/**
 * 项目存储服务
 *
 * 功能：
 * 1. 保存项目到本地文件
 * 2. 加载项目
 * 3. 列出所有项目
 * 4. 删除项目
 */

import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// ==================== 类型定义 ====================

/**
 * 项目元数据
 */
export interface ProjectMeta {
  /** 项目 ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 缩略图路径 */
  thumbnailPath?: string;
}

/**
 * 项目数据
 */
export interface ProjectData extends ProjectMeta {
  /** 项目状态数据 */
  state: any;
  /** 项目配置 */
  config?: any;
}

// ==================== 辅助函数 ====================

/**
 * 获取项目存储目录
 */
function getProjectsDir(): string {
  const userDataPath = app.getPath('userData');
  const projectsDir = path.join(userDataPath, 'ai-projects');

  // 确保目录存在
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
    logger.info('[项目存储] 创建项目存储目录', projectsDir);
  }

  return projectsDir;
}

/**
 * 获取项目文件路径
 */
function getProjectFilePath(projectId: string): string {
  return path.join(getProjectsDir(), `${projectId}.json`);
}

/**
 * 获取缩略图文件路径
 */
function getThumbnailFilePath(projectId: string): string {
  return path.join(getProjectsDir(), `${projectId}-thumbnail.jpg`);
}

// ==================== 公共 API ====================

/**
 * 保存项目
 * @param project 项目数据
 * @returns 保存结果
 */
export async function saveProject(project: ProjectData): Promise<{ success: boolean; projectId?: string; error?: string }> {
  logger.info('[项目存储] 保存项目', { projectId: project.id, name: project.name });

  try {
    // 验证输入
    if (!project.id || project.id.trim().length === 0) {
      throw new Error('项目 ID 不能为空');
    }

    if (!project.name || project.name.trim().length === 0) {
      throw new Error('项目名称不能为空');
    }

    // 更新时间戳
    const updatedProject: ProjectData = {
      ...project,
      updatedAt: Date.now(),
    };

    // 如果是新建项目，设置创建时间
    if (!updatedProject.createdAt) {
      updatedProject.createdAt = Date.now();
    }

    // 保存到文件
    const projectPath = getProjectFilePath(updatedProject.id);
    fs.writeFileSync(projectPath, JSON.stringify(updatedProject, null, 2), 'utf-8');

    logger.info('[项目存储] 项目保存成功', { projectId: updatedProject.id });

    return { success: true, projectId: updatedProject.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目存储] 保存项目失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 加载项目
 * @param projectId 项目 ID
 * @returns 项目数据
 */
export async function loadProject(projectId: string): Promise<{ success: boolean; project?: ProjectData; error?: string }> {
  logger.info('[项目存储] 加载项目', { projectId });

  try {
    // 验证输入
    if (!projectId || projectId.trim().length === 0) {
      throw new Error('项目 ID 不能为空');
    }

    // 读取项目文件
    const projectPath = getProjectFilePath(projectId);

    if (!fs.existsSync(projectPath)) {
      throw new Error(`项目不存在: ${projectId}`);
    }

    const projectData = fs.readFileSync(projectPath, 'utf-8');
    const project: ProjectData = JSON.parse(projectData);

    logger.info('[项目存储] 项目加载成功', { projectId });

    return { success: true, project };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目存储] 加载项目失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 列出所有项目
 * @returns 项目元数据列表
 */
export async function listProjects(): Promise<{ success: boolean; projects?: ProjectMeta[]; error?: string }> {
  logger.info('[项目存储] 列出所有项目');

  try {
    const projectsDir = getProjectsDir();
    const files = fs.readdirSync(projectsDir);
    const projects: ProjectMeta[] = [];

    for (const file of files) {
      // 只处理项目文件（忽略缩略图文件）
      if (file.endsWith('.json') && !file.includes('-thumbnail')) {
        const projectPath = path.join(projectsDir, file);
        const projectData = fs.readFileSync(projectPath, 'utf-8');
        const project: ProjectData = JSON.parse(projectData);

        // 只提取元数据
        const meta: ProjectMeta = {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          thumbnailPath: project.thumbnailPath,
        };

        projects.push(meta);
      }
    }

    // 按更新时间排序（最新的在前）
    projects.sort((a, b) => b.updatedAt - a.updatedAt);

    logger.info('[项目存储] 项目列表加载完成', { count: projects.length });

    return { success: true, projects };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目存储] 列出项目失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 删除项目
 * @param projectId 项目 ID
 * @returns 删除结果
 */
export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  logger.info('[项目存储] 删除项目', { projectId });

  try {
    // 验证输入
    if (!projectId || projectId.trim().length === 0) {
      throw new Error('项目 ID 不能为空');
    }

    // 删除项目文件
    const projectPath = getProjectFilePath(projectId);

    if (!fs.existsSync(projectPath)) {
      throw new Error(`项目不存在: ${projectId}`);
    }

    fs.unlinkSync(projectPath);

    // 删除缩略图文件（如果存在）
    const thumbnailPath = getThumbnailFilePath(projectId);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    logger.info('[项目存储] 项目删除成功', { projectId });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目存储] 删除项目失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 复制项目
 * @param projectId 项目 ID
 * @param newName 新项目名称
 * @returns 新项目 ID
 */
export async function copyProject(
  projectId: string,
  newName: string
): Promise<{ success: boolean; newProjectId?: string; error?: string }> {
  logger.info('[项目存储] 复制项目', { projectId, newName });

  try {
    // 验证输入
    if (!projectId || projectId.trim().length === 0) {
      throw new Error('项目 ID 不能为空');
    }

    if (!newName || newName.trim().length === 0) {
      throw new Error('新项目名称不能为空');
    }

    // 加载原项目
    const loadResult = await loadProject(projectId);
    if (!loadResult.success || !loadResult.project) {
      throw new Error(loadResult.error || '加载原项目失败');
    }

    // 创建新项目（复制状态）
    const newProject: ProjectData = {
      ...loadResult.project,
      id: path.basename(projectId) + '-' + Date.now(),
      name: newName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 保存新项目
    const saveResult = await saveProject(newProject);
    if (!saveResult.success || !saveResult.projectId) {
      throw new Error(saveResult.error || '保存新项目失败');
    }

    logger.info('[项目存储] 项目复制成功', { oldProjectId: projectId, newProjectId: saveResult.projectId });

    return { success: true, newProjectId: saveResult.projectId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目存储] 复制项目失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 导出项目到指定路径
 * @param projectId 项目 ID
 * @param exportPath 导出路径
 * @returns 导出结果
 */
export async function exportProject(
  projectId: string,
  exportPath: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('[项目存储] 导出项目', { projectId, exportPath });

  try {
    // 验证输入
    if (!projectId || projectId.trim().length === 0) {
      throw new Error('项目 ID 不能为空');
    }

    if (!exportPath || exportPath.trim().length === 0) {
      throw new Error('导出路径不能为空');
    }

    // 加载项目
    const loadResult = await loadProject(projectId);
    if (!loadResult.success || !loadResult.project) {
      throw new Error(loadResult.error || '加载项目失败');
    }

    // 导出到文件
    fs.writeFileSync(exportPath, JSON.stringify(loadResult.project, null, 2), 'utf-8');

    logger.info('[项目存储] 项目导出成功', { projectId, exportPath });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目存储] 导出项目失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 从文件导入项目
 * @param importPath 导入文件路径
 * @returns 导入结果
 */
export async function importProject(importPath: string): Promise<{ success: boolean; projectId?: string; error?: string }> {
  logger.info('[项目存储] 导入项目', { importPath });

  try {
    // 验证输入
    if (!importPath || importPath.trim().length === 0) {
      throw new Error('导入路径不能为空');
    }

    // 读取导入文件
    if (!fs.existsSync(importPath)) {
      throw new Error(`导入文件不存在: ${importPath}`);
    }

    const projectData = fs.readFileSync(importPath, 'utf-8');
    const project: ProjectData = JSON.parse(projectData);

    // 验证项目数据
    if (!project.id || !project.name || !project.state) {
      throw new Error('无效的项目文件格式');
    }

    // 生成新的项目 ID（避免冲突）
    const newProject: ProjectData = {
      ...project,
      id: project.id + '-' + Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 保存项目
    const saveResult = await saveProject(newProject);
    if (!saveResult.success || !saveResult.projectId) {
      throw new Error(saveResult.error || '保存项目失败');
    }

    logger.info('[项目存储] 项目导入成功', { projectId: saveResult.projectId });

    return { success: true, projectId: saveResult.projectId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目存储] 导入项目失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}
