// ---------- Núcleo de análise do sorriso (landmarks do MediaPipe Face Mesh + cor dos dentes) ----------
// lm: lista de [x, y, z] normalizados (0 a 1). Índices da malha de 468 pontos (+10 da íris).
var IDX = {
  irisA: 468, irisB: 473, eyeOuterA: 33, eyeInnerA: 133, eyeOuterB: 263, eyeInnerB: 362,
  upIn: 13, loIn: 14, cornA: 78, cornB: 308, upOut: 0, loOut: 17, cornOutA: 61, cornOutB: 291, nose: 1
};
var POLY = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
var LOWER_CURVE = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
var UPPER_CURVE = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
var IPD_DEFAULT = 63;
var YAW_MAX = 15;

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function round1(x) { return Math.round(x * 10) / 10; }

// Centro de cada olho em px (usa a íris quando existe, senão a média dos cantos)
function eyeCenters(lm, W, H) {
  function P(i) { return [lm[i][0] * W, lm[i][1] * H]; }
  var a, b;
  if (lm.length > IDX.irisB) { a = P(IDX.irisA); b = P(IDX.irisB); }
  else { var o1 = P(IDX.eyeOuterA), i1 = P(IDX.eyeInnerA), o2 = P(IDX.eyeOuterB), i2 = P(IDX.eyeInnerB); a = [(o1[0] + i1[0]) / 2, (o1[1] + i1[1]) / 2]; b = [(o2[0] + i2[0]) / 2, (o2[1] + i2[1]) / 2]; }
  if (a[0] > b[0]) { var t = a; a = b; b = t; }
  return [a, b];
}
// Ângulo de rolagem da cabeça: linha entre os olhos
function rollAngle(lm, W, H) { var e = eyeCenters(lm, W, H); return Math.atan2(e[1][1] - e[0][1], e[1][0] - e[0][0]); }
// Guinada (giro lateral) estimada pela profundidade dos cantos externos dos olhos
function yawDeg(lm) {
  var a = lm[IDX.eyeOuterA], b = lm[IDX.eyeOuterB];
  var dx = Math.abs(b[0] - a[0]), dz = a[2] - b[2];
  if (a[0] > b[0]) dz = -dz;
  return Math.atan2(dz, Math.max(dx, 1e-6)) * 180 / Math.PI;
}
// Pontos em px, no referencial do quadro nivelado (olhos na horizontal), em torno do ponto médio dos olhos
function levelPoints(lm, W, H) {
  var e = eyeCenters(lm, W, H), th = Math.atan2(e[1][1] - e[0][1], e[1][0] - e[0][0]);
  var c = [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2], cs = Math.cos(-th), sn = Math.sin(-th);
  var pts = lm.map(function (p) { var x = p[0] * W - c[0], y = p[1] * H - c[1]; return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]; });
  var eL = e.map(function (p) { var x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]; });
  return { pts: pts, theta: th, center: c, ipdPx: dist(eL[0], eL[1]) };
}
function landmarkMetrics(lm, W, H, ipdMm) {
  var L = levelPoints(lm, W, H), p = L.pts, mmpp = (ipdMm || IPD_DEFAULT) / L.ipdPx;
  var yaw = yawDeg(lm);
  var gap = Math.abs(p[IDX.loIn][1] - p[IDX.upIn][1]) * mmpp;
  var innerW = dist(p[IDX.cornA], p[IDX.cornB]) * mmpp;
  var outerW = dist(p[IDX.cornOutA], p[IDX.cornOutB]) * mmpp;
  return { theta: L.theta, center: L.center, pts: p, ipdPx: L.ipdPx, mmpp: mmpp, yaw: yaw, yawOk: Math.abs(yaw) <= YAW_MAX,
    gap: gap, innerW: innerW, outerW: outerW, smileIndex: gap > 0.3 ? innerW / gap : null };
}

