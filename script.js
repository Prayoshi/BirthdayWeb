/* ======================================================
   EDIT THESE (or override from the URL, e.g.
   index.html?name=Riya&candles=6&wish=Stay%20magical&from=Sam)
====================================================== */
const DEFAULTS = {
  name: "FRIEND",
  candles: 5,
  wish: "Edit the msg in script.js or override from the URL, e.g. index.html?name=Riya&candles=6&wish=Stay%20magical&from=Sam",
  from: "with love",                       // e.g. "with love, Sam"
};
// Blow detection: lower volume = more sensitive
const BLOW_MIN_VOLUME = 0.025;
const BLOW_LOW_RATIO  = 0.25;
const BLOW_HOLD_MS    = 180;

/* ====================================================== */
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const NAME = params.get("name") || DEFAULTS.name;
const CANDLES = Math.min(Math.max(parseInt(params.get("candles")) || DEFAULTS.candles, 1), 15);
const WISH = params.get("wish") || DEFAULTS.wish;
const FROM = params.get("from") ?? DEFAULTS.from;

$("title").textContent = `HAPPY BIRTHDAY, ${NAME}!`;
$("letter-from").textContent = FROM;


/* ---------- scale the cake stage to its wrapper ---------- */

// The visible window onto the art (cake art coordinates). It covers the whole
// cake INCLUDING the outer sparkles (x 70-680, y 60-470) plus room for the cats.
// If you change these, change .art-origin / .cake-wrap / .cake-stage in style.css too.
const VIEW = { x: 20, y: 30, w: 700, h: 470 };

function scaleCake() {
    const wrap = document.querySelector('.cake-wrap');
    const stage = document.querySelector('.cake-stage');

    if (!wrap || !stage) return;

    const scale = wrap.clientWidth / VIEW.w;

    stage.style.setProperty('--cake-scale', scale);
    stage.style.left = `${(wrap.clientWidth - VIEW.w * scale) / 2}px`;
}

window.addEventListener('load', scaleCake);
window.addEventListener('resize', scaleCake);

/* ---------- candles: standing on top of the cake ---------- */
// Coordinates are in the cake art's own pixel space.
const origin = $("art-origin");
const S = 0.55, CX = 355, BASE = 152, PER_ROW = 5, GAP = 46;
const ANCHOR = { x: 95, y: 200 };            // bottom-centre of the candle art
const candles = [];
(function buildCandles() {
  const rows = Math.ceil(CANDLES / PER_ROW);
  for (let i = 0; i < CANDLES; i++) {
    const r = Math.floor(i / PER_ROW), k = Math.min(PER_ROW, CANDLES - r * PER_ROW), c = i % PER_ROW;
    const x = CX + (c - (k - 1) / 2) * GAP + (r % 2 ? GAP / 4 : 0);
    const y = BASE - r * 17;
    const el = document.createElement("div");
    el.className = "candle-wrap";
    el.style.cssText = `left:${x - ANCHOR.x * S}px;top:${y - ANCHOR.y * S}px;transform:scale(${S});z-index:${20 - r}`;
    el.innerHTML = `<div class="pixelart-to-css candle-pixelart candle-color-${i % 5}"></div>`;
    el.firstChild.style.animationDelay = `${-(Math.random()).toFixed(2)}s`;   // desync the flames
    // box-shadow art can't be clicked, so give each candle an invisible tap area
    const hit = document.createElement("div");
    hit.style.cssText = "position:absolute;left:50px;top:30px;width:80px;height:170px;cursor:pointer;-webkit-tap-highlight-color:transparent";
    el.appendChild(hit);
    origin.appendChild(el);
    const candle = { el, flame: el.firstChild, lit: true };
    hit.addEventListener("click", () => blowCandle(candle));          // INTERACTIVE: tap a candle to blow it out
    candles.push(candle);
  }
})();


