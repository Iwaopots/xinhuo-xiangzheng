/**
 * relay-store.js —— 青春接力墙的“存储适配器”
 * ------------------------------------------------------------
 * 设计思路（答辩可讲）：界面代码（relay.js）只认一个统一接口，不关心数据存在哪：
 *
 *     store.list()        → Promise<Entry[]>   按编号从小到大
 *     store.add(input)    → Promise<Entry>     自动分配编号 no、时间 time
 *     store.clearSamples()→ Promise<void>      清除示例数据（可选能力）
 *
 *   Entry = { no: number, name: string, major: string, goal: string, time: string(ISO), sample?: true }
 *
 * 现在用 localStorage（离线可用、零后端）；以后想让全校同学共享一面墙，
 * 只要按同样接口写一个云端适配器（见文件末尾的 Supabase 示例），
 * 在 relay.js 里把 createLocalStore() 换成 createSupabaseStore() 即可，界面代码一行不改。
 */

const KEY = 'xhxz.relay.v1';            // 接力数据
const SEEDED_KEY = 'xhxz.relay.seeded'; // 是否已写入过示例（清除示例后不再重新写入）

/** 示例数据：明确标记 sample: true，界面上会盖“示例”章，可一键清除 */
const SAMPLES = [
  { name: '小湘', major: '计算机科学与技术 2401', goal: '把网页大赛作品做到决赛，用代码讲好家乡的红色故事' },
  { name: '阿禾', major: '机械设计制造及其自动化', goal: '今年拿下大学英语六级，再去汝城沙洲看一看' },
  { name: '晨光', major: '电气工程及其自动化 2302', goal: '坚持每天跑步三公里，跑完一次半程马拉松' },
  { name: '星火', major: '软件工程 2403', goal: '学会一门新语言，独立做出一个对同学有用的小程序' },
  { name: '南岳', major: '土木工程 2301', goal: '考研上岸，将来去建设家乡的路和桥' },
  { name: '芷兰', major: '会计学 2402', goal: '参加一次支教，把长征故事讲给山里的孩子听' },
  { name: '远方', major: '汽车服务工程', goal: '拿到驾驶证，暑假骑行去通道转兵纪念馆' },
  { name: '青竹', major: '数据科学与大数据技术 2401', goal: '用数据可视化做一张更准确的湖南长征地图' },
];

/** 读取 localStorage；数据损坏时返回空数组而不是让页面崩溃 */
function read() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function write(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

/** 本地存储适配器（默认） */
export function createLocalStore() {
  // 首次访问：写入示例数据，日期往前错开几天，看起来更自然
  if (!localStorage.getItem(SEEDED_KEY)) {
    const now = Date.now();
    const seeds = SAMPLES.map((s, i) => ({
      no: i + 1,
      ...s,
      time: new Date(now - (SAMPLES.length - i) * 86400000 * 0.7).toISOString(),
      sample: true,
    }));
    write([...seeds, ...read().filter((e) => !e.sample)]);
    localStorage.setItem(SEEDED_KEY, '1');
  }

  return {
    async list() {
      return read().sort((a, b) => a.no - b.no);
    },
    async add({ name, major, goal }) {
      const all = read();
      // 编号 = 当前最大编号 + 1（清除示例后编号也不会重复）
      const no = all.reduce((m, e) => Math.max(m, Number(e.no) || 0), 0) + 1;
      const entry = { no, name, major, goal, time: new Date().toISOString() };
      all.push(entry);
      write(all);
      return entry;
    },
    async clearSamples() {
      write(read().filter((e) => !e.sample));
    },
  };
}

/* ------------------------------------------------------------------
 * 云端适配器示例（未启用，仅供以后接入参考）—— 以 Supabase 为例
 * ------------------------------------------------------------------
 * 1. 在 Supabase 建表 relay：no(bigint, identity) name(text) major(text) goal(text) time(timestamptz default now())
 * 2. 开启 Row Level Security，只允许匿名 insert / select，并在数据库端用 check 约束限制字段长度
 *    （前端校验可以被绕过，长度和内容必须在服务端再校验一次）。
 * 3. 把下面代码取消注释，在 relay.js 中改用 createSupabaseStore(URL, ANON_KEY)。
 *
 * export function createSupabaseStore(url, anonKey) {
 *   const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' };
 *   return {
 *     async list() {
 *       const res = await fetch(`${url}/rest/v1/relay?select=*&order=no.asc&limit=500`, { headers });
 *       if (!res.ok) throw new Error('读取失败');
 *       return res.json();
 *     },
 *     async add({ name, major, goal }) {
 *       const res = await fetch(`${url}/rest/v1/relay`, {
 *         method: 'POST',
 *         headers: { ...headers, Prefer: 'return=representation' },
 *         body: JSON.stringify({ name, major, goal }),
 *       });
 *       if (!res.ok) throw new Error('提交失败');
 *       return (await res.json())[0];
 *     },
 *   };
 * }
 *
 * LeanCloud 同理：用其 REST API 的 /1.1/classes/Relay 实现 list() / add() 两个方法即可。
 */
