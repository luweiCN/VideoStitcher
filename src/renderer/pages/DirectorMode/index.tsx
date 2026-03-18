/**
 * 导演模式 - 完整创作流程
 */

import React, { useState } from 'react';
import { ArrowLeft, Video, Users, Film, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { Canvas } from './components/Canvas';
import { ChatPanel } from './components/ChatPanel';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import type { Script, Character, Scene, Message, SelectedItem, ExportConfig } from './types';
import { useToastMessages } from '@renderer/components/Toast';

const DirectorMode: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastMessages();

  // 状态管理
  const [script, setScript] = useState<Script | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyboard, setStoryboard] = useState<Scene[]>([]);
  const [currentStep, setCurrentStep] = useState<'character' | 'storyboard' | 'preview'>('character');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 生成角色
  const handleGenerateCharacter = async () => {
    setIsProcessing(true);
    try {
      // TODO: 调用后端 API
      const mockCharacter: Character = {
        id: `char-${Date.now()}`,
        name: '角色 1',
        description: '由 AI 生成的角色',
        traits: ['活泼', '幽默'],
      };

      setCharacters([...characters, mockCharacter]);

      setMessages([
        ...messages,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `已生成新角色: ${mockCharacter.name}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('生成角色失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 生成分镜
  const handleGenerateStoryboard = async () => {
    setIsProcessing(true);
    try {
      // TODO: 调用后端 API
      const mockScenes: Scene[] = Array.from({ length: 5 }, (_, index) => ({
        id: `scene-${Date.now()}-${index}`,
        sequence: index + 1,
        description: `场景 ${index + 1}`,
        duration: 3,
        characters: characters.map(c => c.id),
        transition: 'fade' as const,
      }));

      setStoryboard(mockScenes);

      setMessages([
        ...messages,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `已生成 ${mockScenes.length} 个分镜场景`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('生成分镜失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 更新角色
  const handleCharacterUpdate = (characterId: string, updates: Partial<Character>) => {
    setCharacters(
      characters.map(char =>
        char.id === characterId ? { ...char, ...updates } : char
      )
    );
  };

  // 更新场景
  const handleSceneUpdate = (sceneId: string, updates: Partial<Scene>) => {
    setStoryboard(
      storyboard.map(scene =>
        scene.id === sceneId ? { ...scene, ...updates } : scene
      )
    );
  };

  // 更新属性
  const handlePropertyUpdate = (updates: any) => {
    if (!selectedItem) return;

    if (selectedItem.type === 'character') {
      handleCharacterUpdate(selectedItem.id, updates);
    } else if (selectedItem.type === 'scene') {
      handleSceneUpdate(selectedItem.id, updates);
    }
  };

  // 导出视频
  const handleExport = async (config: ExportConfig) => {
    setIsProcessing(true);
    try {
      // TODO: 调用后端 API
      console.log('导出配置:', config);
      toast.info('导出功能开发中...');
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* 导航栏 */}
      <nav className="bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <PageHeader
          title="导演模式"
          subtitle="AI 辅助视频创作"
          icon={<Film className="w-5 h-5 text-white" />}
          iconGradient="from-violet-600 to-blue-600"
        />
      </nav>

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧对话面板 */}
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex-shrink-0">
          <ChatPanel
            script={script}
            messages={messages}
            onGenerateCharacter={handleGenerateCharacter}
            onGenerateStoryboard={handleGenerateStoryboard}
            onScriptChange={setScript}
            isProcessing={isProcessing}
          />
        </div>

        {/* 中间画布 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Toolbar
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onExport={handleExport}
            isProcessing={isProcessing}
          />
          <Canvas
            characters={characters}
            storyboard={storyboard}
            currentStep={currentStep}
            onCharacterUpdate={handleCharacterUpdate}
            onSceneUpdate={handleSceneUpdate}
            onCharacterSelect={(id) => setSelectedItem({ type: 'character', id })}
            onSceneSelect={(id) => setSelectedItem({ type: 'scene', id })}
            selectedItem={selectedItem}
          />
        </div>

        {/* 右侧属性面板 */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex-shrink-0">
          <PropertyPanel
            selectedItem={selectedItem}
            characters={characters}
            scenes={storyboard}
            onUpdate={handlePropertyUpdate}
          />
        </div>
      </div>
    </div>
  );
};

export default DirectorMode;
