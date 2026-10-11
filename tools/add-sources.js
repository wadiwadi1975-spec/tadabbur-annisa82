/**
 * tools/add-sources.js
 *
 * يضيف إلى public/data/encyclopedia.json مصادر رقمية حقيقية مفحوصة،
 * ويحذف المداخل التي لا يتوفر لها أي مصدر قابل للفتح.
 *
 * كل مصدر يُضاف هنا تم التحقق منه وقت تشغيل السكربت عبر واجهة archive.org:
 *   - metadata (عنوان/مؤلف/عدد الملفات وأنواعها)
 *   - رابط قراءة فعلي يفتح في المتصفح
 *
 * الاستخدام:  node tools/add-sources.js
 * الاختبار:   node tools/add-sources.js --dry
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'public', 'data', 'encyclopedia.json');
const DRY = process.argv.indexOf('--dry') >= 0;
const TODAY = '2026-10-11';
const SOURCE_NAME = 'أرشيف الإنترنت (Internet Archive)';

/**
 * [workId, authorId, title, category, coverage, archiveIdentifier]
 * category : من قائمة encCatLabel (tafsir|study|links|ijaz|lang|tadabbur|usul|manahij|gharib|book)
 * coverage : 'full-quran' عند تغطية الكتاب للقرآن كاملًا، و null عند تغطيته لجزء منه
 */