/* ---------- pixel cats: sitting around the cake + a shower when candles go out ---------- */
const CAT_COLORS = ["grey", "brown", "butter", "black", "orange", "white", "tabby", "tuxedo", "calico", "siamese"];
function makeCat(color) {
  const el = document.createElement("div");
  el.className = `cat cat-${color}`;
  el.innerHTML = '<div class="cat-bob"><div class="cat-pixelart"></div></div>';
  return el;
}


// Cats around the cake: one column on each side, evenly spaced.
// x is derived from VIEW, so a cat can never be cropped by the stage.
const CAT_PAD = 4;
const CAKE_CATS = [               // [colour, side, y, scale]
  ["brown",  "L", 110, 0.40], ["black",  "R", 135, 0.36],
  ["orange", "L", 200, 0.36], ["white",  "R", 225, 0.40],
  ["tabby",  "L", 290, 0.40], ["tuxedo", "R", 315, 0.36],
  ["butter", "L", 380, 0.36], ["grey",   "R", 405, 0.40],
];
CAKE_CATS.forEach(([color, side, y, s], i) => {
  const w = 110 * s;                                   // 110 = width of the cat art
  const x = side === "L" ? VIEW.x + CAT_PAD : VIEW.x + VIEW.w - CAT_PAD - w;
  const el = makeCat(color);
  el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.transform = `scale(${s})`;
  el.firstChild.style.animationDelay = `${-i * 0.4}s`;
  origin.appendChild(el);
});

/* ---------- CAT SHOWER ----------
   Every blown-out candle drops a shower of cats. Each cat:
     1. falls (own speed / sway / spin / delay)
     2. lands and squashes, bouncing once or twice
     3. settles at its own spot on the "floor" and STAYS there
     4. floats gently in place (own timing + height)
   Landed cats are never removed by the next shower; the floor just fills up.
   Everything is done with inline styles + Web Animations, so it works with any cat.css.        */
const CAT_W = 110, CAT_H = 100;          // size of the cat art box (.cat in cat.css)
const SHOWER_CATS = 30;                  // cats per blown candle
const FINAL_SHOWER_CATS = 30;            // cats for the last candle
const SKIP_SHOWER_CATS = 40;             // cats when "skip" is pressed
const MAX_FLOOR_CATS = 150;              // safety cap so the page stays light (oldest fade away only past this)
const rand = (a, b) => a + Math.random() * (b - a);

const catLayer = $("cat-rain");
catLayer.style.cssText = "position:fixed;inset:0;z-index:1;pointer-events:none;overflow:hidden";
const floor = [];                        // every cat that is falling or resting: { el, fx, off, s, r }

const catBox = () => ({ W: catLayer.clientWidth || innerWidth, H: catLayer.clientHeight || innerHeight });
// centre-based pose: (cx, cy) is where the middle of the cat ends up on screen
const poseOf = (cx, cy, r, s) => `translate(${cx - CAT_W / 2}px, ${cy - CAT_H / 2}px) rotate(${r}deg) scale(${s})`;

// Pick a floor spot that is as far as possible from the cats already there (best-candidate sampling)
function pickSpot(s) {
  const { W, H } = catBox();
  const half = (CAT_W * s) / 2;
  const band = Math.min(H * 0.32, 50 + floor.length * 1.2);       // the floor gets deeper as it fills up
  let best = null, bestScore = -1;
  for (let k = 0; k < 14; k++) {
    const fx = rand(half + 4, W - half - 4) / W;
    const off = rand(6, band);
    const cx = fx * W, cy = H - off - (CAT_H * s) / 2;
    let nearest = Infinity;
    for (const c of floor) {
      const d = Math.hypot(c.fx * W - cx, (c.cyOf(H) - cy) * 1.6);
      if (d < nearest) nearest = d;
    }
    if (nearest > bestScore) { bestScore = nearest; best = { fx, off }; }
  }
  return best;
}

