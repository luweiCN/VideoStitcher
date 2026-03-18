/**
 * 模型信息提取工具
 * 从火山引擎控制台复制的信息中提取模型配置
 */

import type { ModelConfig, ModelFeature } from '../types/model';

/**
 * 从火山引擎控制台复制的信息中提取模型配置
 *
 * @param text - 从控制台复制的文本
 * @returns 提取的模型配置
 *
 * @example
 * ```typescript
 * const text = `
 * Doubao-1.5-lite
 * 文本模型
 * Model ID: doubao-1-5-lite-32k-250115
 * 输入|输出类型
 * |
 * 文字
 * |
 * 文字
 * 模型能力
 * 结构化输出
 * 深度思考
 * Function Call
 * ...
 * `;
 *
 * const config = extractVolcEngineModelInfo(text);
 * console.log(config);
 * ```
 */
export function extractVolcEngineModelInfo(text: string): Partial<ModelConfig> {
  const config: Partial<ModelConfig> = {};

  // 提取 Model ID
  const modelIdMatch = text.match(/Model ID:\s*([^\s\n]+)/);
  if (modelIdMatch) {
    config.id = modelIdMatch[1];
  }

  // 提取模型名称
  const nameMatch = text.match(/^(.+?)\n/);
  if (nameMatch) {
    config.name = nameMatch[1].trim();
  }

  // 提取描述（第二行到"Model ID"之间的内容）
  const descMatch = text.match(/^.+?\n(.+?)Model ID:/s);
  if (descMatch) {
    config.description = descMatch[1].trim().split('\n').join(' ');
  }

  // 提取版本（从 Model ID 末尾提取）
  if (config.id) {
    const versionMatch = config.id.match(/-(\d+)$/);
    if (versionMatch) {
      config.version = versionMatch[1];
    }
  }

  // 提取输入输出类型
  const ioMatch = text.match(/输入\|输出类型[\s\S]*?\|\s*([^\|]+)\s*\|\s*([^\|]+)/);
  if (ioMatch) {
    const inputType = ioMatch[1].trim();
    const outputType = ioMatch[2].trim();

    config.inputTypes = [mapIOType(inputType)];
    config.outputTypes = [mapIOType(outputType)];
  }

  // 提取能力特征
  const features: ModelFeature[] = [];

  if (text.includes('结构化输出')) features.push('structured_output');
  if (text.includes('深度思考')) features.push('deep_reasoning');
  if (text.includes('Function Call')) features.push('function_calling');
  if (text.includes('联网搜索')) features.push('web_search');
  if (text.includes('Chat Completions')) features.push('streaming'); // 假设支持流式

  // 视频生成特定能力
  if (text.includes('文生音画')) features.push('text_to_video_with_audio');
  if (text.includes('图生音画')) features.push('image_to_video_with_audio');
  if (text.includes('图生视频')) features.push('image_to_video');
  if (text.includes('文生视频')) features.push('text_to_video');

  config.features = features;

  // 提取上下文窗口
  const contextMatch = text.match(/上下文窗口\s*(\d+)k/i);
  if (contextMatch) {
    config.contextWindow = parseInt(contextMatch[1]) * 1024;
  }

  // 提取最大输出
  const maxOutputMatch = text.match(/最大输出.*?(\d+)k/i);
  if (maxOutputMatch) {
    config.maxOutputTokens = parseInt(maxOutputMatch[1]) * 1024;
  }

  // 提取定价信息
  const pricingMatch = text.match(/推理输入\s*([\d.]+)\s*元\/百万tokens/);
  const outputPricingMatch = text.match(/推理输出\s*([\d.]+)\s*元\/百万tokens/);
  const cachedMatch = text.match(/缓存命中\s*([\d.]+)\s*元\/百万tokens/);
  const cachedStorageMatch = text.match(/缓存存储\s*([\d.]+)\s*元\/百万tokens\/小时/);

  // 图片生成特定价格（元/张）
  const textToImageMatch = text.match(/文生图\s*([\d.]+)\s*元\/张/);
  const imageToImageMatch = text.match(/图生图\s*([\d.]+)\s*元\/张/);
  const batchTextToImageMatch = text.match(/批量文生图\s*([\d.]+)\s*元\/张/);
  const batchImageToImageMatch = text.match(/批量图生图\s*([\d.]+)\s*元\/张/);

  // 视频生成特定价格（1.5 Pro 版本 - 音画一体）
  const videoWithAudioMatch = text.match(/有声视频\s*([\d.]+)\s*元\/百万tokens/);
  const videoWithoutAudioMatch = text.match(/无声视频\s*([\d.]+)\s*元\/百万tokens/);
  const batchVideoWithAudioMatch = text.match(/批量推理有声视频\s*([\d.]+)\s*元\/百万tokens/);
  const batchVideoWithoutAudioMatch = text.match(/批量推理无声视频\s*([\d.]+)\s*元\/百万tokens/);

  // 视频生成特定价格（1.0 Pro 版本 - 纯视频）
  const imageToVideoMatch = text.match(/图生视频\s*([\d.]+)\s*元\/百万tokens/);
  const textToVideoMatch = text.match(/文生视频\s*([\d.]+)\s*元\/百万tokens/);
  const batchImageToVideoMatch = text.match(/批量推理图生视频\s*([\d.]+)\s*元\/百万tokens/);
  const batchTextToVideoMatch = text.match(/批量推理文生视频\s*([\d.]+)\s*元\/百万tokens/);
  const finetunedImageToVideoMatch = text.match(/精调图生视频\s*([\d.]+)\s*元\/百万tokens/);

  if (
    pricingMatch ||
    outputPricingMatch ||
    cachedMatch ||
    videoWithAudioMatch ||
    imageToVideoMatch ||
    textToImageMatch
  ) {
    config.pricing = {
      // 文本模型价格
      inputTokens: pricingMatch ? parseFloat(pricingMatch[1]) : undefined,
      outputTokens: outputPricingMatch ? parseFloat(outputPricingMatch[1]) : undefined,
      cachedTokens: cachedMatch ? parseFloat(cachedMatch[1]) : undefined,
      cachedStorage: cachedStorageMatch ? parseFloat(cachedStorageMatch[1]) : undefined,

      // 图片模型价格（元/张）
      textToImage: textToImageMatch ? parseFloat(textToImageMatch[1]) : undefined,
      imageToImage: imageToImageMatch ? parseFloat(imageToImageMatch[1]) : undefined,
      batchTextToImage: batchTextToImageMatch
        ? parseFloat(batchTextToImageMatch[1])
        : undefined,
      batchImageToImage: batchImageToImageMatch
        ? parseFloat(batchImageToImageMatch[1])
        : undefined,

      // 视频模型价格（1.5 Pro - 音画一体）
      videoWithAudio: videoWithAudioMatch ? parseFloat(videoWithAudioMatch[1]) : undefined,
      videoWithoutAudio: videoWithoutAudioMatch
        ? parseFloat(videoWithoutAudioMatch[1])
        : undefined,
      batchVideoWithAudio: batchVideoWithAudioMatch
        ? parseFloat(batchVideoWithAudioMatch[1])
        : undefined,
      batchVideoWithoutAudio: batchVideoWithoutAudioMatch
        ? parseFloat(batchVideoWithoutAudioMatch[1])
        : undefined,

      // 视频模型价格（1.0 Pro - 纯视频）
      imageToVideo: imageToVideoMatch ? parseFloat(imageToVideoMatch[1]) : undefined,
      textToVideo: textToVideoMatch ? parseFloat(textToVideoMatch[1]) : undefined,
      batchImageToVideo: batchImageToVideoMatch
        ? parseFloat(batchImageToVideoMatch[1])
        : undefined,
      batchTextToVideo: batchTextToVideoMatch
        ? parseFloat(batchTextToVideoMatch[1])
        : undefined,
      finetunedImageToVideo: finetunedImageToVideoMatch
        ? parseFloat(finetunedImageToVideoMatch[1])
        : undefined,

      unit: 'CNY/million_tokens',
      currency: 'CNY',
    };

    // 根据模型类型设置计费单位和备注
    if (textToImageMatch || imageToImageMatch) {
      config.pricing.unit = 'CNY/per_image';
      config.pricing.note = '图片生成按张计费';
    } else if (videoWithAudioMatch || imageToVideoMatch) {
      config.pricing.note = '实际计费可能按视频秒数或生成次数，而非 tokens';
    }
  }

  // 提取限制信息
  const tpmMatch = text.match(/TPM\s*(\d+)k/i);
  const rpmMatch = text.match(/RPM\s*(\d+)k/i);
  const ipmMatch = text.match(/IPM\s*(\d+)/i);

  // 视频生成特定限制
  const resolutionMatch = text.match(/分辨率\s*([\dP,\s]+)/i);
  const durationMatch = text.match(/时长\s*([\d\-]+s)/i);
  const fpsMatch = text.match(/帧率\s*(\d+)fps/i);
  const concurrencyMatch = text.match(/并发数\s*(\d+)/i);

  if (tpmMatch || rpmMatch || ipmMatch || resolutionMatch || durationMatch) {
    config.limits = {
      // 文本模型限制
      TPM: tpmMatch ? parseInt(tpmMatch[1]) * 1000 : undefined,
      RPM: rpmMatch ? parseInt(rpmMatch[1]) * 1000 : undefined,

      // 图片模型限制
      IPM: ipmMatch ? parseInt(ipmMatch[1]) : undefined,

      // 视频模型限制
      resolution: resolutionMatch
        ? resolutionMatch[1].split(',').map((r) => r.trim())
        : undefined,
      duration: durationMatch ? durationMatch[1] : undefined,
      fps: fpsMatch ? parseInt(fpsMatch[1]) : undefined,
      concurrency: concurrencyMatch ? parseInt(concurrencyMatch[1]) : undefined,
    };
  }

  // 默认启用
  config.enabled = true;

  return config;
}

