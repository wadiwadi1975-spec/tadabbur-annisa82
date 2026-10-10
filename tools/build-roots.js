/**
 * بناء قاعدة الجذور من بيانات Quranic Arabic Corpus (v0.4)
 * المصدر: https://corpus.quran.com/ — ترخيص GNU GPL، يُشترط عدم تغيير الملف الأصلي
 * وإسناد المصدر مع رابطه. النص الأساسي: Tanzil Uthmani 1.0.2 (CC BY-ND 3.0).
 *
 * المخرجات:
 *   public/data/roots.json        (الجذور كاملة: صيغ + مواضع مرتبطة بموضعها في نص الموقع)
 *   public/data/roots-index.json  (فهرس خفيف للقوائم المنسدلة)
 *
 * لا يُحتسب أي عدد هنا إلا من الملف الأصلي نفسه.
 * كل موضع يُخزَّن فيه: [سورة، آية، من، إلى، أعلام] حيث "من/إلى" فهرسا الكلمة في
 * نص الموقع (بعد استبعاد علامات الوقف المستقلة)، والأعلام: 1=بلاحقة، 2=بلاحقة،
 * 4=يحتاج مراجعة لغوية.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const MORPH = process.env.MORPH ||
  path.join(__dirname, 'source', 'quranic-corpus-morphology-0.4.txt');
const QURAN = path.join(ROOT_DIR, 'public', 'data', 'quran-uthmani.json');
const OUT = path.join(ROOT_DIR, 'public', 'data', 'roots.json');
const OUT_IDX = path.join(ROOT_DIR, 'public', 'data', 'roots-index.json');

// ===== 1) حقوق الملف الأصلي حرفياً (تبقى في كل نسخة مشتقة) =====
const raw = fs.readFileSync(MORPH, 'utf8');
const lines = raw.split(/\r?\n/);
const notice = [];
for (const ln of lines) {
  if (ln.startsWith('#')) notice.push(ln);
  else if (ln.trim() === '' && notice.length && notice.length < 80) continue;
  else break;
}

// ===== 2) حروف الترميز -> الحروف العربية =====
const FMAP = {
  $: 'ش', '*': 'ذ', D: 'ض', E: 'ع', H: 'ح', S: 'ص', T: 'ط', Z: 'ظ',
  b: 'ب', d: 'د', f: 'ف', g: 'غ', G: 'غ', h: 'ه', j: 'ج', k: 'ك',
  l: 'ل', m: 'م', n: 'ن', q: 'ق', r: 'ر', s: 'س', t: 'ت', v: 'ث',
  x: 'خ', y: 'ي', Y: 'ي', z: 'ز', w: 'و', p: 'ه',
  A: '', '{': '', '>': '', '<': '', "'": '', '&': '', '}': '', '_': '', '#': '',
  '@': '', '[': '', ']': '', '^': '', '`': '', '~': '', '"': '', '!': '', '%': '',
  ':': '', '.': '', ',': '', '-': '', '+': '', '(': '', ')': '', ' ': ''
};
// أحرف قصيرة (حركات/تنوين) تُستبعد
const VOWELS = { a: 1, i: 1, u: 1, o: 1, F: 1, K: 1, N: 1, O: 1 };

/** تحويل نص الترميز (FORM/LEM) إلى جوهر الحروف العربية (بدون همزات ولا ألف) */
function coreFromCorpus(str) {
  let out = '';
  for (const ch of str) {
    if (VOWELS[ch]) continue;
    if (FMAP[ch] !== undefined) { out += FMAP[ch]; continue; }
    if (/[a-zA-Z]/.test(ch)) out += (FMAP[ch] || '');   // أحرف غير متوقعة تُحسب حرفياً إن أمكن
    // أي رمز آخر (حركات/علامات) يُستبعد
  }
  return out;
}

/** جوهر حروف كلمة من نص الموقع: بلا تشكيل/علامات، بلا همزات ولا ألف، ة->ه، ى->ي */
function coreFromSite(tok) {
  let s = tok;
  s = s.replace(/\u0670/g, 'ا');                                   // ألف خنجرية
  s = s.replace(/[\u064B-\u0655\u06D6-\u06ED\u0640\u0610-\u061A\u200D\u200C]/g, '');
  s = s.replace(/\u0651/g, '');                                    // شدة
  s = s.replace(/[\u0622\u0623\u0625\u0627\u0671\u0621\u0624\u0626]/g, ''); // همزات وألف
  s = s.replace(/\u0649/g, '\u064A').replace(/\u0629/g, '\u0647'); // ى->ي ، ة->ه
  return s.replace(/[^\u0621-\u063A\u0641-\u064A]/g, '');
}

