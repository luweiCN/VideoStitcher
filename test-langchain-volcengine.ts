/**
 * 测试 LangChain + 火山引擎连接
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

async function test() {
  console.log('开始测试 LangChain + 火山引擎...');

  try {
    const model = new ChatOpenAI({
      model: 'doubao-1-5-pro-32k-250115',
      apiKey: '635a4f87-91d7-44f3-b09c-a580aa6ba835',
      configuration: {
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      },
      temperature: 0.7,
      maxTokens: 100,
    });

    console.log('ChatOpenAI 实例创建成功');
    console.log('客户端配置:', {
      model: model.model,
      // @ts-ignore
      baseURL: model.client?.baseURL,
    });

    const response = await model.invoke([new HumanMessage('你好')]);

    console.log('调用成功！');
    console.log('响应:', response.content);
  } catch (error) {
    console.error('调用失败:', error);
    throw error;
  }
}

test().then(() => {
  console.log('测试完成');
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});
