<template>
  <section class="cq" ref="sectionRef" :style="{ '--stage-h': stageH + 'px' }">
    <!-- Header + quarter picker -->
    <div class="cq__head">
      <div class="cq__titles">
        <h2 class="cq__title">
          <span class="cq__trophy">🏆</span>
          <span class="cq__title-text">Financial Jackpot Summary</span>
        </h2>
        <p class="cq__subtitle">Quarterly profit competition — watch the money pile up 💰</p>
      </div>

      <div class="cq__picker">
        <select class="cq__year" v-model.number="year" aria-label="Year">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
        <div class="cq__quarters" role="tablist" aria-label="Quarter">
          <button
            v-for="q in 4"
            :key="q"
            class="cq__q"
            :class="{ 'cq__q--active': selectedQuarter === q }"
            role="tab"
            :aria-selected="selectedQuarter === q"
            :title="`Q${q} covers ${quarterRangeLabel(year, q)}`"
            @click="selectQuarter(q)"
          >Q{{ q }}</button>
        </div>
      </div>
    </div>

    <!-- The money scene -->
    <div class="cq__scene">
      <!-- Coins raining behind the piles -->
      <div class="cq__rain cq__rain--back" aria-hidden="true">
        <span v-for="p in rainBack" :key="p.id" class="cq__rc" :style="rainStyle(p)">
          <i class="cq__rc-face" :style="{ backgroundImage: coinBg(p.silver, p.img) }"></i>
        </span>
      </div>

      <!-- Scattered coins across the floor -->
      <div class="cq__floor" aria-hidden="true">
        <span v-for="f in floorCoins" :key="f.id" class="cq__fc" :style="floorStyle(f)"></span>
      </div>

      <!-- States -->
      <div v-if="loading" class="cq__state">Counting the treasure…</div>
      <div v-else-if="error" class="cq__state cq__state--error">{{ error }}</div>
      <div v-else-if="ranked.length === 0" class="cq__state">
        No profit recorded for {{ year }} · Q{{ selectedQuarter }}.
      </div>

      <!-- Ranked money piles, sitting on the floor (scaled to fit width) -->
      <div v-else class="cq__stage">
        <ol class="cq__stage-inner" ref="stageRef" :style="fitStyle('bottom center')">
        <li
          v-for="(u, i) in ranked"
          :key="u.userId"
          class="cq__col"
          :class="{ 'cq__col--winner': i === 0 && u._value > 0 }"
        >
          <div class="cq__mound" :key="u.userId + '-' + animKey">
            <div v-if="i < 3 && u._value > 0" class="cq__glow" :class="rankClass(i)"></div>

            <div class="cq__top" :style="{ bottom: topOffset(u._value) + 'px' }">
              <span v-if="i === 0 && u._value > 0" class="cq__crown">👑</span>
              <span class="cq__value" :class="{ 'cq__value--neg': u._value < 0 }">
                {{ formatMoney(display[u.userId] ?? 0) }}
              </span>
              <span v-if="i < 3" class="cq__medal">{{ medals[i] }}</span>
            </div>

            <div class="cq__mound-cols">
              <div
                v-for="(colCoins, col) in stackFor(u)"
                :key="col"
                class="cq__sub"
                :class="{ 'cq__sub--peak': col === peakCol }"
              >
                <span
                  v-for="(cn, ci) in colCoins"
                  :key="ci"
                  class="cq__coin"
                  :style="coinStyleImg(col, ci + 1, cn)"
                ></span>
              </div>
              <span v-if="coinsTotal(u._value) === 0" class="cq__empty">—</span>
            </div>
          </div>
        </li>
        </ol>
      </div>

      <!-- Coins raining in front of the piles -->
      <div class="cq__rain cq__rain--front" aria-hidden="true">
        <span v-for="p in rainFront" :key="p.id" class="cq__rc" :style="rainStyle(p)">
          <i class="cq__rc-face" :style="{ backgroundImage: coinBg(p.silver, p.img) }"></i>
        </span>
      </div>
    </div>

    <!-- Player legend, below the graph (scaled to match the piles) -->
    <div v-if="!loading && !error && ranked.length" class="cq__legend">
      <ol class="cq__legend-inner" ref="legendRef" :style="fitStyle('top center')">
        <li v-for="(u, i) in ranked" :key="u.userId" class="cq__lcol">
          <div class="cq__rankbadge" :class="rankClass(i)">{{ i + 1 }}</div>
          <div class="cq__avatar" :style="avatarStyle(u)">
            <span v-if="!u.avatarUrl">{{ initials(u.name) }}</span>
          </div>
          <div class="cq__meta">
            <span class="cq__name" :title="u.name">{{ u.name }}</span>
            <!-- Shown to a super admin only: accounts without a group, tagged with their role. -->
            <span v-if="u.adminAccount" class="cq__role" :title="`${u.roleLabel} account`">{{ u.roleLabel }}</span>
            <span class="cq__group" v-else-if="u.group">{{ u.group }}</span>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { getQuarterProfit } from '../../services/finance';