function pointInPoly(x, y, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
// Ajuste quadrático y = a x^2 + b x + c por mínimos quadrados (centrado em x0 para estabilidade)
function fitQuad(xs, ys) {
  var n = xs.length; if (n < 4) return null;
  var x0 = xs.reduce(function (s, v) { return s + v; }, 0) / n;
  var S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  for (var i = 0; i < n; i++) { var x = xs[i] - x0, y = ys[i]; var xp = 1; for (var k = 0; k < 5; k++) { S[k] += xp; xp *= x; } T[0] += y; T[1] += y * x; T[2] += y * x * x; }
  var M = [[S[0], S[1], S[2], T[0]], [S[1], S[2], S[3], T[1]], [S[2], S[3], S[4], T[2]]];
  for (var c = 0; c < 3; c++) {
    var piv = c; for (var r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    var tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (var r2 = 0; r2 < 3; r2++) if (r2 !== c) { var f = M[r2][c] / M[c][c]; for (var k2 = c; k2 < 4; k2++) M[r2][k2] -= f * M[c][k2]; }
  }
  return { a: M[2][3] / M[2][2], b: M[1][3] / M[1][1], c: M[0][3] / M[0][0], x0: x0 };
}
function quadAt(q, x) { var u = x - q.x0; return q.a * u * u + q.b * u + q.c; }

// Análise do interior da boca no quadro nivelado. img = { data, width, height } (RGBA).
function analyseMouth(img, pts, mmpp) {
  var poly = POLY.map(function (i) { return pts[i]; });
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  poly.forEach(function (p) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
  var x0 = Math.max(0, Math.floor(minX) - 1), x1 = Math.min(img.width - 1, Math.ceil(maxX) + 1);
  var y0 = Math.max(0, Math.floor(minY) - 1), y1 = Math.min(img.height - 1, Math.ceil(maxY) + 1);
  var w = x1 - x0 + 1, h = y1 - y0 + 1;
  var res = { roi: { x: x0, y: y0, w: w, h: h }, ok: false };
  if (w < 12 || h < 3) { res.reason = 'boca pequena demais'; res.teethRatio = 0; return res; }
  var inside = new Uint8Array(w * h), teeth = new Uint8Array(w * h), gum = new Uint8Array(w * h);
  var n = 0;
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (pointInPoly(x0 + x + 0.5, y0 + y + 0.5, poly)) { inside[y * w + x] = 1; n++; }
  // erosão de 1 px para tirar a borda do lábio
  var core = new Uint8Array(w * h);
  for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { var k = y * w + x; if (inside[k] && inside[k - 1] && inside[k + 1] && inside[k - w] && inside[k + w]) core[k] = 1; }
  var cn = 0, vsum = 0;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    var kk = y * w + x; if (!core[kk]) continue;
    var o = ((y0 + y) * img.width + (x0 + x)) * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), V = mx / 255, S = mx ? (mx - mn) / mx : 0, rg = (r - g) / Math.max(r, 1);
    cn++; vsum += V;
    if (V > 0.32 && S < 0.35 && rg < 0.2) teeth[kk] = 1;
    else if (V > 0.3 && rg >= 0.28 && S > 0.25) gum[kk] = 1;
  }
  res.meanV = cn ? vsum / cn : 0;
  // limpeza: maioria 3x3
  var t2 = new Uint8Array(w * h);
  for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
    var s = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) s += teeth[(y + dy) * w + x + dx];
    t2[y * w + x] = (s >= 5 && core[y * w + x]) ? 1 : 0;
  }
  teeth = t2;
  var tcount = 0; for (var i2 = 0; i2 < teeth.length; i2++) tcount += teeth[i2];
  res.teethRatio = cn ? tcount / cn : 0;
  res.teeth = teeth; res.gum = gum; res.inside = inside; res.core = core;
  res.ok = true;
  if (tcount < 12) { res.noTeeth = true; return res; }
  // extensão lateral dos dentes e corredor bucal
  var tMinX = Infinity, tMaxX = -Infinity;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (teeth[y * w + x]) { if (x < tMinX) tMinX = x; if (x > tMaxX) tMaxX = x; }
  var cA = pts[IDX.cornA][0] - x0, cB = pts[IDX.cornB][0] - x0, mw = cB - cA;
  res.teethWidthMm = (tMaxX - tMinX + 1) * mmpp;
  res.corridorLeft = Math.max(0, (tMinX - cA) / mw) * 100;
  res.corridorRight = Math.max(0, (cB - tMaxX) / mw) * 100;
  res.corridorTotal = Math.max(0, 1 - (tMaxX - tMinX + 1) / mw) * 100;
  // varredura por colunas: primeira sequência de dentes (coroa superior), borda incisal e gengiva acima dos dentes
  var cx = (cA + cB) / 2, band = Math.max(2, mw * 0.12);
  var edges = [], edgeX = [], gumH = [], dispH = [], merged = 0, cols = 0;
  var upY = function (xx) { for (var yy = 0; yy < h; yy++) if (inside[yy * w + xx]) return yy; return -1; };
  var loY = function (xx) { for (var yy = h - 1; yy >= 0; yy--) if (inside[yy * w + xx]) return yy; return -1; };
  for (x = Math.max(1, tMinX); x <= Math.min(w - 2, tMaxX); x++) {
    var u = upY(x), l = loY(x); if (u < 0) continue;
    var yt = -1; for (y = u; y <= l; y++) if (teeth[y * w + x]) { yt = y; break; }
    if (yt < 0) continue;
    var ye = yt, gapRun = 0;
    for (y = yt; y <= l; y++) { if (teeth[y * w + x]) { ye = y; gapRun = 0; } else { gapRun++; if (gapRun > 1) break; } }
    var isMerged = ye >= l - 2;
    cols++; if (isMerged) merged++;
    if (!isMerged) { edges.push(ye); edgeX.push(x); }
    var inBand = Math.abs(x - cx) <= band;
    if (inBand) {
      var gc = 0, tot = 0; for (y = u; y < yt; y++) { tot++; if (gum[y * w + x]) gc++; }
      gumH.push(tot > 0 && gc / tot > 0.5 ? (yt - u) : 0);
      if (!isMerged) dispH.push(ye - yt + 1);
    }
  }
  var g1 = median(gumH); res.gumMm = g1 === null ? null : g1 * mmpp;
  var d1 = median(dispH); res.displayMm = d1 === null ? null : d1 * mmpp;
  res.mergedFrac = cols ? merged / cols : 1;
  // arco do sorriso: curva incisal contra a curva do lábio inferior
  if (edges.length >= 8 && res.mergedFrac < 0.4) {
    var qe = fitQuad(edgeX, edges), span = tMaxX - tMinX;
    var lx = [], ly = []; LOWER_CURVE.forEach(function (i) { lx.push(pts[i][0] - x0); ly.push(pts[i][1] - y0); });
    var ql = fitQuad(lx, ly);
    if (qe && ql) {
      var xa = tMinX + span * 0.1, xb = tMaxX - span * 0.1, xm = (tMinX + tMaxX) / 2;
      var sagE = (quadAt(qe, xm) - (quadAt(qe, xa) + quadAt(qe, xb)) / 2) * mmpp;
      var la = pts[IDX.cornA][0] - x0, lb = pts[IDX.cornB][0] - x0, lm_ = (la + lb) / 2;
      var sagL = (quadAt(ql, lm_) - (quadAt(ql, la + (lb - la) * 0.1) + quadAt(ql, lb - (lb - la) * 0.1)) / 2) * mmpp;
      res.arc = { sagEdge: sagE, sagLip: sagL, qe: qe, ql: ql, xa: xa, xb: xb, la: la + (lb - la) * 0.1, lb: lb - (lb - la) * 0.1 };
      var ratio = sagL > 0.2 ? sagE / sagL : null;
      res.arc.ratio = ratio;
      if (sagE < -0.25) res.arc.type = 'reversa';
      else if (sagE <= 0.25) res.arc.type = 'reta';
      else if (ratio !== null && ratio >= 0.6 && ratio <= 1.5) res.arc.type = 'consonante';
      else res.arc.type = 'curva diferente da do lábio';
    }
  } else res.arcNote = 'dentes inferiores em contato ou sem linha de separação visível';
  return res;
}
function gumClass(mm) {
  if (mm === null || mm === undefined) return null;
  if (mm >= 3) return 'alta (gengiva visível acima de 3 mm)';
  if (mm > 0.5) return 'média (gengiva visível até 3 mm)';
  return 'sem gengiva visível no centro';
}
// Escolha automática dos quadros: repouso = menor largura da boca, sorriso = maior, entre quadros com rosto de frente
function pickKeys(samples) {
  var ok = samples.filter(function (s) { return s.m && s.m.yawOk; });
  if (ok.length < 2) return { rest: null, smile: null };
  var rest = ok[0], smile = ok[0];
  ok.forEach(function (s) { if (s.m.innerW + s.m.gap * 0.5 < rest.m.innerW + rest.m.gap * 0.5) rest = s; if (s.m.innerW > smile.m.innerW) smile = s; });
  return { rest: rest, smile: smile };
}
