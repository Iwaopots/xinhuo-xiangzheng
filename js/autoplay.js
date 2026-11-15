/**
 * autoplay.js —— 湘征地图“自动播放”（现场演示用）
 * ------------------------------------------------------------
 * 原理：不另写一套动画，而是让页面自动滚动到下一张故事卡片，
 *       卡片进入触发线后，scrollama 照常触发地图飞行 —— 和手动滚动走的是同一条路径。
 *
 * 操作：
 *   点击「▶ 自动播放」开始；再点一次或按 空格 暂停/继续；
 *   ← / → 切换上一站 / 下一站（地图区域在屏幕内时有效）；
 *   播放中用户自己滚轮/触摸滚动 → 自动暂停，把控制权还给用户。
 */

const DWELL = 6500; // 每一站停留时间（毫秒）

/**
 * @param {{ stepEls: HTMLElement[], getIndex: () => number, reducedMotion: boolean }} story
 */
export function initAutoplay({ stepEls, getIndex, reducedMotion }) {
  const section = document.getElementById('storymap');
  const btn = document.getElementById('autoplayBtn');
  const hint = document.getElementById('autoplayHint');
  if (!section || !btn || !stepEls.length) return;

  let playing = false;
  let session = false; // 是否进入过“演示模式”（之后空格键才被接管）
  let timer = null;
  let autoScrolling = false; // 程序正在滚动时，忽略“用户滚动 → 暂停”的判断

  /** 把第 i 张卡片滚到触发线附近（卡片顶部约在屏幕 30% 处，越过 scrollama 的触发线） */
  function goTo(i) {
    const idx = Math.max(0, Math.min(stepEls.length - 1, i));
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    const top = stepEls[idx].getBoundingClientRect().top + window.scrollY - window.innerHeight * (mobile ? 0.55 : 0.3);
    autoScrolling = true;
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
    setTimeout(() => { autoScrolling = false; }, 1200);
    return idx;
  }

  function render() {
    btn.textContent = playing ? '❚❚ 暂停' : '▶ 自动播放';
    btn.setAttribute('aria-pressed', String(playing));
    hint.hidden = !session;
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(() => {
      const next = getIndex() + 1;
      if (next >= stepEls.length) {
        pause(); // 播到尾声自动停止
        return;
      }
      goTo(next);
      schedule();
    }, DWELL);
  }

  function play() {
    session = true;
    playing = true;
    // 如果地图不在屏幕里（或还没开始），先跳到当前章节（首次为序章）
    const rect = section.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5;
    const cur = getIndex();
    if (!inView || cur < 0) goTo(Math.max(cur, 0));
    else if (cur >= stepEls.length - 1) goTo(0); // 已在尾声：从头再播
    render();
    schedule();
  }

  function pause() {
    playing = false;
    clearTimeout(timer);
    render();
  }

  btn.addEventListener('click', () => (playing ? pause() : play()));

  /** 地图栏目是否在屏幕中间（键盘控制只在这时生效，不影响页面其它部分） */
  const storyInView = () => {
    const r = section.getBoundingClientRect();
    return r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
  };

  window.addEventListener('keydown', (e) => {
    // 在输入框、对话框里打字时不接管按键
    if (e.target.closest && e.target.closest('input, textarea, select, dialog, [contenteditable]')) return;
    if (!storyInView()) return;
    // 焦点在按钮上时，空格交给按钮自己的点击（避免一次按键触发两次）
    if (e.code === 'Space' && session && !(e.target.closest && e.target.closest('button, a'))) {
      e.preventDefault();
      playing ? pause() : play();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(getIndex() + (e.key === 'ArrowRight' ? 1 : -1));
      if (playing) schedule(); // 手动切换后重新计时
    }
  });

  // 用户自己滚动 → 暂停自动播放
  const userScroll = () => { if (playing && !autoScrolling) pause(); };
  window.addEventListener('wheel', userScroll, { passive: true });
  window.addEventListener('touchmove', userScroll, { passive: true });

  render();
}
