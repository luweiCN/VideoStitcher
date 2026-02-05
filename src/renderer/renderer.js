let aFiles = [];
let bFiles = [];
let outDir = "";

const $ = (id) => document.getElementById(id);
const logBox = $("log");
const statusBox = $("status");

function appendLog(s) {
  logBox.value += s;
  logBox.scrollTop = logBox.scrollHeight;
}

async function syncLibs() {
  const res = await window.api.setLibs(aFiles, bFiles, outDir);
  $("aCount").innerText = `${res.aCount} 条`;
  $("bCount").innerText = `${res.bCount} 条`;
  $("outDir").innerText = res.outDir || "未选择";
}

$("pickA").onclick = async () => {
  aFiles = await window.api.pickFiles("选择 A面库视频");
  await syncLibs();
};

$("pickB").onclick = async () => {
  bFiles = await window.api.pickFiles("选择 素材库B视频");
  await syncLibs();
};

$("pickOut").onclick = async () => {
  outDir = await window.api.pickOutDir();
  await syncLibs();
};

$("applyConcurrency").onclick = async () => {
  const n = Number($("concurrency").value || 1);
  const res = await window.api.setConcurrency(n);
  $("ccInfo").innerText = `当前并发：${res.concurrency}`;
};

$("mergeLandscape").onclick = async () => {
  logBox.value = "";
  statusBox.innerText = "准备开始（横版）...";
  await window.api.startMerge("landscape");
};

$("mergePortrait").onclick = async () => {
  logBox.value = "";
  statusBox.innerText = "准备开始（竖版）...";
  await window.api.startMerge("portrait");
};

window.api.onJobStart((d) => {
  statusBox.innerText = `开始合成：总任务 ${d.total} | 并发 ${d.concurrency} | 模式 ${d.orientation}`;
  appendLog(`\n===== JOB START total=${d.total} concurrency=${d.concurrency} mode=${d.orientation} =====\n`);
});

window.api.onJobLog((d) => {
  appendLog(d.msg);
});

window.api.onJobProgress((d) => {
  statusBox.innerText = `进度：${d.done}/${d.total}（失败 ${d.failed}）`;
});

window.api.onJobFailed((d) => {
  statusBox.innerText = `进度：${d.done}/${d.total}（失败 ${d.failed}）`;
  appendLog(`\n[FAILED] index=${d.index}\n${d.error}\n`);
});

window.api.onJobFinish((d) => {
  statusBox.innerText = `完成：成功 ${d.done} / 总 ${d.total}（失败 ${d.failed}）`;
  appendLog(`\n===== JOB FINISH done=${d.done} failed=${d.failed} total=${d.total} =====\n`);
});