import { currentQuarter, quarterRangeLabel } from '../../utils/businessMonth';
import goldSvg from '../../assets/coin.svg';
import silverSvg from '../../assets/coin-silver.svg';

// Real coin photos live in /public/coins (see that folder's README). Until they
// exist, the imported SVG shows as a fallback layer behind them.
const GOLD_IMGS = ['/coins/gold-1.jpg', '/coins/gold-2.jpg', '/coins/gold-3.jpg', '/coins/gold-4.jpg'];
const SILVER_IMGS = ['/coins/silver-1.jpg', '/coins/silver-2.jpg', '/coins/silver-3.jpg'];
const coinBg = (silver, idx) => {
  const list = silver ? SILVER_IMGS : GOLD_IMGS;
  const img = list[idx % list.length];
  return `url("${img}"), url("${silver ? silverSvg : goldSvg}")`;
};

const CURRENT_YEAR = new Date().getUTCFullYear();
const START_YEAR = 2026;

const stageH = 380;
const BELL = [0.5, 0.8, 1, 0.8, 0.5];   // per-column weight → rounded pile
const peakCol = 2;
const MAX_PILE = 58;
const MIN_PILE = 6;
const COIN_STEP = 5;
const HERO_EXTRA = 14;
const SKY = 150;

const year = ref(START_YEAR);
const selectedQuarter = ref(currentQuarter()?.quarter || 1);
const users = ref([]);
const loading = ref(false);
const error = ref('');
const display = ref({});
const animKey = ref(0);
const stacks = ref({});     // userId -> [[coin]] columns

const medals = ['🥇', '🥈', '🥉'];

const yearOptions = computed(() => {
  const end = Math.max(CURRENT_YEAR, START_YEAR);
  const list = [];
  for (let y = START_YEAR; y <= end + 1; y += 1) list.push(y);
  return list;
});

const ranked = computed(() => {
  const q = selectedQuarter.value;
  return users.value
    .map((u) => ({ ...u, _value: Number(u.quarters?.[q]) || 0 }))
    .sort((a, b) => b._value - a._value);
});

const maxVal = computed(() => Math.max(1, ...ranked.value.map((u) => u._value)));

const coinsTotal = (v) =>
  v > 0 ? Math.min(MAX_PILE, Math.max(MIN_PILE, Math.round((v / maxVal.value) * MAX_PILE))) : 0;
const subHeights = (v) => {
  const total = coinsTotal(v);
  if (total <= 0) return [];
  const sumW = BELL.reduce((a, b) => a + b, 0);
  return BELL.map((w) => Math.max(1, Math.round((w / sumW) * total)));
};
const peakHeight = (v) => (subHeights(v)[peakCol] || 0);
const topOffset = (v) => (peakHeight(v) > 0 ? (peakHeight(v) - 1) * COIN_STEP + HERO_EXTRA + 8 : 6);

const coinStyle = (col, c) => {
  const fall = Math.max(28, SKY - (c - 1) * COIN_STEP);
  const spin = c % 2 === 0 ? 12 : -12;
  return {
    animationDelay: `${(c - 1) * 42 + Math.abs(col - peakCol) * 60}ms`,
    '--fall': `${fall}px`,
    '--spin': `${spin}deg`,
  };
};
const coinStyleImg = (col, c, cn) => ({ ...coinStyle(col, c), backgroundImage: coinBg(cn.silver, cn.img) });