function isSubsequence(needle, hay) {   // هل needle تسلسل فرعي من hay ؟
  let i = 0;
  for (const ch of hay) { if (i < needle.length && ch === needle[i]) i++; }
  return i === needle.length;
}

// ===== 3) تحليل سطور التصنيف =====
const AY = new Map();   // "s:a" -> {wmax, words: Map(w -> {forms:[], flags, stems:[{f,r,l,t,fe} ]})}
function ayah(s, a) {
  const k = s + ':' + a;
  let o = AY.get(k);
  if (!o) { o = { s, a, wmax: 0, words: new Map() }; AY.set(k, o); }
  return o;
}
function wordOf(ay, w) {
  let o = ay.words.get(w);
  if (!o) { o = { forms: [], flags: 0, stems: [] }; ay.words.set(w, o); }
  if (w > ay.wmax) ay.wmax = w;
  return o;
}

let stemTotal = 0, stemNoRoot = 0, segTotal = 0;
for (const ln of lines) {
  if (!ln || ln.charCodeAt(0) === 35) continue;
  const p = ln.split('\t');
  if (p.length < 4) continue;
  const m = /^\((\d+):(\d+):(\d+):(\d+)\)$/.exec(p[0]);
  if (!m) continue;
  const s = +m[1], a = +m[2], w = +m[3];
  segTotal++;
  const ay = ayah(s, a);
  const wo = wordOf(ay, w);
  const feats = p[3];
  wo.forms.push(p[1]);
  if (feats.indexOf('PREFIX|') === 0) wo.flags |= 1;
  else if (feats.indexOf('SUFFIX|') === 0) wo.flags |= 2;

  if (feats.indexOf('STEM|') !== 0) continue;
  stemTotal++;
  const rm = /\|ROOT:([^|]+)/.exec(feats);
  const lm = /\|LEM:([^|]+)/.exec(feats);
  if (!rm) { stemNoRoot++; continue; }
  const clean = feats.replace(/^\s*STEM\|/, '').split('|')
    .filter(x => x && x.indexOf('LEM:') !== 0 && x.indexOf('ROOT:') !== 0 && x !== 'STEM')
    .join('|');
  wo.stems.push({ f: p[1], r: rm[1], l: lm ? lm[1] : '', t: p[2], fe: clean });
}

// ===== 4) مطابقة مواضع الكلمات في corpus مع كلمات نص الموقع =====
const Q = JSON.parse(fs.readFileSync(QURAN, 'utf8'));
const BASM = ['بسم', 'الله', 'الرحمن', 'الرحيم'];const siteCache = new Map();   // "s:a" -> {toks:[], core:[]}
function siteOf(s, a) {
  const k = s + ':' + a;
  if (siteCache.has(k)) return siteCache.get(k);
  const su = Q.surahs[s - 1];
  const v = (su && su.verses[a - 1]) || '';
  const toks = v.split(/\s+/).filter(t => /[\u0621-\u064A]/.test(t));
  const core = toks.map(coreFromSite);
  const o = { toks, core };
  siteCache.set(k, o);
  return o;
}
function isBasmala(toks, core) {
  if (toks.length < 4) return false;
  const head = core.slice(0, 4).join('');
  return head === BASM.map(coreFromSite).join('');
}

const modes = { identity: 0, offset: 0, content: 0, failed: 0 };
const failedAyat = [];
const sampleMap = {};   // الآيات الأربع المميزة للتحقق اليدوي

for (const ay of AY.values()) {
  const site = siteOf(ay.s, ay.a);
  const cws = [];   // {w, core} بالترتيب
  for (let w = 1; w <= ay.wmax; w++) {
    const wo = ay.words.get(w);
    if (!wo) continue;
    cws.push({ w, core: coreFromCorpus(wo.forms.join('')) });
  }
  const m = {};     // w -> [start, end] فهارس كلمات الموقع
  let mode = null;

  if (cws.length === site.toks.length) {
    cws.forEach((c, i) => { m[c.w] = [i, i]; });
    mode = 'identity';
  } else if (site.toks.length - cws.length === 4 && ay.a === 1 && ay.s > 1 && isBasmala(site.toks, site.core)) {
    cws.forEach((c, i) => { m[c.w] = [i + 4, i + 4]; });
    mode = 'offset';
  } else {
    mode = 'content';
    let cur = 0, ok = true;
    for (const c of cws) {
      let found = -1, span = 1;
      for (let j = cur; j < site.toks.length && j <= cur + 6; j++) {
        if (site.core[j] === c.core) { found = j; span = 1; break; }
        if (j + 1 < site.toks.length && (site.core[j] + site.core[j + 1]) === c.core) { found = j; span = 2; break; }
      }
      if (found < 0) {
        for (let j = cur; j < site.toks.length && j <= cur + 6; j++) {
          if (site.core[j].indexOf(c.core) >= 0 && c.core) { found = j; span = 1; break; }
          if (j + 1 < site.toks.length && c.core &&
              (site.core[j] + site.core[j + 1]).indexOf(c.core) >= 0) { found = j; span = 2; break; }
        }
      }
      if (found < 0) { ok = false; break; }
      m[c.w] = [found, found + span - 1];
      cur = found + span;
    }
    if (!ok) { mode = 'failed'; }
  }

  if (mode === 'failed') {
    modes.failed++;
    failedAyat.push(ay.s + ':' + ay.a);
    // رجوع إلى الترتيب المباشر مع علامة مراجعة
    cws.forEach((c, i) => { m[c.w] = (i < site.toks.length) ? [i, i] : null; });
  } else if (mode === 'content') {
    modes.content++;
    sampleMap[ay.s + ':' + ay.a] = m;
  } else modes[mode]++;

  ay.map = m;
  ay.review = (mode === 'failed' || mode === 'content');
}