function catShower(n = SHOWER_CATS) {
  const { W, H } = catBox();
  const sizeK = Math.min(1, Math.max(0.65, W / 900));              // smaller cats on phones

  for (let i = 0; i < n; i++) {
    const el = makeCat(CAT_COLORS[(Math.random() * CAT_COLORS.length) | 0]);
    const s = rand(0.28, 0.5) * sizeK;
    const half = (CAT_W * s) / 2;
    const { fx, off } = pickSpot(s);
    const cx = fx * W, cy = H - off - (CAT_H * s) / 2;              // where it will rest
    const clampX = (x) => Math.min(W - half - 4, Math.max(half + 4, x));
    const drift = rand(-70, 70);
    const r0 = rand(-40, 40), r1 = rand(-14, 14);                   // spin while falling, small tilt when resting
    const rest = { el, fx, off, s, r: r1, cyOf: (h) => h - off - (CAT_H * s) / 2 };
    floor.push(rest);

    // wrap the art so the landing squash can pivot around the cat's feet
    const bob = el.firstChild, sq = document.createElement("div");
    sq.style.cssText = "position:absolute;inset:0;transform-origin:50% 100%";
    el.replaceChildren(sq); sq.appendChild(bob);
    bob.style.animation = "none";                                   // no sitting-bob while falling
    el.style.cssText = `left:0;top:0;transform-origin:50% 50%;will-change:transform;animation:none;z-index:${Math.round(1000 - off)}`;
    el.style.transform = poseOf(clampX(cx - drift), -CAT_H, r0, s); // parked above the screen until its delay ends
    catLayer.appendChild(el);

    const startY = -CAT_H * s - 30;
    const fall = el.animate([
      { transform: poseOf(clampX(cx - drift), startY, r0, s) },
      { transform: poseOf(clampX(cx - drift * 0.35 + rand(-25, 25)), startY + (cy - startY) * 0.55, (r0 + r1) / 2, s), offset: 0.55 },
      { transform: poseOf(cx, cy, r1, s) },
    ], { duration: rand(1300, 2300), delay: rand(0, 700), easing: "cubic-bezier(.45,.05,.85,.5)", fill: "both" });

    fall.onfinish = () => {
      el.style.transform = poseOf(rest.fx * catBox().W, rest.cyOf(catBox().H), r1, s);
      fall.cancel();
      landCat(el, sq, bob);
    };
  }

  // only if the page gets crowded: let the oldest cats fade away
  while (floor.length > MAX_FLOOR_CATS) {
    const old = floor.shift();
    old.el.style.pointerEvents = "none";
    old.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" }).onfinish = () => old.el.remove();
  }
}

