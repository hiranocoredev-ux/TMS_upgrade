const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, 'src/views/FinanceOverview.vue'), 'utf8');
const line = s.split(/\r?\n/)[972];
const idx = line.indexOf('title-icon">') + 'title-icon">'.length;
const end = line.indexOf('</span>', idx);
const inner = line.slice(idx, end);
for (const c of inner) {
  console.log(c, c.codePointAt(0).toString(16));
}
