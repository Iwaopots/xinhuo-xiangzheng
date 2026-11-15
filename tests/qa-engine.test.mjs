/**
 * 小红检索引擎自测（不需要浏览器）：在项目根目录运行  node tests/qa-engine.test.mjs
 * 检查：① 知识库每个问题都能检索回自己；② 一组常见问法命中预期条目；③ 无关问题走兜底。
 */
import fs from 'node:fs';
import { buildIndex, search, answer } from '../js/qa-engine.js';

const kb = JSON.parse(fs.readFileSync(new URL('../js/data/kb.json', import.meta.url), 'utf8'));
const index = buildIndex(kb.entries);
let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.log('✗', msg); } };

// ① 自检索
for (const e of kb.entries) check(search(index, e.q, 1)[0].entry.id === e.id, `自检索失败：${e.id}`);

// ② 常见问法 → 期望条目
const cases = {
  '半条被子讲的什么': 'rc-story', '通道转兵是怎么回事？': 'td-what', '贺龙': 'sz-he', '陈树湘的故事': 'xj-chen',
  '长征精神': 'sp-what', '怎么去通道': 'td-go', '你是谁': 'site-xiaohong', '遵义会议': 'lm-zunyi',
  '长征走了多远': 'lm-distance', '毛泽东': 'td-mao', '数据会上传吗': 'site-privacy', '长征经过衡阳吗': 'hn-hengyang',
};
for (const [q, id] of Object.entries(cases)) {
  const r = answer(index, q);
  check(r.hit && r.entry.id === id, `“${q}” 期望 ${id}，实际 ${r.hit ? r.entry.id : '兜底'}`);
}

// ③ 无关问题 → 兜底，且给出 3 个推荐问题
for (const q of ['今天天气怎么样', '推荐一家衡阳的餐厅', '怎么学好编程']) {
  const r = answer(index, q);
  check(!r.hit && r.suggestions.length === 3, `“${q}” 应该兜底`);
}

console.log(fail ? `共 ${fail} 项失败` : `全部通过（知识库 ${kb.entries.length} 条）`);
process.exit(fail ? 1 : 0);
