/* فحص صياغة أكواد JavaScript داخل index.html دون تشغيلها */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
let m, i = 0, bad = 0;
while ((m = re.exec(html))) {
  i++;
  const attrs = m[1] || '';
  if (/\ssrc=/.test(attrs)) continue;
  const code = m[2];
  if (!code.trim()) continue;
  try {
    new Function(code);
    console.log('  OK   كتلة #' + i + ' (' + code.length + ' حرفًا)');
  } catch (e) {
    bad++;
    console.log('  FAIL كتلة #' + i + ': ' + e.message);
    const line = (e.stack || '').split('\n')[0];
    console.log('       ' + line);
  }
}
console.log(bad === 0 ? '=== كل الكتل سليمة (' + i + ') ===' : '=== ' + bad + ' كتلة بها خطأ ===');
process.exit(bad ? 1 : 0);
