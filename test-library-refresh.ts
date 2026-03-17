/**
 * 测试待产库功能
 */

// 模拟添加到待产库
async function testAddToLibrary() {
  const mockScript = {
    id: 'test-script-1',
    projectId: 'test-project',
    content: '测试脚本内容',
    status: 'draft' as const,
  };

  // 测试 API
  const result = await window.api.asideAddScriptToLibrary(mockScript.id);

  if (result.success) {
    console.log('[测试] 添加成功');
    console.log('新脚本:', result.newScript);

    // 验证新脚本
    if (result.newScript) {
      console.log('[测试] 新脚本已生成');
    }} else {
      console.error('[测试] 没有生成新脚本');
    }
  } else {
    console.error('[测试] 添加失败:', result.error);
  }
}

testAddToLibrary().catch(error => {
  console.error('[测试] 异常:', error);
});
