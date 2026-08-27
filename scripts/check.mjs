import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['server.mjs', 'public/app.js', 'scripts/parser.mjs', 'scripts/problem-pack.mjs', 'scripts/validate-pack.mjs', 'scripts/build-data.mjs', 'scripts/build-assembly-from-samples.mjs', 'scripts/build.mjs'];
let failed = false;
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\t|[ \\t]+$/m.test(text)) { console.error(`${file}: 탭 또는 줄 끝 공백이 있습니다.`); failed = true; }
  if (file.startsWith('public/') && /OPENAI_API_KEY|GITHUB_REPORT_TOKEN|gh[pousr]_[A-Za-z0-9]|sk-[A-Za-z0-9]/.test(text)) { console.error(`${file}: 클라이언트에 API 키 또는 토큰 관련 문자열이 있습니다.`); failed = true; }
}
if (failed) process.exit(1);
console.log('정적 검사 통과');
