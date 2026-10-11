# أدوات البناء والتحقق

هذه المجلد خارج الموقع المنشور، ولا يُرفَع إلى Vercel (`vercel.json` يشير إلى `public` فقط).

## الملفات

| الملف | الوظيفة |
| --- | --- |
| `source/quranic-corpus-morphology-0.4.txt` | نسخة حرفية من التحليل الصرفي — **لا تُعدَّل** (النص الأصلي كما وُزّع). |
| `build-roots.js` | يبني `public/data/roots.json` و`public/data/roots-index.json` من ملف المصدر + نص المصحف في الموقع. |
| `verify.js` | فحوصات مستقلة: إعادة العد من المصدر، حدود الآيات، مطابقة النص، إحصاء النص، عيّنات بحث. |
| `checkjs.js` | يفحص صياغة أكواد JavaScript داخل `public/index.html` دون تشغيلها. |
| `serve.js` | خادم محلي بسيط للاختبار على `http://localhost:8787` (غير مطلوب للنشر). |
| `gen-logo.ps1` | يولّد أصول الشعار والأيقونات من `assets/logo-medallion-source.png` (يشغَّل عند تغيير الشعار فقط). |
| `add-sources.js` | يضيف إلى `public/data/encyclopedia.json` كتبًا لها مصدر رقمي مفتوح **مفحوص وقت التشغيل**، ويحذف ما لا يُعثر له على مصدر. |
| `verify-encyclopedia.js` | فحوصات سلامة الموسوعة: توفّر كل كتاب، عدم وجود مؤلف بلا مادة، سلامة مراجع الآيات والتصنيفات، وعيّنة من الروابط. |

## أوامر

```
node tools/build-roots.js     # إعادة بناء قاعدة الجذور
node tools/verify.js          # التحقق (يجب أن يخرج بكل الفحوصات ناجحة)
node tools/checkjs.js         # فحص صياغة الكود
node tools/serve.js           # تشغيل محلي للاختبار
node tools/verify-encyclopedia.js --network   # سلامة الموسوعة + فتح عيّنة من الروابط
node tools/add-sources.js --dry               # معاينة أثر إضافة المصادر دون كتابة
node tools/add-sources.js                     # تطبيق إضافة المصادر
powershell -ExecutionPolicy Bypass -File tools/gen-logo.ps1   # إعادة توليد الشعار والأيقونات
```

## الموسوعة القرآنية — سياسة المصادر

- **لا يُدرج الكتاب إن لم يكن له مصدر رقمي مفتوح يمكن فتحه فعليًا.** كل مدخل في `public/data/encyclopedia.json` يحمل `sourceUrl` و`verifiedAt`، وكل `availabilityStatus` من: `full_text` أو `pdf` أو `online_viewer`.
- عند تعذّر إيجاد مصدر، يُحذف المدخل بدل إبقائه «عنوانًا بلا فائدة».
- لا يُنسب أي عمل إلى مؤلف إلا بدليل من وصف المصدر نفسه (حقل `creator` أو العنوان المطابق في صفحة العنصر).
- المصداقية تُفحص لا تُفترض: `add-sources.js` يقرأ `https://archive.org/metadata/<id>` ويصرّ على وجود عنوان وملفات قبل الكتابة، و`verify-encyclopedia.js --network` يفتح عيّنة من الروابط ويتحقق من الحالة 200.

## الشعار والأيقونات

- المصدر الأصلي: `assets/logo-medallion-source.png` (مربّع 1254×1254) — **لا يُنشَر**، ويُحفظ لإعادة التوليد.
- `public/img/logo.png` — 340×340 بشفافية مشتقّة من الإضاءة، حتى يمتزج مع أي خلفية داكنة داخل القائمة الجانبية.
- `public/icon-192.png` و`public/icon-512.png` و`public/apple-touch-icon.png` — بخلفية سوداء معتمة `rgb(10,9,6)` مطابقة لخلفية الشعار.
- `public/icon-maskable-512.png` — الأيقونة مصغّرة داخل المنطقة الآمنة (70%) حتى لا يقصّها القناع الدائري، ومُعلَن عنها في `manifest.json` بـ `purpose: maskable`.

## المصادر والترخيص

- **Quranic Arabic Corpus** — https://corpus.quran.com/ (بحث التحليل: `morphologicalsearch.jsp`، التنزيل والشروط: `download/`).
  الإصدار المستخدم **0.4**، ترخيص **GNU GPL**.
  ترويسة الحقوق محفوظة حرفًا داخل `public/data/roots.json` في الحقل `notice` وتُعرض في واجهة «إحصاء الجذور».
  بطاقة SHA-256 لملف المصدر:
  `A1D12923815341FACE765083805D2148ED2D9F5CC3F7D6665219D887675D8C46`
- **Tanzil** — https://tanzil.net/download/ (نص المصحف برسم عثماني، الموجود أصلًا في الموقع).
- **أرشيف الإنترنت (Internet Archive)** — https://archive.org/ — مصدر الكتب في `public/data/encyclopedia.json`.
  الرخصة تبقى على عاتق العمل الأصلي لكل كتاب؛ فلا يعيد الموقع نشر النصوص، بل يشير إلى موضعها المفتوح، ويحفظ حقل `copyrightStatus: unknown` كما هو.
- **الموسوعة القرآنية (Quranpedia)** — https://quranpedia.net — مصدر الكتب الثاني في `encyclopedia.json`.

## ملاحظات منهجية

- لا يُشتق أي جذر من تشابه الحروف؛ كل جذر من عمود `ROOT` في المصدر.
- المواضع تُحاذى مع كلمات نص الموقع (مع علامات: بلاحقة / يحتاج مراجعة).
- كل أرقام واجهة «إحصاء القرآن» تُحسب لحظيًا في المتصفح من `data/quran-uthmani.json`، ولا شيء منها مكتوب يدويًا.