function landCat(el, sq, bob) {
  const twice = Math.random() < 0.45;                               // some cats bounce once, some twice
  const h = rand(34, 56);                                           // bounce height (in cat-art pixels)
  const squash = (y, sx) => `translateY(${y}px) scale(${sx}, ${2 - sx})`;
  const frames = twice ? [
    { transform: squash(0, 1.22), offset: 0,    easing: "ease-out" },
    { transform: squash(-h * 1.4, 0.94), offset: 0.26, easing: "ease-in" },
    { transform: squash(0, 1.12), offset: 0.52, easing: "ease-out" },
    { transform: squash(-h * 0.55, 0.97), offset: 0.74, easing: "ease-in" },
    { transform: squash(0, 1.05), offset: 0.9 },
    { transform: squash(0, 1), offset: 1 },
  ] : [
    { transform: squash(0, 1.2), offset: 0, easing: "ease-out" },
    { transform: squash(-h, 0.94), offset: 0.38, easing: "ease-in" },
    { transform: squash(0, 1.1), offset: 0.72 },
    { transform: squash(0, 1), offset: 1 },
  ];
  sq.animate(frames, { duration: twice ? 1000 : 650 }).onfinish = () => {
    // idle floating: each cat has its own height, tilt and timing
    const amp = rand(12, 30), tilt = rand(2, 5);
    bob.style.animation = "none";
    bob.animate([
      { transform: `translateY(0) rotate(${-tilt}deg)` },
      { transform: `translateY(${-amp}px) rotate(${tilt}deg)` },
    ], { duration: rand(2200, 4200), delay: -rand(0, 3000), iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
  };
  el.style.pointerEvents = "auto";                                  // landed cats can be petted
  el.style.cursor = "pointer";
}

// keep resting cats on the floor if the window is resized
window.addEventListener("resize", () => {
  const { W, H } = catBox();
  for (const c of floor) if (c.el.style.pointerEvents === "auto") c.el.style.transform = poseOf(c.fx * W, c.cyOf(H), c.r, c.s);
});

/* ---------- INTERACTIVE: tap / hover a cat to make it hop and send hearts ---------- */
const HEART_PX = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
function popHearts(el) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    const hrt = document.createElement("div"), u = 3;
    const shadows = [];
    HEART_PX.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "X") shadows.push(`${x * u}px ${y * u}px 0 0 ${y === 0 && x < 3 ? "#ff8fa3" : "#ff5f8f"}`); }));
    hrt.style.cssText = `position:absolute;width:${u}px;height:${u}px;left:${r.left + r.width / 2 - 10 + rand(-r.width / 3, r.width / 3)}px;top:${r.top}px;box-shadow:${shadows.join(",")};z-index:5000;pointer-events:none`;
    catLayer.appendChild(hrt);
    hrt.animate([
      { transform: "translate(0,0) scale(.6)", opacity: 1 },
      { transform: `translate(${rand(-22, 22)}px, ${-rand(55, 95)}px) scale(1.3)`, opacity: 0 },
    ], { duration: rand(800, 1200), delay: i * 110, easing: "ease-out", fill: "both" }).onfinish = () => hrt.remove();
  }
}
function hopCat(cat, big) {
  if (cat._hop) return;
  cat._hop = true;
  const target = cat.firstElementChild;                  // squash wrapper (floor cats) or bob (cake cats)
  const up = big ? -90 : -50;
  target.animate([
    { transform: "translateY(0) scale(1.15,.85)", easing: "ease-out" },
    { transform: `translateY(${up}px) scale(.92,1.1)`, offset: 0.45, easing: "ease-in" },
    { transform: "translateY(0) scale(1.12,.88)", offset: 0.8 },
    { transform: "translateY(0) scale(1,1)" },
  ], { duration: 600 }).onfinish = () => { cat._hop = false; };
}
document.addEventListener("click", (e) => {
  const cat = e.target.closest?.(".cat");
  if (!cat || cat.closest("#cat-scatter")) return;
  hopCat(cat, true); popHearts(cat);
});
document.addEventListener("pointerover", (e) => {                   // mouse only: a little hop when you hover
  if (e.pointerType !== "mouse") return;
  const cat = e.target.closest?.(".cat");
  if (cat && !cat.contains(e.relatedTarget) && !cat.closest("#cat-scatter")) hopCat(cat, false);
});
document.querySelectorAll(".art-origin .cat").forEach((c) => { c.style.cursor = "pointer"; });

/* ---------- microphone + blow detection ---------- */

let audioCtx, analyser, micStream, raf;
let loudSince = null;
let quietSince = null;

// Which candle should be blown out next
let nextCandle = 0;

// Prevent one long blow from blowing out multiple candles
let blowArmed = true;

// Time that the user must be quiet before another blow is accepted
const REARM_QUIET_MS = 450;

const freq = new Uint8Array(512);
const wave = new Uint8Array(1024);


async function startMic() {
    try {
        $("mic-btn").disabled = true;

        $("mic-status").textContent =
            "Requesting microphone access…";

        micStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        audioCtx =
            new (window.AudioContext || window.webkitAudioContext)();

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;

        audioCtx
            .createMediaStreamSource(micStream)
            .connect(analyser);

        $("mic-status").textContent =
            "Listening… blow on the candles!";

        $("mic-btn").style.display = "none";
        $("volume-meter").hidden = false;

        listen();

    } catch (e) {
        console.error(e);

        $("mic-status").textContent =
            "Couldn't reach the microphone. Use “skip” instead.";

        $("mic-btn").disabled = false;
    }
}


