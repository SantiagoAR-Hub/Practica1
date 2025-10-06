/* ================= Ratón ================= */
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

/* ============== Canvas (HiDPI) ============== */
const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

function resize() {
  canvas.width  = Math.floor(innerWidth  * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width  = innerWidth  + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

/* ============== Utilidades ============== */
const TAU = Math.PI * 2;
// --- Comida tipo Snake (ADD) ---
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

class Food {
  constructor() {
    const margin = 32;
    this.x = rand(margin, innerWidth - margin);
    this.y = rand(margin, innerHeight - margin);
    this.r = rand(6, 10);
    this.hue = randInt(0, 360);
  }
  draw() {
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.2);
    g.addColorStop(0, `hsla(${this.hue},100%,60%,1)`);
    g.addColorStop(1, `hsla(${this.hue},100%,55%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 2.2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `hsl(${this.hue},95%,55%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fill();
  }
}

const foods = [];
const MAX_FOODS = 4;
function spawnFood() { foods.push(new Food()); }
function ensureFoods() { while (foods.length < MAX_FOODS) spawnFood(); }

const lerp = (a, b, t) => a + (b - a) * t;

function drawCapsule(x, y, length, radius, angle, fillStyle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = length, r = radius;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5 + r, -r);
  ctx.lineTo(w * 0.5 - r, -r);
  ctx.arc(w * 0.5 - r, 0, r, -Math.PI/2, Math.PI/2);
  ctx.lineTo(-w * 0.5 + r, r);
  ctx.arc(-w * 0.5 + r, 0, r, Math.PI/2, -Math.PI/2);
  ctx.closePath();

  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

/* ============== Segmento ============== */
class Segment {
  constructor(parent, len, radius) {
    this.parent = parent;
    this.len = len;
    this.r = radius;
    this.x = parent ? parent.x + len : innerWidth * 0.5;
    this.y = parent ? parent.y      : innerHeight * 0.5;
    this.a = 0;
  }
  followParent() {
    if (!this.parent) return;
    const dx = this.x - this.parent.x;
    const dy = this.y - this.parent.y;
    const ang = Math.atan2(dy, dx);
    this.x = this.parent.x + Math.cos(ang) * this.len;
    this.y = this.parent.y + Math.sin(ang) * this.len;
    this.a = ang;
  }
}

/* ============== Ciempiés ============== */
class Centipede {
  constructor({
    segments = 30,
    segLen = 22,
    baseRadius = 10,
    headExtra = 10,
    hueBody = 120,
    hueLeg  = 30,
    steer = 0.16,
    maxSpeed = 7.2,
    legsEvery = 1
  } = {}) {
    this.segLen = segLen;
    this.baseR = baseRadius;
    this.headExtra = headExtra;
    this.hueBody = hueBody;
    this.hueLeg = hueLeg;
    this.steer = steer;
    this.maxSpeed = maxSpeed;
    this.legsEvery = legsEvery;

    this.parts = [];
    let parent = null;
    for (let i = 0; i < segments; i++) {
      const r = lerp(baseRadius + headExtra, baseRadius * 0.55, i / (segments - 1));
      const s = new Segment(parent, segLen, r);
      if (!parent) { s.x = innerWidth * 0.5; s.y = innerHeight * 0.5; }
      this.parts.push(s);
      parent = s;
    }
    this.vx = 0; this.vy = 0;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    const head = this.parts[0];

    const dx = mouse.x - head.x;
    const dy = mouse.y - head.y;
    const d = Math.hypot(dx, dy) || 1;
    this.vx += (dx / d) * this.steer;
    this.vy += (dy / d) * this.steer;

    const sp = Math.hypot(this.vx, this.vy) || 1;
    if (sp > this.maxSpeed) {
      this.vx = (this.vx / sp) * this.maxSpeed;
      this.vy = (this.vy / sp) * this.maxSpeed;
    }

    head.x += this.vx;
    head.y += this.vy;
    head.a = Math.atan2(this.vy, this.vx);

    for (let i = 1; i < this.parts.length; i++) this.parts[i].followParent();

    // Comer y crecer
    this.eatAndGrow();
  }

  eatAndGrow() {
    const head = this.parts[0];
    const rHead = this.baseR + this.headExtra;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      const dx = f.x - head.x;
      const dy = f.y - head.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= rHead + f.r) {
        // Comer
        foods.splice(i, 1);
        // Crecer
        const tail = this.parts[this.parts.length - 1];
        const newSeg = new Segment(tail, this.segLen, Math.max(this.baseR * 0.55, tail.r * 0.98));
        newSeg.x = tail.x; newSeg.y = tail.y; newSeg.a = tail.a;
        this.parts.push(newSeg);
        // Reponer comida
        ensureFoods();
        break;
      }
    }
  }

  draw() {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    
        // --- Dibujar comida (ADD) ---
    ensureFoods();
    for (const f of foods) f.draw();



    for (let i = this.parts.length - 1; i >= 0; i--) {
      const s = this.parts[i];
      const t = i / (this.parts.length - 1);

      const gradLen = this.segLen * 1.15;
      const g = ctx.createLinearGradient(
        s.x - Math.cos(s.a) * gradLen * 0.5,
        s.y - Math.sin(s.a) * gradLen * 0.5,
        s.x + Math.cos(s.a) * gradLen * 0.5,
        s.y + Math.sin(s.a) * gradLen * 0.5
      );
      const lum = 45 + t * 10;
      g.addColorStop(0.0, `hsl(${this.hueBody}, 60%, ${lum-8}%)`);
      g.addColorStop(0.45, `hsl(${this.hueBody}, 70%, ${lum+10}%)`);
      g.addColorStop(1.0, `hsl(${this.hueBody}, 55%, ${lum-10}%)`);

      drawCapsule(s.x, s.y, this.segLen * 1.05, s.r, s.a, g);

      // Patas
      if (i % this.legsEvery === 0) {
        const perp  = s.a + Math.PI / 2;
        const baseOff = s.r * 1.4;
        const bxL = s.x + Math.cos(perp) * baseOff;
        const byL = s.y + Math.sin(perp) * baseOff;
        const bxR = s.x - Math.cos(perp) * baseOff;
        const byR = s.y - Math.sin(perp) * baseOff;

        const phase = this.time * 7 + i * 0.5;
        const swing = 0.45 * Math.sin(phase);

        const femurLen = s.r * 3.0;
        const tibiaLen = s.r * 2.5;

        ctx.lineCap = "round";
        ctx.strokeStyle = `hsla(${this.hueLeg}, 100%, 40%, 0.95)`;
        ctx.lineWidth = Math.max(2, s.r * 0.32);

        // izquierda
        let dirL1 = s.a - Math.PI/2 + swing;
        let kx = bxL + Math.cos(dirL1) * femurLen;
        let ky = byL + Math.sin(dirL1) * femurLen;
        let dirL2 = dirL1 + 0.6;
        ctx.beginPath();
        ctx.moveTo(bxL, byL);
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx + Math.cos(dirL2) * tibiaLen, ky + Math.sin(dirL2) * tibiaLen);
        ctx.stroke();

        // derecha
        let dirR1 = s.a + Math.PI/2 - swing;
        kx = bxR + Math.cos(dirR1) * femurLen;
        ky = byR + Math.sin(dirR1) * femurLen;
        let dirR2 = dirR1 - 0.6;
        ctx.beginPath();
        ctx.moveTo(bxR, byR);
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx + Math.cos(dirR2) * tibiaLen, ky + Math.sin(dirR2) * tibiaLen);
        ctx.stroke();
      }
    }

    // Cabeza grande: ojos y antenas
    const h = this.parts[0];
    const rHead = this.baseR + this.headExtra;
    const side = rHead * 0.9;
    const leftA  = h.a + Math.PI / 2;
    const rightA = h.a - Math.PI / 2;

    const eyeR = rHead * 0.55, pupilR = eyeR * 0.45;
    let ex = h.x + Math.cos(leftA) * side,  ey = h.y + Math.sin(leftA) * side;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, TAU); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath();
    ctx.arc(ex + Math.cos(h.a) * eyeR * 0.35, ey + Math.sin(h.a) * eyeR * 0.35, pupilR, 0, TAU); ctx.fill();

    ex = h.x + Math.cos(rightA) * side; ey = h.y + Math.sin(rightA) * side;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, TAU); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath();
    ctx.arc(ex + Math.cos(h.a) * eyeR * 0.35, ey + Math.sin(h.a) * eyeR * 0.35, pupilR, 0, TAU); ctx.fill();

    // Antenas más largas
    const osc = Math.sin(performance.now() * 0.004) * 0.25;
    const antA1 = h.a + 0.35 + osc;
    const antA2 = h.a - 0.35 - osc;
    const antBase = rHead * 1.0, antLen = rHead * 3.5;

    ctx.strokeStyle = `hsla(${this.hueLeg},100%,35%,0.95)`;
    ctx.lineWidth = Math.max(1.6, rHead * 0.2);
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(h.x + Math.cos(leftA) * antBase,  h.y + Math.sin(leftA) * antBase);
    ctx.lineTo(h.x + Math.cos(antA1) * (antBase + antLen), h.y + Math.sin(antA1) * (antBase + antLen));
    ctx.moveTo(h.x + Math.cos(rightA) * antBase, h.y + Math.sin(rightA) * antBase);
    ctx.lineTo(h.x + Math.cos(antA2) * (antBase + antLen), h.y + Math.sin(antA2) * (antBase + antLen));
    ctx.stroke();
  }
}

/* ============== Instancia + bucle ============== */
const centipede = new Centipede();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  centipede.update(dt);

  centipede.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