// ===== 5) تحقق مضموني من كل موضع جذر: هل حروف الأصل موجودة في الكلمة؟ =====
let coreFail = 0, reviewOcc = 0;
const coreFailSample = [];

// ===== 6) تجميع الصيغ =====
const forms = new Map();      // root -> Map(key -> form)
const locSeen = new Map();
for (const ay of AY.values()) {
  for (const [w, wo] of ay.words) {
    const span = ay.map[w];
    for (const st of wo.stems) {
      const dk = ay.s + ':' + ay.a + ':' + w;
      const dedupe = dk + '\u0001' + st.r;
      if (locSeen.has(dedupe)) continue;
      locSeen.set(dedupe, 1);
      let rm2 = forms.get(st.r);
      if (!rm2) { rm2 = new Map(); forms.set(st.r, rm2); }
      const fk = st.l + '\u0001' + st.t + '\u0001' + st.fe;
      let fo = rm2.get(fk);
      if (!fo) { fo = { l: st.l, t: st.t, f: st.fe, o: [] }; rm2.set(fk, fo); }
      let fl = wo.flags;
      if (!span) fl |= 4;
      if (span) {
        const siteCore = siteOf(ay.s, ay.a).core.slice(span[0], span[1] + 1).join('');
        if (!isSubsequence(coreFromCorpus(st.f), siteCore)) {
          fl |= 4; coreFail++;
          if (coreFailSample.length < 8) coreFailSample.push(ay.s + ':' + ay.a + ' ' + st.f + ' -> ' + siteCore);
        }
      } else { fl |= 4; coreFail++; }
      if (fl & 4) reviewOcc++;
      fo.o.push([ay.s, ay.a, span ? span[0] : -1, span ? span[1] : -1, fl]);
    }
  }
}

// ===== 7) ترجمة حروف الجذر إلى العربية =====
const ROOTMAP = {
  $: 'ش', '*': 'ذ', D: 'ض', E: 'ع', H: 'ح', S: 'ص', T: 'ط', Z: 'ظ',
  b: 'ب', d: 'د', f: 'ف', g: 'غ', h: 'ه', j: 'ج', k: 'ك', l: 'ل',
  m: 'م', n: 'ن', q: 'ق', r: 'ر', s: 'س', t: 'ت', v: 'ث',
  w: 'و', x: 'خ', y: 'ي', z: 'ز'
};
/** فك ترميز الوجه (LEMM) إلى حروف عربية للعرض فقط — النص المعروض للمستخدم يبقى نص المصحف */
function decodeAr(str) {
  const cs = String(str).split('');
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c === '`' || c === 'A') { out += 'ا'; continue; }
    if (c === '{') { out += (cs[i + 1] === 'l') ? 'ا' : (i === 0 ? 'أ' : 'ء'); continue; }
    if (c === '>' || c === '<' || c === "'") { out += (i === 0) ? 'أ' : 'ء'; continue; }
    if (c === '&') { out += 'ؤ'; continue; }
    if (c === '}') { out += 'ئ'; continue; }
    if (c === 'p') { out += 'ة'; continue; }
    if (c === 'Y') { out += 'ى'; continue; }
    if (c === '_') continue;
    if (c === '~' || c === '^' || c === ':') continue;
    if (VOWELS[c]) continue;
    if (FMAP[c] !== undefined) { out += FMAP[c]; continue; }
    if (/[a-zA-Z]/.test(c)) out += (FMAP[c] || '');
  }
  return out.replace(/أا/g, 'آ');
}

