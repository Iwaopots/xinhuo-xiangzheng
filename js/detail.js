/**
 * detail.js —— 节点详情页（第三层）的共用渲染脚本
 * ------------------------------------------------------------
 * 四个详情页（pages/rucheng.html 等）用的是同一个 HTML 模板，
 * 唯一区别是 <body data-node="tongdao">。本脚本读取这个 id，
 * 从 js/data/nodes.js 里取出对应章节和 detail 字段，生成整页内容：
 *   页头 → 历史经过 + 时间轴 → 小地图 + 人物小卡 → 金句 → 今天的它 → 上一站/下一站
 *
 * 所有路径都是相对路径（../），部署在 GitHub Pages 子路径 /xinhuo-xiangzheng/ 下同样可用。
 * ⚠️ 内容为初稿，史料待核（见 nodes.js 顶部说明）。
 */

import { detailOrder } from './data/nodes.js';

const C = { red: '#B3261E', paper: '#F4EDE1', paperDark: '#E9DCC4', ink: '#1F1A17', inkSoft: '#5A4E45' };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** HTML 转义：内容来自配置文件，也照样转义，养成习惯 */
function esc(str = '') {
  return String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function render(node, idx) {
  const d = node.detail;
  const prev = detailOrder[idx - 1];
  const next = detailOrder[idx + 1];

  document.title = `${node.title} —— 薪火·湘征`;

  const timeline = d.timeline
    .map((t) => `<li><time>${esc(t.time)}</time><p>${esc(t.text)}</p></li>`)
    .join('');

  const people = d.people
    .map(
      (p) => `<article class="person">
        <div class="person-seal" aria-hidden="true">${esc([...p.name][0])}</div>
        <div><h4>${esc(p.name)}</h4><p class="person-role">${esc(p.role)}</p><p>${esc(p.text)}</p></div>
      </article>`
    )
    .join('');

  const navLink = (n, dir) =>
    n
      ? `<a class="pager-link pager-${dir}" href="${esc(n.detail.page)}">
           <span>${dir === 'prev' ? '← 上一站' : '下一站 →'}</span><strong>${esc(n.title)}</strong></a>`
      : `<a class="pager-link pager-${dir} is-map" href="../index.html#storymap">
           <span>${dir === 'prev' ? '← 回到' : '回到 →'}</span><strong>湘征地图</strong></a>`;

  document.getElementById('detail').innerHTML = `
    <nav class="crumbs" aria-label="面包屑">
      <a href="../index.html">首页</a><span>/</span>
      <a href="../index.html#step-${esc(node.id)}">湘征地图</a><span>/</span>
      <span aria-current="page">${esc(node.kicker)} · ${esc(node.mapLabel)}</span>
    </nav>

    <header class="detail-head">
      <p class="section-no">${esc(node.kicker)} · ${esc(node.date)}</p>
      <h1>${esc(node.title)}</h1>
      <p class="detail-place">${esc(node.place)}</p>
    </header>

    <div class="detail-grid">
      <section class="detail-main" aria-labelledby="h-history">
        <h2 id="h-history" class="col-title">历史经过</h2>
        <p class="detail-history">${esc(d.history)}</p>
        ${node.note ? `<p class="step-note">${esc(node.note)}</p>` : ''}
        <h2 class="col-title">时间轴</h2>
        <ol class="timeline">${timeline}</ol>
      </section>

      <aside class="detail-side">
        <div class="mini-map-frame">
          <div id="miniMap" class="mini-map" role="img" aria-label="${esc(node.mapLabel)}位置示意图"></div>
          <p class="map-note">位置示意 · 坐标为近似值</p>
        </div>
        <h2 class="col-title">人物小卡</h2>
        ${people}
      </aside>
    </div>

    <figure class="golden">
      <blockquote>“${esc(d.golden.text)}”</blockquote>
      <figcaption>—— ${esc(d.golden.source)}</figcaption>
    </figure>

    <section class="today" aria-labelledby="h-today">
      <h2 id="h-today" class="col-title">今天的它</h2>
      <div class="today-grid">
        <article class="today-card">
          <p class="today-label">纪念馆 / 旧址</p>
          <h3>${esc(d.today.name)}</h3>
          <p>${esc(d.today.intro)}</p>
        </article>
        <article class="today-card today-route">
          <p class="today-label">从衡阳出发怎么去</p>
          <h3>衡阳 → ${esc(node.mapLabel)}</h3>
          <p>${esc(d.today.route)}</p>
        </article>
      </div>
    </section>

    <p class="detail-disclaimer">本页史料为初稿，标注“待核”的内容正在对照权威出处核实；交通信息仅供参考，请以 12306 和导航为准。</p>

    <nav class="pager" aria-label="上一站 / 下一站">
      ${navLink(prev, 'prev')}
      <a class="pager-back" href="../index.html#step-${esc(node.id)}">◉ 回到湘征地图</a>
      ${navLink(next, 'next')}
    </nav>`;
}

/** 小地图：湖南底图 + 本节点的水波纹点（ECharts，本地数据） */
async function miniMap(node) {
  const echarts = window.echarts;
  const box = document.getElementById('miniMap');
  if (!echarts || !box) return;
  try {
    const [hunan, neighbors] = await Promise.all(
      ['../data/hunan.json', '../data/neighbors.json'].map((u) => fetch(u).then((r) => r.json()))
    );
    echarts.registerMap('xiang-mini', { type: 'FeatureCollection', features: [...neighbors.features, ...hunan.features] });
    const chart = echarts.init(box);
    const pts = node.newBranch ? node.branchPath : [node.coord];
    chart.setOption({
      animation: !reducedMotion,
      geo: {
        map: 'xiang-mini',
        roam: false,
        silent: true,
        center: [111.3, 27.4],
        zoom: 2.35,
        aspectScale: 0.85,
        itemStyle: { areaColor: C.paperDark, borderColor: C.ink, borderWidth: 0.5 },
        regions: neighbors.features.map((f) => ({
          name: f.properties.name,
          itemStyle: { areaColor: 'rgba(244,237,225,0.6)', borderColor: '#BDB09C' },
        })),
      },
      series: [
        // 桑植：画出红二、六军团的示意出发路线
        ...(node.newBranch
          ? [{ type: 'lines', coordinateSystem: 'geo', data: [{ coords: pts }], polyline: true, lineStyle: { color: C.red, width: 2.5 } }]
          : []),
        {
          type: reducedMotion ? 'scatter' : 'effectScatter',
          coordinateSystem: 'geo',
          symbolSize: 14,
          rippleEffect: { brushType: 'stroke', scale: 4 },
          itemStyle: { color: C.red },
          label: { show: true, formatter: node.mapLabel, position: 'right', fontWeight: 'bold', fontSize: 14, color: C.ink, backgroundColor: 'rgba(244,237,225,.85)', padding: [2, 5] },
          data: [{ value: node.coord }],
        },
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          symbolSize: 8,
          itemStyle: { color: C.paper, borderColor: C.inkSoft, borderWidth: 2 },
          label: { show: true, formatter: '衡阳', position: 'top', fontSize: 12, color: C.inkSoft, backgroundColor: 'rgba(244,237,225,.85)', padding: [1, 3] },
          data: [{ value: [112.57, 26.89] }], // 衡阳市区近似坐标（读者所在地，作参照）
        },
      ],
    });
    window.addEventListener('resize', () => chart.resize());
  } catch (err) {
    box.textContent = '地图加载失败';
    console.warn(err);
  }
}

function main() {
  const id = document.body.dataset.node;
  const idx = detailOrder.findIndex((n) => n.id === id);
  if (idx < 0) {
    document.getElementById('detail').textContent = '没有找到这个节点。';
    return;
  }
  render(detailOrder[idx], idx);
  miniMap(detailOrder[idx]);
}

main();