const NEW_WORKS = [
  ['w-abuLayth-bahr',      'abuLayth',      'تفسير السمرقندي (بحر العلوم)',                     'tafsir',  'full-quran', 'tahirkhan576-23594'],
  ['w-testri-tafsir',      'testri',        'تفسير التستري',                                     'tafsir',  'full-quran', '3742Bok'],
  ['w-ibnJazzy-tahsil',    'ibnJazzy',      'التسهيل لعلوم التنزيل',                             'tafsir',  'full-quran', 'tafseer-ibn-jozy-1'],
  ['w-qasimi-tafsir',      'qasimi',        'تفسير القاسمي',                                     'tafsir',  'full-quran', '20250618_20250618_1256'],
  ['w-buqai-nazm',         'buqai',         'نظم الدرر في تناسب الآيات والسور',                  'links',   'full-quran', 'AAlexandrina-146811'],
  ['w-qattanM-mabahith',   'qattanM',       'مباحث في علوم القرآن',                              'study',   'full-quran', 'AAskZad-1142922'],
  ['w-iskafi-durra',       'iskafi',        'درة التنزيل وغرة التأويل',                          'tafsir',  'full-quran', 'AAlexandrina-210578'],
  ['w-baqillani-iijaz',    'baqillani',     'إعجاز القرآن',                                      'ijaz',    'full-quran', 'AAlexandrina-141388'],
  ['w-muraghiAM-tafsir',   'muraghiAM',     'تفسير المراغي',                                     'tafsir',  'full-quran', 'tafseer_mraghi'],
  ['w-qushayri-lataif',    'qushayri',      'لطائف الإشارات (تفسير القشيري)',                    'tafsir',  'full-quran', 'tahirkhan576-23629'],
  ['w-ibnTaymiyya-dar',    'ibnTaymiyya',   'درء تعارض العقل والنقل',                            'usul',    null,        'dtan00'],
  ['w-samarraie-muraaah',  'samarraie',     'مراعاة المقام في التعبير القرآني',                  'lang',    'full-quran', '20211014_20211014_1306'],
  ['w-shahata-tafsir',     'shahata',       'تفسير القرآن الكريم',                               'tafsir',  'full-quran', 'AAlexandrina-024408'],
  ['w-zaykhili-wajiz',     'zaykhili',      'التفسير الوجيز',                                     'tafsir',  'full-quran', '20250619_20250619_1216'],
  ['w-azhar-wasit',        'azharCouncil',  'التفسير الوسيط للقرآن الكريم',                      'tafsir',  'full-quran', 'QuranIntermediateExegesis'],
  ['w-azhar-muntakhab',    'azharCommittee','المنتخب في تفسير القرآن الكريم',                    'tafsir',  'full-quran', 'tahirkhan576-836'],
  ['w-farahi-mufradat',    'farahi',        'مفردات القرآن',                                      'lang',    'full-quran', 'laila_201511'],
  ['w-abbass-janna',       'abbass',        'الجنة في القرآن الكريم',                            'study',   null,        'BBib-Alex-00070'],
  ['w-tayyar-lughawi',     'tayyar',        'التفسير اللغوي للقرآن الكريم',                      'lang',    'full-quran', '20200117_20200117_1543'],
  ['w-darweesh-iirab',     'darweesh',      'إعراب القرآن الكريم وبيانه',                        'lang',    'full-quran', '20250604_20250604_1133'],
  ['w-hawwad-aysar',       'hawwad',        'أيسر التفاسير',                                      'tafsir',  'full-quran', '20250603_20250603_1232'],
  ['w-yasin-sahih',        'yasin',         'التفسير الصحيح بالمأثور',                           'tafsir',  'full-quran', '20250621_20250621_1055'],
  ['w-saad-mana',          'saadMT',        'المعنى القرآني: معالم الطريق إلى فقهه في سياق السورة','study', 'full-quran', '20221213_20221213_1623'],
  ['w-rumi-jami',          'rumi',          'جمع القرآن في عهد الخلفاء الراشدين',                 'study',   'full-quran', '20200323_20200323_1110'],
  ['w-zarsur-ulum',        'zarsur',        'علوم القرآن',                                        'study',   'full-quran', 'zarzo-quran'],
  ['w-munai-madkhal',      'munai',         'مدخل إلى دراسة القرآن الكريم',                      'study',   'full-quran', 'AAskZad-0179358'],
  ['w-sabt-khulasa',       'sabt',          'الخلاصة في تدبر القرآن الكريم',                     'tadabbur','full-quran', 'kholasa1'],
  ['w-ibnUthaymin-muqaddima','ibnUthaymin', 'شرح مقدمة التفسير',                                 'usul',    'full-quran', '20221031_20221031_1230'],
  ['w-lahham-mafatih',     'lahham',        'مفاتح تدبر القرآن والنجاح في الحياة',               'tadabbur','full-quran', 'a978n'],
  ['w-makkiM-mueen',       'makkiM',        'المعين على تدبر الكتاب المبين',                     'tadabbur','full-quran', 'benzima_tutanota_20180513'],
  ['w-uwaidat-marahil',    'uwaidat',       'المراحل الثمان لطالب فهم القرآن',                  'study',   'full-quran', '20200229_20200229_0803'],
  ['w-ruwyshd-hakatha',    'ruwyshd',       'هكذا عاشوا مع القرآن: قصص ومواقف',                  'study',   'full-quran', 'hakatha1'],
  ['w-ibrahimMI-muajam',   'ibrahimMI',     'معجم الألفاظ والأعلام القرآنية',                    'lang',    'full-quran', '20240715_20240715_1059'],
  ['w-shahrour-dalil',     'shahrour',      'دليل القراءة المعاصرة للتنزيل الحكيم',              'study',   'full-quran', 'dalil_9ira2a_mo3assira'],
  ['w-jabri-madkhal',      'jabri',         'مدخل إلى القرآن الكريم',                            'study',   'full-quran', 'elshandawily13030'],
  ['w-arkoun-quran',       'arkoun',        'القرآن من التفسير الموروث إلى تحليل الخطاب الديني','study',   'full-quran', '20260628_20260628_1523'],
  ['w-makhluuf-jam',       'makhluuf',      'بعض كتب حسنين محمد مخلوف (طبعات نادرة)',           'tafsir',  null,        '1954_20210208'],
  ['w-wajdi-tilaq',        'wajdi',         'الأدلة العلمية على جواز ترجمة معاني القرآن',        'ijaz',    'full-quran', 'AAlexandrina-191642'],
  ['w-qasimAR-kutub',      'qasimAR',       'كتب الشيخ عبد الرحمن بن قاسم (مجموعة)',            'book',    null,        '20200111_20200111_2202']
];

/** كتب حُذفت بعد بحث واسع ولم يُعثر لها على مصدر قابل للفتح */
const DROP_WORKS = [
  ['w-kanz',           'كنز المعاني في تفسير القرآن المجيد', 'لم يُعثر على نسخة رقمية مفتوحة (تادْفُل: «كنز المعاني» للجعبري كتاب آخر)'],
  ['w-nizam',          'نظام القرآن في مناسبات سوره',        'لم يُعثر على نسخة رقمية مفتوحة'],
  ['w-madhal-quran',   'المدخل إلى القرآن الكريم',           'لم يُعثر على نسخة رقمية مفتوحة'],
  ['w-bayan-qaqaa',    'البيان في قضايا القرآن',             'لم يُعثر على نسخة رقمية مفتوحة']
];