function rootArabic(code) {
  const cs = code.split('');
  return cs.map((c, i) => {
    if (c === 'A') return i === 0 ? 'أ' : 'ء';      // همزة: ألف في أول الجذر وإلا ء
    return ROOTMAP[c] || '?';
  }).join(' ');
}

// ===== 8) كتابة المخرجات =====
const rootKeys = Array.from(forms.keys()).sort();
let occTotal = 0;
const out = {
  notice: notice.join('\n'),
  src: {
    morph: 'Quranic Arabic Corpus (Version 0.4), Copyright (C) 2011 Kais Dukes, GNU GPL',
    morphUrl: 'https://corpus.quran.com/',
    morphDownload: 'https://corpus.quran.com/download/',
    morphSearch: 'https://corpus.quran.com/morphologicalsearch.jsp',
    text: 'Tanzil Quran Text (Uthmani, version 1.0.2), Copyright (C) 2008-2009 Tanzil.info, CC BY-ND 3.0',
    textUrl: 'https://tanzil.net/download/',
    siteText: (Q.meta && Q.meta.source) ? Q.meta.source + ' — ' + Q.meta.link : 'Tanzil Uthmani'
  },
  counts: {},
  align: {},
  ar: {},
  roots: {}
};

const POSNAME = { N: 'اسم', V: 'فعل', ADJ: 'صفة', PN: 'اسم علم', LOC: 'ظرف مكان', T: 'ظرف زمان', INTG: 'استفهام', COND: 'شرط', IMPN: 'فعل أمر' };
const idxList = [];

for (const rk of rootKeys) {
  const arr = [];
  const posCount = {};
  let total = 0, review = 0, withClitic = 0;
  for (const [, fo] of forms.get(rk)) {
    occTotal += fo.o.length;
    total += fo.o.length;
    for (const oc of fo.o) {
      if (oc[4] & 4) review++;
      if (oc[4] & 3) withClitic++;
    }
    posCount[fo.t] = (posCount[fo.t] || 0) + fo.o.length;
    arr.push({ l: fo.l, a: decodeAr(fo.l), t: fo.t, f: fo.f, o: fo.o });
  }
  arr.sort((x, y) => y.o.length - x.o.length);
  out.roots[rk] = arr;
  const ar = rootArabic(rk);
  out.ar[rk] = ar;
  idxList.push({
    c: rk, a: ar, t: total,
    n: arr.length,
    r: review,
    p: Object.keys(posCount).map(k => (POSNAME[k] || k) + ':' + posCount[k]).join('،')
  });
}
idxList.sort((x, y) => y.t - x.t);

let reviewTotal = 0, cliticTotal = 0;
for (const rk of rootKeys) for (const fo of out.roots[rk]) for (const oc of fo.o) { if (oc[4] & 4) reviewTotal++; if (oc[4] & 3) cliticTotal++; }

out.counts = {
  roots: rootKeys.length,
  occurrences: occTotal,
  stems: stemTotal,
  stemsNoRoot: stemNoRoot,
  segments: segTotal,
  review: reviewTotal,
  withClitic: cliticTotal
};

out.align = {
  identity: modes.identity, offset: modes.offset, content: modes.content, failed: modes.failed,
  diffAyat: Object.keys(sampleMap)
};

fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');
const idxOut = {
  notice: out.notice, src: out.src, counts: out.counts,
  align: modes, list: idxList
};
fs.writeFileSync(OUT_IDX, JSON.stringify(idxOut), 'utf8');

console.log('--- مطابقة المواضع مع نص الموقع ---');
console.log(JSON.stringify(modes, null, 1));
console.log('آيات مطابقتها فشلت:', failedAyat.join(' '));
console.log('--- تحقق مضموني ---');
console.log('مواضع فشل تطابق حروفها مع الكلمة (رُقمنت مراجعة): ' + coreFail + ' / ' + occTotal);
console.log('عينات:', coreFailSample.join(' | '));
console.log('--- القاعدة ---');
console.log(JSON.stringify(out.counts, null, 1));
console.log('roots.json = ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
console.log('roots-index.json = ' + (fs.statSync(OUT_IDX).size / 1024).toFixed(0) + ' KB');
console.log('notice lines = ' + notice.length);
console.log('عينة جذور:', idxList.slice(0, 10).map(x => x.a + '(' + x.c + ')=' + x.t).join(' '));
console.log('--- خريطة الموقع (للتحقق اليدوي) ---');
for (const k of Object.keys(sampleMap)) {
  const site = siteOf(+k.split(':')[0], +k.split(':')[1]);
  const m = sampleMap[k];
  console.log(k + ': ' + Object.keys(m).map(w => 'w' + w + '->[' + m[w] + '] ' + site.toks[m[w][0]]).join(' | '));
}
