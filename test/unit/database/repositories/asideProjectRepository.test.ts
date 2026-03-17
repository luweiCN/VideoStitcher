/**
 * 项目仓库测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { asideProjectRepository } from '../../../../src/main/database/repositories/asideProjectRepository';
import { getDatabase } from '../../../../src/main/database/index';

describe('AsideProjectRepository', () => {
  beforeEach(() => {
    // 重置数据库
    const db = getDatabase();
    db.exec('DELETE FROM aside_projects');
  });

  describe('createProject', () => {
    it('应该成功创建项目并自动插入预设数据', () => {
      const project = asideProjectRepository.createProject('测试项目', '麻将');

      expect(project).toBeDefined();
      expect(project.name).toBe('测试项目');
      expect(project.gameType).toBe('麻将');
      expect(project.id).toBeDefined();

      // 验证预设创意方向已插入
      const directions = asideProjectRepository.getCreativeDirections(project.id);
      expect(directions.length).toBeGreaterThan(0);

      // 验证预设人设已插入
      const db = getDatabase();
      const personas = db.prepare('SELECT * FROM aside_personas WHERE project_id = ?').all(project.id);
      expect(personas.length).toBeGreaterThan(0);
    });

    it('应该拒绝空的项目名称', () => {
      expect(() => {
        asideProjectRepository.createProject('', '麻将');
      }).toThrow('项目名称不能为空');
    });

    it('应该拒绝无效的游戏类型', () => {
      expect(() => {
        asideProjectRepository.createProject('测试项目', '无效游戏' as any);
      }).toThrow('无效的游戏类型');
    });
  });

  describe('getProjects', () => {
    it('应该返回所有项目,按创建时间倒序排列', () => {
      const project1 = asideProjectRepository.createProject('项目1', '麻将');
      const project2 = asideProjectRepository.createProject('项目2', '扑克');
      const project3 = asideProjectRepository.createProject('项目3', '赛车');

      const projects = asideProjectRepository.getProjects();

      expect(projects.length).toBe(3);
      expect(projects[0].id).toBe(project3.id); // 最新创建的在最前面
      expect(projects[1].id).toBe(project2.id);
      expect(projects[2].id).toBe(project1.id);
    });

    it('应该返回空数组如果没有项目', () => {
      const projects = asideProjectRepository.getProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('getProjectById', () => {
    it('应该根据ID返回项目', () => {
      const created = asideProjectRepository.createProject('测试项目', '麻将');
      const project = asideProjectRepository.getProjectById(created.id);

      expect(project).toBeDefined();
      expect(project?.id).toBe(created.id);
      expect(project?.name).toBe('测试项目');
    });

    it('应该返回null如果项目不存在', () => {
      const project = asideProjectRepository.getProjectById('不存在的ID');
      expect(project).toBeNull();
    });
  });

  describe('updateProject', () => {
    it('应该成功更新项目名称', () => {
      const project = asideProjectRepository.createProject('原标题', '麻将');

      const updated = asideProjectRepository.updateProject(project.id, {
        name: '新标题'
      });

      expect(updated.name).toBe('新标题');
      expect(updated.id).toBe(project.id);
      expect(updated.gameType).toBe('麻将'); // 未修改的字段保持不变
    });

    it('应该成功更新游戏类型', () => {
      const project = asideProjectRepository.createProject('测试项目', '麻将');

      const updated = asideProjectRepository.updateProject(project.id, {
        gameType: '扑克'
      });

      expect(updated.gameType).toBe('扑克');
      expect(updated.name).toBe('测试项目'); // 未修改的字段保持不变
    });

    it('应该成功更新地区', () => {
      const project = asideProjectRepository.createProject('测试项目', '麻将');

      const updated = asideProjectRepository.updateProject(project.id, {
        region: '华北'
      });

      expect(updated.region).toBe('华北');
    });

    it('应该同时更新多个字段', () => {
      const project = asideProjectRepository.createProject('原标题', '麻将');

      const updated = asideProjectRepository.updateProject(project.id, {
        name: '新标题',
        gameType: '扑克',
        region: '华东'
      });

      expect(updated.name).toBe('新标题');
      expect(updated.gameType).toBe('扑克');
      expect(updated.region).toBe('华东');
    });

    it('应该拒绝空的项目名称', () => {
      const project = asideProjectRepository.createProject('测试项目', '麻将');

      expect(() => {
        asideProjectRepository.updateProject(project.id, { name: '' });
      }).toThrow('项目名称不能为空');
    });

    it('应该拒绝无效的游戏类型', () => {
      const project = asideProjectRepository.createProject('测试项目', '麻将');

      expect(() => {
        asideProjectRepository.updateProject(project.id, { gameType: '无效游戏' as any });
      }).toThrow('无效的游戏类型');
    });

    it('应该抛出错误如果项目不存在', () => {
      expect(() => {
        asideProjectRepository.updateProject('不存在的ID', { name: '新标题' });
      }).toThrow('项目不存在');
    });
  });

  describe('deleteProject', () => {
    it('应该成功删除项目及其所有关联数据', () => {
      const project = asideProjectRepository.createProject('测试项目', '麻将');

      // 确认项目存在
      expect(asideProjectRepository.getProjectById(project.id)).not.toBeNull();

      // 确认创意方向存在
      const directions = asideProjectRepository.getCreativeDirections(project.id);
      expect(directions.length).toBeGreaterThan(0);

      // 删除项目
      asideProjectRepository.deleteProject(project.id);

      // 确认项目已被删除
      expect(asideProjectRepository.getProjectById(project.id)).toBeNull();

      // 确认创意方向已被级联删除
      const directionsAfterDelete = asideProjectRepository.getCreativeDirections(project.id);
      expect(directionsAfterDelete.length).toBe(0);
    });

    it('应该能够删除不存在的项目而不报错', () => {
      // 删除不存在的项目应该不会抛出错误
      expect(() => {
        asideProjectRepository.deleteProject('不存在的ID');
      }).not.toThrow();
    });
  });
});
