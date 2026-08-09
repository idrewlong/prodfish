const SIZE = 1024;

function canvas() {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  return c;
}

function grain(ctx, alpha) {
  // cheap film grain: scattered translucent pixels
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 14000; i++) {
    const v = Math.random() * 255;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1);
  }
  ctx.restore();
}

// ---------- EXTERIOR: pale church, dark woods, man in the grass ----------
export function makeExterior() {
  const color = canvas();
  const ctx = color.getContext('2d');

  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, SIZE);
  sky.addColorStop(0, '#04060a');
  sky.addColorStop(0.55, '#0a0d12');
  sky.addColorStop(1, '#10130f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // tree masses left/right
  ctx.fillStyle = '#070a06';
  for (const [cx, w] of [[80, 340], [944, 340], [200, 240], [860, 260]]) {
    ctx.beginPath();
    ctx.ellipse(cx, 330, w / 2, 330, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // church: flash-lit pale facade
  const churchX = SIZE / 2;
  ctx.fillStyle = '#b9b2a2';
  ctx.fillRect(churchX - 150, 400, 300, 320);            // body
  ctx.beginPath();                                        // gable
  ctx.moveTo(churchX - 170, 400);
  ctx.lineTo(churchX, 260);
  ctx.lineTo(churchX + 170, 400);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c4bdae';
  ctx.fillRect(churchX + 90, 250, 90, 470);              // tower
  ctx.beginPath();                                        // steeple
  ctx.moveTo(churchX + 80, 250);
  ctx.lineTo(churchX + 135, 150);
  ctx.lineTo(churchX + 190, 250);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3a352c';                            // cross on tower
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(churchX + 135, 300);
  ctx.lineTo(churchX + 135, 360);
  ctx.moveTo(churchX + 115, 320);
  ctx.lineTo(churchX + 155, 320);
  ctx.stroke();

  // dark door (the destination)
  ctx.fillStyle = '#141210';
  ctx.beginPath();
  ctx.moveTo(churchX - 40, 720);
  ctx.lineTo(churchX - 40, 590);
  ctx.quadraticCurveTo(churchX, 545, churchX + 40, 590);
  ctx.lineTo(churchX + 40, 720);
  ctx.closePath();
  ctx.fill();

  // window slits
  ctx.fillStyle = '#241f19';
  ctx.fillRect(churchX - 110, 480, 30, 90);
  ctx.fillRect(churchX + 80, 480, 30, 90);

  // grass field
  const grass = ctx.createLinearGradient(0, 700, 0, SIZE);
  grass.addColorStop(0, '#131a0d');
  grass.addColorStop(1, '#2a3618');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 700, SIZE, SIZE - 700);
  ctx.strokeStyle = 'rgba(70, 90, 40, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * SIZE;
    const y = 700 + Math.random() * (SIZE - 700);
    const h = 8 + Math.random() * 26 * ((y - 660) / (SIZE - 660));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() * 8 - 4), y - h);
    ctx.stroke();
  }

  // the man: small dark silhouette in the grass
  ctx.fillStyle = '#0b0a09';
  ctx.beginPath();
  ctx.ellipse(churchX, 764, 5, 6, 0, 0, Math.PI * 2);     // head
  ctx.fill();
  ctx.fillRect(churchX - 9, 770, 18, 46);                 // coat
  ctx.fillRect(churchX - 7, 816, 5, 26);                  // legs
  ctx.fillRect(churchX + 2, 816, 5, 26);

  grain(ctx, 0.05);

  // depth map: white = near
  const depth = canvas();
  const dctx = depth.getContext('2d');
  const dg = dctx.createLinearGradient(0, 0, 0, SIZE);
  dg.addColorStop(0, '#000');    // sky: far
  dg.addColorStop(0.68, '#1a1a1a');
  dg.addColorStop(0.72, '#555'); // grass starts
  dg.addColorStop(1, '#fff');    // foreground grass: near
  dctx.fillStyle = dg;
  dctx.fillRect(0, 0, SIZE, SIZE);
  dctx.fillStyle = '#333';       // church slab sits mid-depth
  dctx.fillRect(churchX - 190, 150, 380, 570);
  dctx.fillStyle = '#777';       // the man is nearer than the church
  dctx.fillRect(churchX - 12, 755, 24, 90);

  return { color, depth };
}