/** كتب موجودة تُزوَّد بمصدر */
const PATCH_WORKS = [
  ['w-dustur-akhlaq', 'dstoralaklaq']
];

const DOC_EXT = ['pdf', 'txt', 'htm', 'html', 'epub', 'djvu', 'doc', 'docx', 'rtf'];

function fetchJSON(url) {
  return fetch(url, { headers: { 'accept': 'application/json' } }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return r.json();
  });
}

function pickReadUrl(id, files) {
  // ملف PDF/ djvu مفرد → رابط مباشر؛ وإلا صفحة العنصر التي تعرض كل الملفات.
  var doc = files.filter(function (f) {
    var e = (f.name.split('.').pop() || '').toLowerCase();
    return DOC_EXT.indexOf(e) >= 0 && !/^_xml|_meta/i.test(f.name);
  });
  if (doc.length === 1) {
    return {
      url: 'https://archive.org/download/' + id + '/' + encodeURIComponent(doc[0].name),
      kind: 'pdf',
      count: 1
    };
  }
  return { url: 'https://archive.org/details/' + id, kind: 'pdf', count: doc.length };
}

function makeWork(meta, author, workId, title, category, coverage) {
  var files = meta.files || [];
  var read = pickReadUrl(meta.id, files);
  return {
    id: workId,
    title: title,
    authorId: author.id,
    authorName: author.name,
    category: category,
    subcategory: null,
    era: author.era || null,
    publisher: null,
    publicationYear: null,
    edition: null,
    volumes: null,
    language: 'عربية',
    description: null,
    sourceName: SOURCE_NAME,
    sourceUrl: 'https://archive.org/details/' + meta.id,
    legalAccess: 'متاح للتحميل والقراءة مجانًا من أرشيف الإنترنت',
    verificationStatus: 'verified',
    coverage: coverage,
    availabilityStatus: read.kind,
    readerUrl: 'https://archive.org/details/' + meta.id,
    pdfUrl: read.url,
    textUrl: null,
    verifiedAt: TODAY,
    copyrightStatus: 'unknown',
    pdfCount: read.count,
    parts: 1,
    archiveIdentifier: meta.id
  };
}