// Build each user's stacks: a coin object (gold/silver + image) per slot.
const genStacks = (v) =>
  subHeights(v).map((h) =>
    Array.from({ length: h }, () => ({ silver: Math.random() < 0.34, img: Math.floor(Math.random() * 4) }))
  );
const stackFor = (u) => stacks.value[u.userId] || [];

// ── Fit-to-width: scale the piles (and legend) so they never horizontal-scroll ──
const sectionRef = ref(null);
const stageRef = ref(null);
const legendRef = ref(null);
const fitScale = ref(1);
const fitStyle = (origin) => ({
  transform: `translateX(-50%) scale(${fitScale.value})`,
  transformOrigin: origin,
});
const computeFit = () => {
  const el = stageRef.value;
  if (!el || !el.parentElement) { fitScale.value = 1; return; }
  const avail = el.parentElement.clientWidth;   // full scene width
  const natural = el.offsetWidth;               // piles' natural width (pre-transform)
  fitScale.value = natural > 0 ? Math.min(1, avail / natural) : 1;
};
let resizeObs = null;

const rankClass = (i) => (i < 3 ? `is-top${i + 1}` : '');
const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '?';
const avatarStyle = (u) => (u.avatarUrl ? { backgroundImage: `url(${u.avatarUrl})` } : {});

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const formatMoney = (v) => moneyFmt.format(Math.round(Number(v) || 0));

// ── Rain + floor (mixed gold/silver, built once) ───────────
const makeRain = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    left: Math.random() * 100,
    size: 12 + Math.random() * 15,
    dur: 4.6 + Math.random() * 4,
    delay: -Math.random() * 8,
    drift: (Math.random() * 2 - 1) * 38,
    spinDur: 1.1 + Math.random() * 1.6,
    blur: 0.6 + Math.random() * 1.9,
    depth: 0.2 + Math.random() * 0.26,
    silver: Math.random() < 0.4,
    img: Math.floor(Math.random() * 4),
  }));
const rainBack = makeRain(8, 'b');
const rainFront = makeRain(3, 'f');
const floorCoins = Array.from({ length: 0 }, (_, i) => ({
  id: `fl${i}`,
  left: Math.random() * 100,
  bottom: Math.random() * 26,
  size: 15 + Math.random() * 16,
  rot: Math.random() * 360,
  sy: 0.32 + Math.random() * 0.28,
  z: Math.round(Math.random() * 4),
  bright: 0.85 + Math.random() * 0.35,
  silver: Math.random() < 0.4,
  img: Math.floor(Math.random() * 4),
}));

const rainStyle = (p) => ({
  left: p.left + '%',
  width: p.size + 'px',
  height: p.size + 'px',
  opacity: p.depth,
  filter: p.blur ? `blur(${p.blur}px)` : 'none',
  animationDuration: p.dur + 's',
  animationDelay: p.delay + 's',
  '--drift': p.drift + 'px',
  '--spin-dur': p.spinDur + 's',
});
const floorStyle = (f) => ({
  left: f.left + '%',
  bottom: f.bottom + 'px',
  width: f.size + 'px',
  height: f.size + 'px',
  transform: `rotate(${f.rot}deg) scaleY(${f.sy})`,
  zIndex: f.z,
  filter: `brightness(${f.bright})`,
  backgroundImage: coinBg(f.silver, f.img),
});

// ── Count-up + rebuild ─────────────────────────────────────
let rafId = null;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const runAnimation = () => {
  if (rafId) cancelAnimationFrame(rafId);
  animKey.value += 1;
  const map = {};
  ranked.value.forEach((u) => { map[u.userId] = genStacks(u._value); });
  stacks.value = map;

  const targets = ranked.value.map((u) => ({ id: u.userId, to: u._value }));
  const zero = {};
  targets.forEach((t) => { zero[t.id] = 0; });
  display.value = zero;

  const DURATION = 1300;
  let startTs = null;
  const step = (ts) => {
    if (startTs === null) startTs = ts;
    const p = Math.min(1, (ts - startTs) / DURATION);
    const e = easeOutCubic(p);
    const next = {};
    targets.forEach((t) => { next[t.id] = t.to * e; });
    display.value = next;
    if (p < 1) rafId = requestAnimationFrame(step);
    else { const fin = {}; targets.forEach((t) => { fin[t.id] = t.to; }); display.value = fin; rafId = null; }
  };
  rafId = requestAnimationFrame(step);
};