// ---------- THRESHOLD: door closeup, red light leaking ----------
export function makeThreshold() {
  const color = canvas();
  const ctx = color.getContext('2d');

  ctx.fillStyle = '#0c0b09';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // weathered boards
  ctx.strokeStyle = 'rgba(160, 150, 130, 0.16)';
  ctx.lineWidth = 3;
  for (let y = 0; y < SIZE; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 6);
    ctx.lineTo(SIZE, y + Math.random() * 6);
    ctx.stroke();
  }

  // pale doorframe
  ctx.fillStyle = '#8d8677';
  ctx.fillRect(300, 140, 60, 750);
  ctx.fillRect(664, 140, 60, 750);
  ctx.beginPath();
  ctx.moveTo(300, 170);
  ctx.quadraticCurveTo(512, 20, 724, 170);
  ctx.lineTo(724, 240);
  ctx.quadraticCurveTo(512, 100, 300, 240);
  ctx.closePath();
  ctx.fill();

  // door, ajar with red slit
  ctx.fillStyle = '#17130f';
  ctx.fillRect(360, 190, 304, 700);
  const slit = ctx.createLinearGradient(596, 0, 664, 0);
  slit.addColorStop(0, 'rgba(120, 8, 4, 0)');
  slit.addColorStop(1, '#c1170f');
  ctx.fillStyle = slit;
  ctx.fillRect(596, 200, 68, 690);
  ctx.save();                                   // red bloom
  ctx.filter = 'blur(40px)';
  ctx.fillStyle = 'rgba(193, 23, 15, 0.5)';
  ctx.fillRect(600, 180, 120, 720);
  ctx.restore();

  grain(ctx, 0.06);

  const depth = canvas();
  const dctx = depth.getContext('2d');
  dctx.fillStyle = '#222';                      // wall
  dctx.fillRect(0, 0, SIZE, SIZE);
  dctx.fillStyle = '#888';                      // frame near
  dctx.fillRect(300, 140, 60, 750);
  dctx.fillRect(664, 140, 60, 750);
  dctx.fillStyle = '#000';                      // doorway recess: far
  dctx.fillRect(360, 190, 304, 700);

  return { color, depth };
}

// ---------- INTERIOR: red chapel, neon cross, pews ----------
export function makeInterior() {
  const color = canvas();
  const ctx = color.getContext('2d');

  // deep red room
  const room = ctx.createRadialGradient(512, 430, 60, 512, 520, 780);
  room.addColorStop(0, '#4a0703');
  room.addColorStop(0.5, '#2b0402');
  room.addColorStop(1, '#0d0100');
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // altar wall panel
  ctx.fillStyle = 'rgba(90, 10, 6, 0.55)';
  ctx.fillRect(312, 190, 400, 470);

  // neon cross
  ctx.save();
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = 60;
  ctx.fillStyle = '#ffd9a8';
  ctx.fillRect(497, 260, 30, 240);
  ctx.fillRect(432, 322, 160, 30);
  ctx.restore();
  ctx.save();
  ctx.filter = 'blur(60px)';
  ctx.fillStyle = 'rgba(255, 42, 26, 0.35)';
  ctx.fillRect(380, 220, 260, 320);
  ctx.restore();

  // altar platform + steps
  ctx.fillStyle = '#320503';
  ctx.fillRect(240, 640, 544, 60);
  ctx.fillStyle = '#200302';
  ctx.fillRect(200, 700, 624, 40);

  // pew silhouettes, perspective-larger toward viewer
  ctx.fillStyle = '#0a0100';
  for (let i = 0; i < 4; i++) {
    const y = 760 + i * 66;
    const inset = 60 - i * 20;
    ctx.fillRect(inset, y, 380 - inset, 40 + i * 6);
    ctx.fillRect(SIZE - 380, y, 380 - inset, 40 + i * 6);
  }

  grain(ctx, 0.07);

  const depth = canvas();
  const dctx = depth.getContext('2d');
  const dg = dctx.createLinearGradient(0, 0, 0, SIZE);
  dg.addColorStop(0, '#111');   // ceiling/wall far
  dg.addColorStop(0.62, '#222');
  dg.addColorStop(1, '#eee');   // floor/pews near
  dctx.fillStyle = dg;
  dctx.fillRect(0, 0, SIZE, SIZE);
  dctx.fillStyle = '#444';      // cross slightly proud of the wall
  dctx.fillRect(432, 260, 160, 240);

  return { color, depth };
}
