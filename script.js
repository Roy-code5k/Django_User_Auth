// Samurai-style interactive particle streaks (dark theme)
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

const isSmall = () => window.innerWidth < 768;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const getDPR = () => Math.min(window.devicePixelRatio || 1, isSmall() ? 1.25 : 1.75);
let dpr = getDPR();
let paused = false;

const mouse = { x: 0, y: 0, active: false };

function resize() {
    dpr = getDPR();
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize, { passive: true });
resize();

// Config
const BASE_COUNT = 220;
const COUNT = prefersReduced ? (isSmall() ? 60 : 90) : (isSmall() ? 120 : BASE_COUNT);
const CLICK_BURST = isSmall() ? 18 : 28;
const BG_FADE = prefersReduced ? 0.10 : 0.06; // trail persistence

// Particles
const particles = [];
class Particle {
    constructor(x, y, speed = 1) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.x = x ?? Math.random() * w;
        this.y = y ?? Math.random() * h;
        const angle = Math.random() * Math.PI * 2;
        const v = (Math.random() * 0.8 + 0.6) * speed;
        this.vx = Math.cos(angle) * v;
        this.vy = Math.sin(angle) * v;
        this.prevX = this.x;
        this.prevY = this.y;
        this.life = 0;
        this.maxLife = 600 + Math.random() * 600;
        this.hue = 185 + Math.random() * 25; // dark teal/blue family
        this.alpha = 0.12 + Math.random() * 0.12;
        this.len = 6 + Math.random() * 18; // stroke length perception
    }

    update() {
        this.prevX = this.x;
        this.prevY = this.y;

        // Cursor influence: swirl + pull
        if (mouse.active) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const dist = Math.hypot(dx, dy) + 0.0001;
            const pull = prefersReduced ? 0.02 : 0.045; // attraction
            const swirl = prefersReduced ? 0.05 : 0.12; // perpendicular swirl
            // tangential vector
            const tx = -dy / dist;
            const ty = dx / dist;
            this.vx += (dx / dist) * pull + tx * swirl;
            this.vy += (dy / dist) * pull + ty * swirl;
        }

        // Damping
        const damping = prefersReduced ? 0.985 : 0.992;
        this.vx *= damping;
        this.vy *= damping;

        // Cap speed
        const maxSpeed = prefersReduced ? 2.2 : 3.3;
        const s = Math.hypot(this.vx, this.vy);
        if (s > maxSpeed) {
            this.vx = (this.vx / s) * maxSpeed;
            this.vy = (this.vy / s) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Wrap edges with slight re-entry offset
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (this.x < -10) this.x = w + 10, this.prevX = this.x;
        if (this.x > w + 10) this.x = -10, this.prevX = this.x;
        if (this.y < -10) this.y = h + 10, this.prevY = this.y;
        if (this.y > h + 10) this.y = -10, this.prevY = this.y;

        // Aging
        this.life++;
        if (this.life > this.maxLife) this.respawn();
    }

    respawn() {
        const w = window.innerWidth, h = window.innerHeight;
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.prevX = this.x;
        this.prevY = this.y;
        this.life = 0;
    }

    draw() {
        ctx.strokeStyle = `hsla(${this.hue}, 90%, 65%, ${this.alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // draw a short streak in direction of motion
        const vx = this.x - this.prevX;
        const vy = this.y - this.prevY;
        const mag = Math.hypot(vx, vy) || 0.0001;
        const lx = (vx / mag) * this.len;
        const ly = (vy / mag) * this.len;
        ctx.moveTo(this.prevX - lx * 0.2, this.prevY - ly * 0.2);
        ctx.lineTo(this.x + lx * 0.8, this.y + ly * 0.8);
        ctx.stroke();
    }
}

// Init
for (let i = 0; i < COUNT; i++) particles.push(new Particle());

// Animation loop with trail fading
function animate() {
    if (paused) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = `rgba(2, 17, 20, ${BG_FADE})`;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(animate);
}

// Prime background
ctx.fillStyle = '#021114';
ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
requestAnimationFrame(animate);

// Input
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
}, { passive: true });
window.addEventListener('mouseleave', () => { mouse.active = false; }, { passive: true });
window.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; if (!t) return;
    mouse.x = t.clientX; mouse.y = t.clientY; mouse.active = true;
    // tap burst
    burst(mouse.x, mouse.y);
}, { passive: true });
window.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; if (!t) return;
    mouse.x = t.clientX; mouse.y = t.clientY;
}, { passive: true });
window.addEventListener('touchend', () => { mouse.active = false; }, { passive: true });
window.addEventListener('click', (e) => {
    burst(e.clientX, e.clientY);
}, { passive: true });

function burst(x, y) {
    for (let i = 0; i < CLICK_BURST; i++) {
        particles.push(new Particle(x, y, 3.2));
    }
    // keep cap
    if (particles.length > COUNT + 200) particles.splice(0, particles.length - (COUNT + 200));
}

// Reduced motion + tab visibility
document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused) requestAnimationFrame(animate);
});