const selectQuarter = (q) => { if (selectedQuarter.value !== q) selectedQuarter.value = q; };

const fetchData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await getQuarterProfit({ year: year.value });
    users.value = res.data?.data?.users || [];
    runAnimation();
  } catch (err) {
    error.value = err.response?.data?.error?.message || err.message || 'Failed to load profit data';
    users.value = [];
  } finally {
    loading.value = false;
  }
};

watch(year, fetchData);
watch(selectedQuarter, runAnimation);
watch(ranked, () => nextTick(computeFit));
onMounted(() => {
  fetchData();
  if (typeof ResizeObserver !== 'undefined' && sectionRef.value) {
    resizeObs = new ResizeObserver(() => computeFit());
    resizeObs.observe(sectionRef.value);
  }
});
onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
});
</script>

<style scoped>
.cq {
  position: relative;
  border-radius: 18px;
  padding: 1.2rem 1.3rem 1rem;
  overflow: hidden;
  background:
    radial-gradient(620px 240px at 50% -6%, rgba(246, 201, 69, 0.14), transparent 62%),
    linear-gradient(180deg, #ffffff 0%, #fdfaf3 58%, #f7f0e2 100%);
  border: 1px solid rgba(214, 168, 60, 0.28);
  box-shadow: 0 12px 34px rgba(120, 90, 20, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.cq__head {
  position: relative; z-index: 6;
  display: flex; flex-wrap: wrap; gap: 1rem;
  align-items: center; justify-content: space-between;
}
.cq__title { margin: 0; font-size: 1.4rem; font-weight: 900; display: flex; align-items: center; gap: 0.55rem; }
.cq__trophy { font-size: 1.55rem; filter: drop-shadow(0 3px 6px rgba(214, 168, 60, 0.5)); animation: cq-bob 2.6s ease-in-out infinite; }
.cq__title-text {
  background: linear-gradient(90deg, #b8860b, #e0a81c 40%, #f6c945 55%, #b8860b);
  background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: cq-sheen 5s linear infinite;
}
@keyframes cq-sheen { to { background-position: 200% center; } }
.cq__subtitle { margin: 0.25rem 0 0; font-size: 0.82rem; color: #8a6d2f; font-weight: 600; }

.cq__picker { display: flex; align-items: center; gap: 0.6rem; }
.cq__year { padding: 0.42rem 0.6rem; border-radius: 10px; font-weight: 800; background: #fff; color: #7a5a09; border: 1px solid rgba(214, 168, 60, 0.5); }
.cq__quarters { display: inline-flex; gap: 3px; padding: 3px; border-radius: 12px; background: rgba(255, 255, 255, 0.7); border: 1px solid rgba(214, 168, 60, 0.4); }
.cq__q { border: 0; background: transparent; cursor: pointer; color: #9a7a2e; font-weight: 800; font-size: 0.85rem; padding: 0.42rem 0.85rem; border-radius: 9px; transition: all 0.18s ease; }
.cq__q:hover { color: #5c4306; transform: translateY(-1px); }
.cq__q--active { color: #4a3800; background: linear-gradient(135deg, #ffe27a, #f6c945 55%, #d4a017); box-shadow: 0 4px 12px rgba(214, 168, 60, 0.5); }

/* Scene */
.cq__scene { position: relative; height: var(--stage-h, 380px); margin-top: 0.4rem; perspective: 900px; overflow: hidden; }
.cq__state {
  position: absolute; inset: 0; z-index: 6;
  display: flex; align-items: center; justify-content: center;
  color: #8a6d2f; font-size: 0.95rem; font-weight: 600;
}
.cq__state--error { color: #b91c1c; }

/* Coin rain */
.cq__rain { position: absolute; inset: 0; pointer-events: none; transform-style: preserve-3d; }
.cq__rain--back { z-index: 1; }
.cq__rain--front { z-index: 5; }
.cq__rc { position: absolute; top: -50px; transform-style: preserve-3d; animation-name: cq-rain-fall; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform; }
.cq__rc-face {
  display: block; width: 100%; height: 100%; border-radius: 50%;
  background-position: center; background-size: cover; background-repeat: no-repeat;
  box-shadow: 0 2px 5px rgba(60, 50, 20, 0.42), inset 0 0 3px rgba(0, 0, 0, 0.15);
  animation: cq-spin var(--spin-dur, 1s) linear infinite;
}
@keyframes cq-rain-fall {
  0% { transform: translate3d(0, -50px, 0); }
  100% { transform: translate3d(var(--drift, 0), calc(var(--stage-h, 380px) + 80px), 0); }
}
@keyframes cq-spin { to { transform: rotateY(360deg) rotateZ(18deg); } }

/* Soft floor line the piles rest on */
.cq__floor { position: absolute; left: 0; right: 0; bottom: 0; height: 60px; z-index: 2; pointer-events: none; }
.cq__scene::after {
  content: ''; position: absolute; left: 6%; right: 6%; bottom: 0; height: 46px; z-index: 0; pointer-events: none;
  background: radial-gradient(120% 100% at 50% 100%, rgba(120, 90, 20, 0.1), transparent 70%);
}
.cq__fc {
  position: absolute; border-radius: 50%;
  background-position: center; background-size: cover; background-repeat: no-repeat;
  box-shadow: 0 2px 3px rgba(60, 50, 20, 0.4);
}

/* Piles sit on the floor; the inner row scales to fit (no horizontal scroll) */
.cq__stage { position: absolute; left: 0; right: 0; bottom: 0; height: 240px; z-index: 3; }
.cq__stage-inner {
  position: absolute; left: 50%; bottom: 0; transform-origin: bottom center;
  list-style: none; margin: 0; padding: 0;
  display: flex; align-items: flex-end; gap: 4px;
}
.cq__col { flex: 0 0 auto; width: 120px; }
.cq__col--winner { animation: cq-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes cq-rise { 0% { transform: translateY(10px); } 100% { transform: translateY(0); } }

.cq__mound { position: relative; width: 100%; height: 240px; }
/* Soft ground shadow so each pile rests on the floor */
.cq__mound::after {
  content: ''; position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%);
  width: 104px; height: 15px; border-radius: 50%; z-index: 0;
  background: radial-gradient(ellipse, rgba(90, 60, 10, 0.26), transparent 70%);
  filter: blur(2px);
}

/* Subtle light halo behind the top-3 piles */
.cq__glow {
  position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%);
  width: 128px; height: 138px; border-radius: 50%; z-index: 0; pointer-events: none;
  filter: blur(10px); animation: cq-glow-pulse 3s ease-in-out infinite;
}
.cq__glow.is-top1 { width: 164px; height: 178px; background: radial-gradient(circle, rgba(255,214,84,0.6) 0%, rgba(255,196,40,0.24) 42%, rgba(255,196,40,0) 72%); }
.cq__glow.is-top2 { background: radial-gradient(circle, rgba(214,226,244,0.5) 0%, rgba(168,188,214,0.2) 44%, rgba(168,188,214,0) 72%); }
.cq__glow.is-top3 { background: radial-gradient(circle, rgba(240,168,96,0.46) 0%, rgba(200,120,40,0.18) 44%, rgba(200,120,40,0) 72%); }
@keyframes cq-glow-pulse {
  0%, 100% { opacity: 0.45; transform: translateX(-50%) scale(0.94); }
  50% { opacity: 0.8; transform: translateX(-50%) scale(1.04); }
}

.cq__top {
  position: absolute; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 1px; z-index: 6; pointer-events: none;
  transition: bottom 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.cq__crown { font-size: 1.4rem; filter: drop-shadow(0 2px 4px rgba(214, 168, 60, 0.8)); animation: cq-bob 2.2s ease-in-out infinite; }
.cq__value { font-weight: 900; font-size: 1rem; color: #7a5a09; font-variant-numeric: tabular-nums; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.85); white-space: nowrap; }
.cq__value--neg { color: #b91c1c; }
.cq__medal { font-size: 1.1rem; }

/* Neat coin stacks forming a rounded pile */
.cq__mound-cols { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; display: flex; justify-content: center; align-items: flex-end; }
.cq__sub { display: flex; flex-direction: column-reverse; align-items: center; margin: 0 -11px; }
.cq__coin {
  width: 40px; height: 14px; margin-top: -8px; border-radius: 50%;
  background-position: center; background-size: cover; background-repeat: no-repeat;
  box-shadow: 0 2px 3px rgba(60, 50, 20, 0.4);
  position: relative; transform-origin: center;
  animation: cq-pour 0.72s linear both;
}
.cq__sub .cq__coin:last-child { height: 18px; margin-top: -6px; }
.cq__sub--peak .cq__coin:last-child { height: 26px; width: 46px; margin-top: -5px; z-index: 2; box-shadow: 0 3px 5px rgba(60, 50, 20, 0.5); }
.cq__empty { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); color: #b99a4e; font-weight: 800; }

@keyframes cq-pour {
  0% { transform: translateY(calc(-1 * var(--fall, 130px))) rotate(var(--spin, -10deg)) scaleY(0.9); opacity: 0; animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45); }
  14% { opacity: 1; }
  60% { transform: translateY(0) rotate(0deg) scaleY(1); animation-timing-function: cubic-bezier(0.3, 1.5, 0.6, 1); }
  74% { transform: translateY(0) scaleY(0.78) scaleX(1.05); }
  87% { transform: translateY(0) scaleY(1.08) scaleX(0.98); }
  100% { transform: translateY(0) scaleY(1); opacity: 1; }
}

/* Player legend, below the graph (scaled in sync with the piles) */
.cq__legend { position: relative; height: 86px; margin-top: 0.6rem; }
.cq__legend-inner {
  position: absolute; left: 50%; top: 0; transform-origin: top center;
  list-style: none; margin: 0; padding: 0;
  display: flex; gap: 4px;
}
.cq__lcol {
  flex: 0 0 auto; width: 120px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 6px 8px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(214, 168, 60, 0.3);
}
.cq__rankbadge {
  width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 0.72rem; color: #6b5209; background: #fff; border: 1px solid rgba(214, 168, 60, 0.5);
}
.cq__rankbadge.is-top1 { background: linear-gradient(180deg, #ffe27a, #d4a017); color: #4a3800; }
.cq__rankbadge.is-top2 { background: linear-gradient(180deg, #eef2f7, #94a3b8); color: #2a3340; }
.cq__rankbadge.is-top3 { background: linear-gradient(180deg, #e6b17e, #b45309); color: #3a1c02; }
.cq__avatar {
  width: 40px; height: 40px; border-radius: 50%; background-size: cover; background-position: center;
  background-color: #6366f1; color: #fff; font-weight: 800; font-size: 0.82rem;
  display: flex; align-items: center; justify-content: center; border: 2px solid rgba(214, 168, 60, 0.5);
}
.cq__lcol:first-child .cq__avatar { border-color: #f6c945; box-shadow: 0 0 0 3px rgba(246, 201, 69, 0.3), 0 6px 16px rgba(214, 168, 60, 0.5); }
.cq__meta { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.cq__name { font-weight: 800; font-size: 0.82rem; color: #5c4306; max-width: 108px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cq__group { font-size: 0.68rem; color: #a3843c; }
/* Super admin view: admin / finance manager accounts, tagged instead of a group. */
.cq__role {
  margin-top: 1px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.5;
  color: #fff;
  background: #8a6514;
  white-space: nowrap;
}

@keyframes cq-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

@media (prefers-reduced-motion: reduce) {
  .cq__rc, .cq__rc-face, .cq__coin, .cq__trophy, .cq__crown, .cq__title-text, .cq__col--winner, .cq__glow, .cq__rays { animation: none !important; }
  .cq__coin { opacity: 1; transform: none; }
  .cq__rc { display: none; }
}
</style>
