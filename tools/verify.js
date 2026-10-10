/**
 * تحقق مستقل من قاعدة الجذور وإحصاءات النص.
 * يعيد حساب الأعداد من الملف الأصلي مباشرة ويقارنها بما يعرضه الموقع.
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const MORPH = process.env.MORPH || path.join(__dirname, 'source', 'quranic-corpus-morphology-0.4.txt');
const Q = JSON.parse(fs.readFileSync(path.join(R, 'public', 'data', 'quran-uthmani.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(R, 'public', 'data', 'roots.json'), 'utf8'));
const IDX = JSON.parse(fs.readFileSync(path.join(R, 'public', 'data', 'roots-index.json'), 'utf8'));

let fail = 0;
function ok(cond, msg) { console.log((cond ? '  OK   ' : '  FAIL ') + msg); if (!cond) fail++; }

// ===== 1) إعادة حساب من الملف الأصلي =====
const recount = new Map();   // root -> Set("s:a:w")
const stemNoRoot = new Set(), stems = new Set(), segs = new Set();
for (const ln of fs.readFileSync(MORPH, 'utf8').split(/\r?\n/)) {
  if (!ln || ln.charCodeAt(0) === 35) continue;
  const p = ln.split('\t'); if (p.length < 4) continue;
  const m = /^\((\d+):(\d+):(\d+):(\d+)\)$/.exec(p[0]); if (!m) continue;
  const s = +m[1], a = +m[2], w = +m[3], i = +m[4];
  segs.add(s + ':' + a + ':' + w + ':' + i);
  if (p[3].indexOf('STEM|') !== 0) continue;
  const sk = s + ':' + a + ':' + w + ':' + i;
  stems.add(sk);
  const rm = /\|ROOT:([^|]+)/.exec(p[3]);
  if (!rm) { stemNoRoot.add(sk); continue; }
  const key = rm[1] + '#' + s + ':' + a + ':' + w;
  if (!recount.has(rm[1])) recount.set(rm[1], new Set());
  recount.get(rm[1]).add(s + ':' + a + ':' + w);
}
let recTotal = 0;
recount.forEach(v => recTotal += v.size);
console.log('--- إعادة حساب من الملف الأصلي ---');
ok(recTotal === D.counts.occurrences, 'occurrences: ' + D.counts.occurrences + ' == ' + recTotal);
ok(recount.size === D.counts.roots, 'roots: ' + D.counts.roots + ' == ' + recount.size);
ok(stems.size === D.counts.stems, 'stems: ' + D.counts.stems + ' == ' + stems.size);
ok(stemNoRoot.size === D.counts.stemsNoRoot, 'stemsNoRoot: ' + D.counts.stemsNoRoot + ' == ' + stemNoRoot.size);
ok(segs.size === D.counts.segments, 'segments: ' + D.counts.segments + ' == ' + segs.size);

// ===== 2) مطابقة كل جذر في القاعدة مع إعادة الحساب =====
let rootMismatch = 0, occBad = 0, spanBad = 0;
const sampleTokens = [];
function coreFromSite(tok) {
  let s = tok.replace(/\u0670/g, 'ا');
  s = s.replace(/[\u064B-\u0655\u06D6-\u06ED\u0640\u0610-\u061A\u200D\u200C]/g, '').replace(/\u0651/g, '');
  s = s.replace(/[\u0622\u0623\u0625\u0627\u0671\u0621\u0624\u0626]/g, '');
  s = s.replace(/\u0649/g, '\u064A').replace(/\u0629/g, '\u0647');
  return s.replace(/[^\u0621-\u063A\u0641-\u064A]/g, '');
}
for (const rk of Object.keys(D.roots)) {
  const seen = new Set();
  let total = 0;
  for (const fo of D.roots[rk]) for (const oc of fo.o) {
    total++;
    const k = oc[0] + ':' + oc[1] + ':' + (oc[4] & 8 ? -1 : oc[2]);  //حتياطي
    const lk = oc[0] + ':' + oc[1] + ':' + oc[2];
    seen.add(lk);
    const su = Q.surahs[oc[0] - 1];
    if (!su || !su.verses[oc[1] - 1]) { occBad++; continue; }
    const toks = su.verses[oc[1] - 1].split(/\s+/).filter(t => /[\u0621-\u064A]/.test(t));
    if (oc[2] < 0 || oc[2] >= toks.length || oc[3] < oc[2] || oc[3] >= toks.length) { spanBad++; continue; }
    if (sampleTokens.length < 12 && (rk === 'Elm' || rk === 'rHm')) {
      sampleTokens.push(rk + ' @' + oc[0] + ':' + oc[1] + ' [' + toks.slice(oc[2], oc[3] + 1).join(' ') + ']');
    }
  }
  const r = recount.get(rk);
  if (!r || r.size !== total || seen.size !== total) rootMismatch++;
}
console.log('--- مطابقة الجذور ---');
ok(rootMismatch === 0, 'كل الجذور (' + D.counts.roots + ') تطابق إعادة الحساب (مختلف=' + rootMismatch + ')');
ok(occBad === 0, 'كل المواضع داخل نطاق الآيات (خارج=' + occBad + ')');
ok(spanBad === 0, 'كل مواضع الكلمات صالحة (خارج=' + spanBad + ')');
console.log('  عينة مواضع:', sampleTokens.slice(0, 6).join(' | '));

// ===== 3) الفهرس =====
console.log('--- الفهرس ---');
ok(IDX.list.length === D.counts.roots, 'عدد عناصر الفهرس = ' + IDX.list.length);
ok(IDX.list.reduce((s, x) => s + x.t, 0) === D.counts.occurrences, 'مجموع أعداد الفهرس = ' + D.counts.occurrences);
ok(Object.keys(D.ar).length === D.counts.roots, 'خريطة الحروف العربية كاملة');
ok(D.notice.indexOf('DO NOT REMOVE') >= 0, 'بيان الحقوق محفوظ في القاعدة');

// ===== 4) إحصاء النص: كلمات وحروف (بنفس منطق الواجهة) =====
function toks(v) { return v.split(/\s+/).filter(t => /[\u0621-\u064A]/.test(t)); }
// نفس دالة norm() في الموقع حرفيًا
function norm2(s) {
  s = String(s).replace(/\u0670/g, '\u0627');
  return s.replace(/[\u064B-\u0655\u065F\u0640\u0610-\u061A\u06D6-\u06ED\u200D\u200C]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627').replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A').replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A')
    .replace(/\s+/g, ' ').trim();
}
let ayat = 0, words = 0, letters = 0, rawTokens = 0, uniq = new Set(), surahWords = 0;
const perSurah = [];
Q.surahs.forEach((su, si) => {
  let wN = 0, lN = 0, aN = su.verses.length;
  su.verses.forEach(v => {
    ayat++;
    rawTokens += v.split(/\s+/).filter(Boolean).length;
    const t = toks(v);
    words += t.length; wN += t.length;
    for (const x of t) uniq.add(norm2(x));
    for (const ch of v) if (/[\u0621-\u064A]/.test(ch)) { letters++; lN++; }
  });
  perSurah.push({ s: si + 1, a: aN, w: wN, l: lN });
});
console.log('--- إحصاء النص (Tanzil Uthmani بالموقع) ---');
ok(Q.surahs.length === 114, 'السور = 114');
ok(ayat === 6236, 'الآيات = ' + ayat);
ok(perSurah.reduce((s, x) => s + x.a, 0) === ayat, 'مجموع آيات السور = الآيات');
ok(perSurah.reduce((s, x) => s + x.w, 0) === words, 'مجموع كلمات السور = الكلمات (' + words + ')');
ok(perSurah.reduce((s, x) => s + x.l, 0) === letters, 'مجموع حروف السور = الحروف (' + letters + ')');
console.log('  raw tokens (بما فيها علامات الوقف المستقلة): ' + rawTokens);
console.log('  كلمات (تحتوي حرفًا عربيًا): ' + words + ' — فرق = ' + (rawTokens - words));
console.log('  كلمات مفردة بعد التوحيد: ' + uniq.size + ' — حروف: ' + letters);

// ===== 5) اختبار البحث عن كلمات =====
console.log('--- اختبار بحث الكلمات (عدد الآيات / عدد المرات) ---');
function countWord(q, exact) {
  const nq = norm2(q); let aya = 0, times = 0;
  for (const su of Q.surahs) for (const v of su.verses) {
    let hit = false;
    for (const t of toks(v)) {
      if (exact ? norm2(t) === nq : t.indexOf(q) >= 0 || norm2(t).indexOf(nq) >= 0) { times++; hit = true; }
    }
    if (hit) aya++;
  }
  return { aya, times };
}
for (const w of ['الله', 'الرحمن', 'يَعْلَمُ', 'قُلْ', 'الكتاب']) {
  const e = countWord(w, true), s = countWord(w, false);
  console.log('  ' + w + ': تطابق تام (آية/مرة) = ' + e.aya + '/' + e.times + ' — شامل (آية/مرة) = ' + s.aya + '/' + s.times);
}
// تشخيص: كلمات تحوي "كتاب"
let dbg = 0;
for (const su of Q.surahs) for (const v of su.verses) for (const t of toks(v)) {
  if (t.indexOf('كِت') >= 0 && dbg < 5) { console.log('    تشخيص: «' + t + '» -> «' + norm2(t) + '» code=' + Array.from(t).map(c => c.charCodeAt(0).toString(16)).join(' ')); dbg++; }
}
// تحقق: مجموع المرات لعبارة لا يقل عن عدد الآيات
const chk = countWord('الله', false);
ok(chk.times >= chk.aya && chk.aya > 0, 'اتساق بحث الكلمات: مرات >= آيات (' + chk.times + '/' + chk.aya + ')');

// ===== 6) مثال توضيحي لجذر =====
console.log('--- عينة: جذر ع ل م (Elm) ---');
const fo = D.roots['Elm'];
let tot = 0; fo.forEach(f => tot += f.o.length);
console.log('  صيغ: ' + fo.length + ' — مجموع المواضع: ' + tot + ' — فهرس: ' + IDX.list.find(x => x.c === 'Elm').t);
ok(tot === IDX.list.find(x => x.c === 'Elm').t, 'مجموع صيغ جذر العلم = عدده في الفهرس');
const pos = [];
for (const f of fo.slice(0, 3)) for (const oc of f.o.slice(0, 2)) {
  const t = toks(Q.surahs[oc[0] - 1].verses[oc[1] - 1]);
  pos.push(oc[0] + ':' + oc[1] + ' «' + t.slice(oc[2], oc[3] + 1).join(' ') + '» lem=' + f.l);
}
console.log('  ' + pos.join(' | '));

console.log('');
console.log(fail === 0 ? '=== كل الفحوصات نجحت ===' : '=== فشل ' + fail + ' فحصًا ===');
process.exit(fail ? 1 : 0);
