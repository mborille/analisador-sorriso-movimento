var fs = require('fs'); eval(fs.readFileSync('modelo.js', 'utf8') + ';global.X={IDX,POLY,landmarkMetrics,analyseMouth,fitQuad,quadAt,pickKeys,yawDeg,gumClass};');
var Q = global.X, ok = true;
function chk(n, c, d) { console.log((c ? 'OK  ' : 'FAIL') + ' ' + n + (d ? ' ' + d : '')); if (!c) ok = false; }
// rosto sintético 1000x1000: olhos em y=400 afastados 200 px (IPD 63 mm => 0,315 mm/px)
function mkLm(W, H, tilt) {
  var lm = []; for (var i = 0; i < 478; i++) lm.push([0.5, 0.5, 0]);
  function set(i, x, y, z) { lm[i] = [x / W, y / H, z || 0]; }
  set(468, 400, 400); set(473, 600, 400); set(33, 350, 400, 0); set(263, 650, 400, 0);
  // boca: cantos internos em x=420 e 580, centro y=700; abertura de 40 px
  set(78, 420, 700); set(308, 580, 700); set(13, 500, 680); set(14, 500, 720);
  set(61, 410, 700); set(291, 590, 700);
  var up = [191, 80, 81, 82, 312, 311, 310, 415], lo = [95, 88, 178, 87, 317, 402, 318, 324];
  var xs = [440, 460, 480, 490, 510, 520, 540, 560];
  up.forEach(function (id, k) { set(id, xs[k], 690 - 10 * Math.sin((xs[k] - 420) / 160 * Math.PI)); });
  xs.forEach(function (x, k) { set(lo[k], x, 710 + 10 * Math.sin((x - 420) / 160 * Math.PI)); });
  set(13, 500, 680); set(14, 500, 720);
  return lm;
}
var W = 1000, H = 1000, lm = mkLm(W, H);
var m = Q.landmarkMetrics(lm, W, H, 63);
chk('escala 0,315 mm/px', Math.abs(m.mmpp - 0.315) < 1e-9);
chk('abertura interlabial 40 px = 12,6 mm', Math.abs(m.gap - 12.6) < 0.01, m.gap.toFixed(2));
chk('largura interna 160 px = 50,4 mm', Math.abs(m.innerW - 50.4) < 0.01, m.innerW.toFixed(2));
chk('rosto de frente', m.yawOk);
// rotação de 10 graus não muda as medidas
function rotLm(lm, deg) { var a = deg * Math.PI / 180, c = [500, 500]; return lm.map(function (p) { var x = p[0] * W - c[0], y = p[1] * H - c[1]; return [(c[0] + x * Math.cos(a) - y * Math.sin(a)) / W, (c[1] + x * Math.sin(a) + y * Math.cos(a)) / H, p[2]]; }); }
var mr = Q.landmarkMetrics(rotLm(lm, 10), W, H, 63);
chk('medidas invariantes à inclinação da cabeça', Math.abs(mr.gap - m.gap) < 0.05 && Math.abs(mr.innerW - m.innerW) < 0.05, mr.gap.toFixed(2) + ' ' + mr.innerW.toFixed(2));
// guinada
var ly = mkLm(W, H); ly[33][2] = 0.1; var my = Q.landmarkMetrics(ly, W, H, 63);
chk('giro acima de 15 graus é sinalizado', !my.yawOk, my.yaw.toFixed(1));
// imagem sintética: dentes brancos no centro, boca escura, gengiva rosa no topo
var img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
for (var i = 0; i < W * H; i++) { img.data[i * 4] = 200; img.data[i * 4 + 1] = 150; img.data[i * 4 + 2] = 130; img.data[i * 4 + 3] = 255; }
function rect(x0, y0, x1, y1, r, g, b) { for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) { var o = (y * W + x) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; } }
rect(420, 670, 580, 730, 40, 10, 15);        // interior escuro
rect(460, 684, 540, 700, 220, 90, 100);      // gengiva (16 px)
rect(445, 700, 555, 712, 235, 232, 225);     // dentes superiores (12 px de altura)
rect(445, 712, 555, 714, 40, 10, 15);        // linha oclusal escura
rect(455, 714, 545, 722, 225, 222, 215);     // dentes inferiores
var a = Q.analyseMouth(img, m.pts, m.mmpp);
chk('encontra dentes', a.ok && !a.noTeeth && a.teethRatio > 0.1, a.teethRatio.toFixed(2));
chk('gengiva visível acima dos dentes (cerca de 16 px)', a.gumMm !== null && a.gumMm > 3 && a.gumMm < 7, a.gumMm && a.gumMm.toFixed(2));
chk('coroa visível medida na primeira fileira de dentes', a.displayMm !== null && a.displayMm > 3 && a.displayMm < 5, a.displayMm && a.displayMm.toFixed(2));
chk('corredor bucal positivo', a.corridorTotal > 15 && a.corridorTotal < 40, a.corridorTotal.toFixed(1));
chk('sem dentes na boca escura', Q.analyseMouth((function () { var im = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }; for (var i = 0; i < W * H; i++) { im.data[i * 4] = 30; im.data[i * 4 + 1] = 10; im.data[i * 4 + 2] = 15; im.data[i * 4 + 3] = 255; } return im; })(), m.pts, m.mmpp).noTeeth === true);
var q = Q.fitQuad([0, 1, 2, 3, 4, 5], [0, 1, 4, 9, 16, 25]);
chk('ajuste quadrático', q && Math.abs(q.a - 1) < 1e-9 && Math.abs(Q.quadAt(q, 3) - 9) < 1e-9);
chk('classe de gengiva', Q.gumClass(4).indexOf('alta') === 0 && Q.gumClass(1).indexOf('média') === 0 && Q.gumClass(0).indexOf('sem') === 0);
process.exit(ok ? 0 : 1);