function listen() {

    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(wave);

    // Calculate microphone volume
    let sq = 0;

    for (const v of wave) {
        const n = (v - 128) / 128;
        sq += n * n;
    }

    const volume = Math.sqrt(sq / wave.length);

    // Calculate low-frequency energy
    const binHz = audioCtx.sampleRate / analyser.fftSize;

    const lowEnd = Math.round(600 / binHz);
    const topEnd = Math.min(
        Math.round(8000 / binHz),
        freq.length
    );

    let low = 0;
    let all = 0;

    for (let i = 1; i < topEnd; i++) {

        const energy = freq[i] * freq[i];

        all += energy;

        if (i < lowEnd) {
            low += energy;
        }
    }

    const lowRatio = all ? low / all : 0;


    // Update volume meter
    $("volume-fill").style.width =
        Math.min(100, volume * 500) + "%";


    const now = performance.now();

    const isBlow =
        volume > BLOW_MIN_VOLUME &&
        lowRatio > BLOW_LOW_RATIO;


    /* -----------------------------------------
       DETECT A BLOW
       ----------------------------------------- */

    if (isBlow) {

        quietSince = null;

        if (blowArmed) {

            loudSince ??= now;

            // Blow must last long enough
            if (now - loudSince >= BLOW_HOLD_MS) {

                blowNextCandle();

                // IMPORTANT:
                // One continuous blow cannot trigger
                // another candle.
                blowArmed = false;

                loudSince = null;
            }

        }

    } else {

        loudSince = null;

        // User has stopped blowing.
        // Wait until they are quiet long enough,
        // then arm the detector again.
        quietSince ??= now;

        if (
            !blowArmed &&
            now - quietSince >= REARM_QUIET_MS
        ) {
            blowArmed = true;
        }
    }


    raf = requestAnimationFrame(listen);
}


/* -----------------------------------------
   BLOW ONE CANDLE
   ----------------------------------------- */

let finished = false;

// the mic blows out the next candle that is still lit
function blowNextCandle() {
    const next = candles.find((c) => c.lit);
    if (next) blowCandle(next);
}

// ONE candle blown out = ONE cat shower. Used by the mic AND by tapping a candle.
function blowCandle(candle) {

    if (!candle.lit || finished) return;

    blowOut(candle);

    const remaining = candles.filter((c) => c.lit).length;
    const perShower = Math.min(remaining === 0 ? FINAL_SHOWER_CATS : SHOWER_CATS,
                               Math.floor(MAX_FLOOR_CATS / candles.length));
    catShower(perShower);

    if (remaining === 0) {

        // All candles are out
        finished = true;

        $("subtitle").textContent =
            "Yayy! Wishing you the happiest birthday ever!! 🎉";

        $("mic-status").textContent = "";

        $("volume-meter").hidden = true;

        stopMic();

        setTimeout(showEnvelope, 1800);

    } else {

        $("mic-status").textContent =
            `${remaining} candle${remaining === 1 ? "" : "s"} left — blow or tap!`;
    }
}


/* -----------------------------------------
   BLOW OUT INDIVIDUAL CANDLE
   ----------------------------------------- */

function blowOut(c) {

    if (!c.lit) return;

    c.lit = false;

    // Change candle to blown-out frame
    c.flame.classList.add("blown-out");

    // Add smoke
    const smoke = document.createElement("div");

    smoke.className = "smoke";

    c.el.appendChild(smoke);

    setTimeout(() => {
        smoke.remove();
    }, 1400);
}


/* -----------------------------------------
   STOP MICROPHONE
   ----------------------------------------- */

function stopMic() {

    cancelAnimationFrame(raf);

    micStream?.getTracks().forEach(
        (track) => track.stop()
    );

    audioCtx?.close();
}


/* -----------------------------------------
   BUTTONS
   ----------------------------------------- */

$("mic-btn").addEventListener(
    "click",
    startMic
);


