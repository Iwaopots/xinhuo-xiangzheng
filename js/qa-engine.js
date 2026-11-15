/**
 * qa-engine.js —— 小红的“本地大脑”：纯函数检索引擎（不碰 DOM，可在 Node 里单独测试）
 * ------------------------------------------------------------
 * 原理（答辩可讲）：
 *   1. 分词：中文没有空格，我们用“二元分词”（char bigram）——把句子按相邻两个字切开，
 *      如“通道转兵”→「通道」「道转」「转兵」。不需要词典，对专有名词也有效。
 *      另外保留单字（权重减半），让“贺龙”这种两字短问题也能命中。
 *   2. TF-IDF：TF = 词在这条资料里出现的次数；IDF = log(总条数 / 含该词的条数)。
 *      越“稀有”的词（如“沙洲”）权重越高，越常见的词（如“红军”）权重越低。
 *   3. 余弦相似度：把问题和每条资料都变成向量，算两个向量夹角的余弦，越接近 1 越相似。
 *   4. 阈值兜底：最高分低于阈值时，不硬答，而是说“还要再学习”，并推荐 3 个相关问题。
 *
 * 每条资料的文本 = 问题 + 同义问法（权重 1）+ 答案（权重 0.3，答案里的词只起辅助作用）。
 */

/** 问句里的“虚词/口头语”：先去掉，避免“什么”“怎么”这类词干扰匹配 */
const FILLERS = [
  '请问', '小红', '你好', '为什么', '是什么', '什么', '怎么样', '怎么', '如何', '哪里', '哪儿', '哪些', '哪个',
  '多少', '是不是', '有没有', '可以', '一下', '介绍', '讲讲', '说说', '告诉我', '知道', '吗', '呢', '吧', '啊', '呀',
  '的', '了', '是', '我', '你', '他', '她', '和', '与', '在', '有',
];

/** 统一文本：去标点空白、全角转半角、英文小写、去掉虚词 */
export function normalize(text = '') {
  let s = String(text).toLowerCase();
  // 全角字母数字 → 半角
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  for (const w of FILLERS) s = s.split(w).join(' ');
  // 只保留汉字、字母、数字；其它都当作分隔符
  return s.replace(/[^\u4e00-\u9fa5a-z0-9]+/g, ' ').trim();
}

/**
 * 二元分词：返回 { 词: 权重 }
 * @param {string} text  原始文本
 * @param {number} weight 整体权重（答案部分传 0.3）
 */
export function tokenize(text, weight = 1) {
  const tf = {};
  const bump = (t, w) => { tf[t] = (tf[t] || 0) + w; };
  for (const seg of normalize(text).split(' ')) {
    if (!seg) continue;
    const chars = [...seg];
    chars.forEach((c) => bump(c, 0.5 * weight));                 // 单字：权重减半
    for (let i = 0; i < chars.length - 1; i++) bump(chars[i] + chars[i + 1], weight); // 二元组
  }
  return tf;
}

/** 合并两个词频表 */
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
  return out;
}

/** 向量的长度（L2 范数） */
function norm(vec) {
  let s = 0;
  for (const v of Object.values(vec)) s += v * v;
  return Math.sqrt(s);
}

/**
 * 建立索引：预先算好每条资料的 TF-IDF 向量
 * @param {Array<{id,q,alias,a}>} entries 知识库条目
 */
export function buildIndex(entries) {
  // 1) 每条资料的词频
  const tfs = entries.map((e) =>
    merge(tokenize([e.q, ...(e.alias || [])].join(' '), 1), tokenize(e.a, 0.3))
  );
  // 2) 文档频率 df → 逆文档频率 idf（+1 平滑，避免除零）
  const df = {};
  tfs.forEach((tf) => Object.keys(tf).forEach((t) => { df[t] = (df[t] || 0) + 1; }));
  const N = entries.length;
  const idf = {};
  for (const [t, n] of Object.entries(df)) idf[t] = Math.log((N + 1) / (n + 1)) + 1;
  // 3) TF-IDF 向量及其长度
  const vectors = tfs.map((tf) => {
    const v = {};
    for (const [t, w] of Object.entries(tf)) v[t] = w * idf[t];
    return v;
  });
  return { entries, idf, vectors, norms: vectors.map(norm) };
}

/**
 * 检索：返回按相似度从高到低排序的结果 [{ entry, score }]
 * @param {object} index buildIndex 的返回值
 * @param {string} query 用户问题
 * @param {number} k     返回前 k 条
 */
export function search(index, query, k = 3) {
  const qtf = tokenize(query, 1);
  const qv = {};
  for (const [t, w] of Object.entries(qtf)) if (index.idf[t]) qv[t] = w * index.idf[t]; // 知识库里没有的词直接忽略
  const qn = norm(qv);
  if (!qn) return [];
  const results = index.vectors
    .map((v, i) => {
      let dot = 0;
      for (const [t, w] of Object.entries(qv)) if (v[t]) dot += w * v[t];
      return { entry: index.entries[i], score: dot / (qn * index.norms[i]) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  // 覆盖率：问题里的二元组有多少在知识库里出现过。
  // 例如“推荐一家衡阳的餐厅”只有“衡阳”一个词认识，覆盖率很低 → 不该硬答。
  const grams = Object.keys(qtf).filter((t) => t.length > 1);
  const coverage = grams.length ? grams.filter((t) => index.idf[t]).length / grams.length : 1;
  results.forEach((r) => { r.coverage = coverage; });
  return results;
}

/** 问题较长（≥4 个二元组）但覆盖率低于这个值，说明大部分内容知识库不认识 → 兜底 */
export const MIN_COVERAGE = 0.3;

/** 低于这个相似度就判定为“答不上来”（用 tests 里的样例问题调出来的经验值） */
export const THRESHOLD = 0.22;

/**
 * 回答：命中则返回答案，否则返回兜底话术 + 3 个推荐问题
 * @returns {{ hit: boolean, answer: string, entry?: object, score: number, reason?: string, coverage?: number, suggestions: string[] }}
 */
export function answer(index, query) {
  const top = search(index, query, 4);
  const best = top[0];
  const grams = Object.keys(tokenize(query)).filter((t) => t.length > 1).length;
  const lowCoverage = best && grams >= 4 && best.coverage < MIN_COVERAGE;
  if (best && best.score >= THRESHOLD && !lowCoverage) {
    return {
      hit: true,
      answer: best.entry.a,
      entry: best.entry,
      score: best.score,
      // 命中时也推荐 2 个“相关问题”，引导继续提问
      suggestions: top.slice(1, 3).filter((r) => r.score > 0.08).map((r) => r.entry.q),
    };
  }
  // 兜底：有一点点相关的就推荐它们，否则推荐固定的入门问题
  let suggestions = top.filter((r) => r.score > 0.05).slice(0, 3).map((r) => r.entry.q);
  const starters = ['“半条被子”是什么故事？', '什么是通道转兵？', '长征精神的内涵是什么？', '湘江战役是怎么回事？'];
  for (const s of starters) if (suggestions.length < 3 && !suggestions.includes(s)) suggestions.push(s);
  return {
    hit: false,
    answer: '这个问题小红还要再学习…… 目前我只熟悉长征湖南段和本站的内容。你可以试试问我：',
    score: best ? best.score : 0,
    // 兜底原因：low-coverage = 问题里大部分词知识库不认识；low-score = 认识但都不够相近
    reason: lowCoverage ? 'low-coverage' : 'low-score',
    coverage: best ? best.coverage : 0,
    suggestions,
  };
}