/**
 * 映射输入输出类型
 */
function mapIOType(type: string): string {
  const typeMap: Record<string, string> = {
    文字: 'text',
    图片: 'image',
    音频: 'audio',
    视频: 'video',
  };

  return typeMap[type] || type.toLowerCase();
}

/**
 * 将提取的配置转换为 JSON
 */
export function modelConfigToJSON(config: Partial<ModelConfig>): string {
  return JSON.stringify(config, null, 2);
}

/**
 * 使用示例
 */
export function exampleUsage() {
  const text = `
Doubao-1.5-lite
文本模型
文本生成
Doubao-1.5-lite 全新一代轻量版模型，极致响应速度，效果与时延均达到全球一流水平。支持 32k 上下文窗口，输出长度支持最大 12k tokens。
Doubao-1.5-lite-32k
豆包1.5轻量级大语言模型

Doubao-1.5-lite-32k
250115
首推
Model ID: doubao-1-5-lite-32k-250115

输入|输出类型
|
文字
|
文字

模型能力
模型体验
模型精调
结构化输出
深度思考
在线推理
批量推理
batch_job
batch_chat
上下文缓存
Context API
模型工具
Function Call
联网搜索

模型定价
推理输入
0.3
元/百万tokens
推理输出
0.6
元/百万tokens
缓存命中
0.06
元/百万tokens
缓存存储
0.017
元/百万tokens/小时

模型限制
上下文窗口
32k
最大输出Token长度
12k
TPM
5000k
RPM
30k
  `;

  const config = extractVolcEngineModelInfo(text);
  console.log('提取的配置：');
  console.log(modelConfigToJSON(config));
}