// Skip button: turn all candles off immediately
$("skip-btn").addEventListener("click", () => {

    if (finished) return;
    finished = true;

    candles.forEach(blowOut);
    catShower(SKIP_SHOWER_CATS);   // skip = one finale shower

    nextCandle = candles.length;

    stopMic();

    $("subtitle").textContent =
        "Yayy! Wishing you more Cute Aggregation Assaults ever!! 🎉";

    $("mic-status").textContent = "";

    $("volume-meter").hidden = true;

    setTimeout(showEnvelope, 1800);
});

/* ---------- pixel envelope (drawn from tiny grids, no images) ---------- */
const W = 21, H = 13, TIP = 8;
const OUT = "#7a3b4a", BACK = "#f4a89a", FRONT = "#ffd0c4", FLAP = "#ffe0d6", LINING = "#e8877f", SEAL = "#e63b5a", SEAL_HI = "#ff8fa3";
const edge = (x) => Math.round(Math.min(x, W - 1 - x) * (0.62 * H) / (W / 2));   // where the flap's V edge sits
const HEART = [".XX.XX.", "XHXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];

function shadow(cells) {
  return cells.map(([x, y, c]) => `calc(var(--px) * ${x}) calc(var(--px) * ${y}) 0 0 ${c}`).join(",");
}
function art(sel, cells) { document.querySelector(sel).style.boxShadow = shadow(cells); }

const back = [], front = [], flapOut = [], flapIn = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
  back.push([x, y, border ? OUT : BACK]);
  if (y >= edge(x)) front.push([x, y, (y === edge(x) || border) ? OUT : FRONT]);
  if (y <= edge(x)) {
    const line = y === edge(x) || y === 0 || (x === 0 || x === W - 1);
    flapOut.push([x, y, line ? OUT : FLAP]);
    flapIn.push([x, y, line ? OUT : LINING]);
  }
}
HEART.forEach((row, j) => [...row].forEach((ch, i) => {
  if (ch !== ".") flapOut.push([7 + i, TIP - 4 + j, ch === "H" ? SEAL_HI : SEAL]);
}));
art(".env-back", back); art(".env-front", front); art(".flap-out", flapOut); art(".flap-in", flapIn);

/* ---------- open the envelope, then read the letter ---------- */
const env = $("envelope");
function showEnvelope() {
  $("cake-page").classList.remove("active");
  $("letter-page").classList.add("active");
}
let opened = false;
function openEnvelope() {
  if (opened) return;
  opened = true;
  env.classList.add("open");
  $("tap-hint").style.visibility = "hidden";
  setTimeout(showLetter, 1700);
}
env.addEventListener("click", openEnvelope);
env.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openEnvelope(); });

function showLetter() {
  $("overlay").classList.add("show");
  startConfetti();
  const out = $("letter-text");
  let i = 0;
  (function type() {                       // typewriter
    out.textContent = WISH.slice(0, ++i);
    if (i < WISH.length) setTimeout(type, 35);
  })();
}

/* ---------- confetti ---------- */
const cv = $("confetti"), cx = cv.getContext("2d");
function startConfetti() {
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ["#ff9d3d", "#ff5f8f", "#ffffff", "#ffd9c2", "#ff7c8bff", "#ffb3c1", "#dd86ffff", "#4568a9ff", "#9ff18bff", "#f09b8cff"];
  const bits = Array.from({ length: 110 }, () => ({
    x: Math.random() * cv.width, y: -Math.random() * cv.height, s: 5 + Math.random() * 6,
    v: 1.5 + Math.random() * 2.5, d: (Math.random() - 0.5) * 1.4, c: cols[(Math.random() * cols.length) | 0],
  }));
  (function frame() {
    cx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    for (const b of bits) {
      b.y += b.v; b.x += b.d;
      if (b.y < cv.height + 20) alive = true;
      cx.fillStyle = b.c; cx.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s);   // square = pixel confetti
    }
    if (alive) requestAnimationFrame(frame);
  })();
}