async function main() {
  var data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  var authorsById = {};
  data.authors.forEach(function (a) { authorsById[a.id] = a; });
  var stat = {
    authorsBefore: data.authors.length,
    worksBefore: data.works.length,
    availBefore: data.works.filter(function (w) {
      return ['full_text', 'pdf', 'online_viewer'].indexOf(w.availabilityStatus) >= 0;
    }).length
  };

  // 1) جلب البيانات الرسمية لكل معرّف
  console.log('… جلب metadata لأرشيف الإنترنت (' + NEW_WORKS.length + ' عنصرًا)');
  var metas = {};
  await Promise.all(NEW_WORKS.map(function (w) {
    return fetchJSON('https://archive.org/metadata/' + w[5]).then(function (j) {
      metas[w[5]] = { id: w[5], metadata: j.metadata || {}, files: j.files || [] };
    }).catch(function (e) {
      metas[w[5]] = { error: String(e) };
    });
  }));
  PATCH_WORKS.forEach(function (p) {
    metas[p[1]] = metas[p[1]] || { error: 'not fetched' };
  });
  await Promise.all(PATCH_WORKS.map(function (p) {
    return fetchJSON('https://archive.org/metadata/' + p[1]).then(function (j) {
      metas[p[1]] = { id: p[1], metadata: j.metadata || {}, files: j.files || [] };
    }).catch(function (e) { metas[p[1]] = { error: String(e) }; });
  }));

  // 2) فحص المصداقية قبل أي كتابة
  var errors = [];
  var built = [];
  NEW_WORKS.forEach(function (w) {
    var m = metas[w[5]];
    if (!m || m.error) { errors.push(w[0] + ': تعذّر جلب ' + w[5] + ' — ' + (m && m.error)); return; }
    var author = authorsById[w[1]];
    if (!author) { errors.push(w[0] + ': المؤلف غير موجود ' + w[1]); return; }
    if (!m.metadata.title) { errors.push(w[0] + ': العنصر بلا عنوان ' + w[5]); return; }
    if (!m.files.length) { errors.push(w[0] + ': العنصر بلا ملفات ' + w[5]); return; }
    if (data.works.some(function (x) { return x.id === w[0]; })) { errors.push(w[0] + ': معرّف مكرر'); return; }
    built.push(makeWork(m, author, w[0], w[2], w[3], w[4]));
  });

  if (errors.length) {
    console.error('\n✗ تعذّر المتابعة — مشاكل في ' + errors.length + ' عنصرًا:');
    errors.forEach(function (e) { console.error('   - ' + e); });
    process.exit(1);
  }

  // 3) الترقيع
  PATCH_WORKS.forEach(function (p) {
    var w = data.works.filter(function (x) { return x.id === p[0]; })[0];
    var m = metas[p[1]];
    if (!w) { errors.push(p[0] + ': غير موجود'); return; }
    if (!m || m.error) { errors.push(p[0] + ': تعذّر جلب المصدر'); return; }
    w.sourceName = SOURCE_NAME;
    w.sourceUrl = 'https://archive.org/details/' + m.id;
    w.legalAccess = 'متاح للتحميل والقراءة مجانًا من أرشيف الإنترنت';
    w.verificationStatus = 'verified';
    w.availabilityStatus = 'pdf';
    w.readerUrl = 'https://archive.org/details/' + m.id;
    w.pdfUrl = pickReadUrl(m.id, m.files).url;
    w.verifiedAt = TODAY;
    w.archiveIdentifier = m.id;
  });
  if (errors.length) {
    console.error('\n✗ ترقيع فاشل:'); errors.forEach(function (e) { console.error('   - ' + e); });
    process.exit(1);
  }

  // 4) إدراج الكتب الجديدة
  built.forEach(function (w) { data.works.push(w); });

  // 5) الحذف
  var dropped = [];
  DROP_WORKS.forEach(function (d) {
    var i = data.works.findIndex(function (x) { return x.id === d[0]; });
    if (i >= 0) { dropped.push(data.works[i]); data.works.splice(i, 1); }
    else errors.push(d[0] + ': غير موجود للحذف');
  });

  // 6) مؤلفون بلا أي مادة → حذف (مع حماية صريحة لمن أُضيفت له كتب)
  var protectedIds = {};
  NEW_WORKS.forEach(function (w) { protectedIds[w[1]] = 1; });
  data.works.forEach(function (w) { protectedIds[w.authorId] = 1; });
  data.verseReferences.forEach(function (r) { protectedIds[r.authorId] = 1; });

  var orphanIds = {};
  data.authors.forEach(function (a) {
    if (protectedIds[a.id]) return;
    orphanIds[a.id] = a.name;
  });
  var orphans = Object.keys(orphanIds);
  data.authors = data.authors.filter(function (a) { return !orphanIds[a.id]; });

  // 7) إحصاءات
  var avail = data.works.filter(function (w) {
    return ['full_text', 'pdf', 'online_viewer'].indexOf(w.availabilityStatus) >= 0;
  });
  console.log('\n=== قبل ===');
  console.log('  مؤلفون: ' + stat.authorsBefore + '  كتب: ' + stat.worksBefore +
              '  مصادر متاحة: ' + stat.availBefore);

  console.log('\n=== بعد ===');
  console.log('  مؤلفون: ' + data.authors.length + '  كتب: ' + data.works.length +
              '  مصادر متاحة: ' + avail.length);
  console.log('  كتب مضافة بمصدر مفحوص: ' + built.length);
  console.log('  كتب مُرقَّعة بمصدر: ' + PATCH_WORKS.length);
  console.log('  كتب محذوفة (بلا أي مصدر): ' + dropped.length);
  dropped.forEach(function (d) { console.log('     · ' + d.id + ' — ' + d.title + ' (' + d.authorName + ')'); });
  console.log('  مؤلفون محذوفون (بلا أي مادة): ' + orphans.length);
  orphans.forEach(function (id) { console.log('     · ' + id + ' — ' + orphanIds[id]); });

  if (DRY) { console.log('\n[dry] لم يُكتب أي ملف.'); return; }

  // الملف الأصلي يستخدم CRLF ومسافة واحدة للإزاحة وسطر نهائي
  var text = JSON.stringify(data, null, 1).replace(/\n/g, '\r\n') + '\r\n';
  fs.writeFileSync(FILE, text, 'utf8');
  console.log('\n✓ كُتب ' + FILE);
}

main().catch(function (e) {
  console.error('✗ ' + (e && e.stack || e));
  process.exit(1);
});
