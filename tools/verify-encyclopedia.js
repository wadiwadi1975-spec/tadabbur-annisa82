/**
 * tools/verify-encyclopedia.js
 *
 * يتحقق من سلامة public/data/encyclopedia.json بعد إضافة المصادر:
 *   - كل كتاب له مصدر قابل للفتح فعلًا
 *   - كل مؤلف يملك مادة واحدة على الأقل
 *   - لا مراجع معلّقة (workId/authorId غير موجود)
 *   - التصنيفات من القائمة المعتمدة
 *   - عيّنة من الروابط تفتح فعليًا (HTTP 200)
 *
 * الاستخدام:  node tools/verify-encyclopedia.js            (بدون فحص شبكي)
 *             node tools/verify-encyclopedia.js --network  (مع فحص روابط العيّنة)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'public', 'data', 'encyclopedia.json');
const NET = process.argv.indexOf('--network') >= 0;

const VALID_CAT = ['tafsir', 'book', 'research', 'study', 'reading', 'lang', 'context',
  'links', 'ijaz', 'tadabbur', 'usul', 'manahij', 'gharib', 'library'];
const AVAILABLE = ['full_text', 'pdf', 'online_viewer'];
const VALID_AVAIL = AVAILABLE.concat(['metadata_only', 'needs_source']);

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok = m => console.log('  ✓ ' + m);

console.log('فاحص سلامة الموسوعة\n');

// 1) البنية
console.log('[1] البنية');
if (!Array.isArray(data.authors) || !data.authors.length) bad('authors فارغ');
if (!Array.isArray(data.works) || !data.works.length) bad('works فارغ');
if (!Array.isArray(data.verseReferences)) bad('verseReferences غير مصفوفة');
ok('المؤلفون: ' + data.authors.length + ' · الكتب: ' + data.works.length +
   ' · مواد الآيات: ' + data.verseReferences.length +
   ' · الأبحاث: ' + (data.research || []).length);

// 2) كل كتاب متاح
console.log('\n[2] توفر الكتب');
const notAvail = data.works.filter(w => AVAILABLE.indexOf(w.availabilityStatus) < 0);
if (notAvail.length) notAvail.forEach(w => bad('غير متاح: ' + w.id + ' — ' + w.title + ' (' + w.availabilityStatus + ')'));
else ok('كل الكتب (' + data.works.length + ') متاحة للقراءة فعليًا');

const noSrc = data.works.filter(w => !w.sourceUrl || !w.sourceName);
if (noSrc.length) noSrc.forEach(w => bad('بلا مصدر: ' + w.id));
else ok('كل كتاب له sourceName و sourceUrl');

const badAvail = data.works.filter(w => VALID_AVAIL.indexOf(w.availabilityStatus) < 0);
if (badAvail.length) badAvail.forEach(w => bad('قيمة توفر غير معروفة في ' + w.id + ': ' + w.availabilityStatus));

const noVerify = data.works.filter(w => w.verificationStatus !== 'verified');
if (noVerify.length) noVerify.forEach(w => bad('غير موثق: ' + w.id + ' — ' + w.verificationStatus));

const noDate = data.works.filter(w => !w.verifiedAt);
if (noDate.length) noDate.forEach(w => bad('بلا تاريخ فحص: ' + w.id));

const dupId = {};
data.works.forEach(w => { dupId[w.id] = (dupId[w.id] || 0) + 1; });
Object.keys(dupId).filter(k => dupId[k] > 1).forEach(k => bad('معرّف كتاب مكرر: ' + k));

// 3) كل مؤلف له مادة
console.log('\n[3] تغطية المؤلفين');
const authorIds = {};
data.authors.forEach(a => authorIds[a.id] = a.name);
const worksBy = {};
data.works.forEach(w => { worksBy[w.authorId] = (worksBy[w.authorId] || 0) + 1; });
const refsBy = {};
data.verseReferences.forEach(r => { refsBy[r.authorId] = (refsBy[r.authorId] || 0) + 1; });
const emptyAuthors = data.authors.filter(a => !worksBy[a.id] && !refsBy[a.id]);
if (emptyAuthors.length) emptyAuthors.forEach(a => bad('مؤلف بلا أي مادة: ' + a.id + ' — ' + a.name));
else ok('كل مؤلف له كتاب متاح أو مادة آية');

const orphanWorks = data.works.filter(w => !authorIds[w.authorId]);
if (orphanWorks.length) orphanWorks.forEach(w => bad('كتاب لمؤلف غير موجود: ' + w.id + ' → ' + w.authorId));
else ok('لا كتب معلّقة بمؤلف غير موجود');

// 4) مراجع الآيات
console.log('\n[4] مراجع الآيات');
let refBad = 0;
data.verseReferences.forEach(r => {
  if (!authorIds[r.authorId]) { bad('مرجع آية بمؤلف غير موجود: ' + r.id + ' → ' + r.authorId); refBad++; }
  if (r.workId && !data.works.some(w => w.id === r.workId)) { bad('مرجع آية بكتاب غير موجود: ' + r.id + ' → ' + r.workId); refBad++; }
  if (!(r.surahNumber >= 1 && r.surahNumber <= 114)) { bad('سورة خارج النطاق: ' + r.id + ' → ' + r.surahNumber); refBad++; }
  if (!(r.verseStart >= 1 && r.verseStart <= (r.verseEnd || r.verseStart))) { bad('نطاق آيات خاطئ: ' + r.id); refBad++; }
});
if (!refBad) ok('كل مراجع الآيات سليمة (' + data.verseReferences.length + ')');

// 5) التصنيفات
console.log('\n[5] التصنيفات');
const badCat = data.works.filter(w => VALID_CAT.indexOf(w.category) < 0);
if (badCat.length) badCat.forEach(w => bad('تصنيف غير معروف في ' + w.id + ': ' + w.category));
else ok('كل تصنيفات الكتب من القائمة المعتمدة');

// 6) محاكاة encVerifiedCount
console.log('\n[6] محاكاة مؤشر «توجد مواد موثقة»');
let zero = 0;
data.authors.forEach(a => {
  const n = worksBy[a.id] || 0;
  if (!n && !refsBy[a.id]) zero++;
});
ok('عدد المؤلفين الذين سيظهر معهم «توجد مواد موثقة»: ' + (data.authors.length - zero) + ' من ' + data.authors.length);

console.log('\n═══ النتيجة: ' + (fail ? fail + ' مشكلة' : 'كل الفحوصات ناجحة') + ' ═══');
if (!NET) { console.log('(لم يُفحص الشبكة — استعمل --network لفتح عيّنة من الروابط)'); process.exit(fail ? 1 : 0); }

// 7) فحص شبكة
console.log('\n[7] فتح عيّنة من الروابط فعليًا');
const sample = data.works
  .filter((w, i) => i % Math.max(1, Math.floor(data.works.length / 12)) === 0)
  .slice(0, 12);

(async () => {
  const results = await Promise.all(sample.map(w => {
    const u = w.sourceUrl;
    return fetch(u, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } })
      .then(r => ({ id: w.id, u: u, status: r.status }))
      .catch(e => ({ id: w.id, u: u, status: 'ERR ' + e.message }));
  }));
  let nbad = 0;
  results.forEach(r => {
    const good = r.status === 200;
    if (!good) { bad('رابط لا يفتح (' + r.status + '): ' + r.id + ' — ' + r.u); nbad++; }
    else ok('200  ' + r.id + '  ' + r.u);
  });
  console.log('\n═══ الشبكة: ' + (nbad ? nbad + ' رابط معطّل من ' + results.length : 'كل الروابط في العيّنة تفتح (' + results.length + ')') + ' ═══');
  process.exit(fail ? 1 : 0);
})();
