/*
 * 스크립트 루트의 .ts 파일과 .editor 레지스트리가 어긋났는지 본다.
 *
 * Horizon 에디터는 월드의 스크립트 카탈로그(클라우드)를 원본으로 삼아 로컬 폴더를
 * 주기적으로 대조하고, 카탈로그에 없는 로컬 .ts 를 삭제한다. `.editor` 는 그 카탈로그의
 * 로컬 사본이다. 따라서
 *
 *   디스크에 있는데 .editor 에 없는 파일  -> 다음 대조 때 삭제된다 (위험)
 *   .editor 에 있는데 디스크에 없는 파일  -> 컴파일이 깨진다 (끊어진 참조)
 *
 * 파일을 되돌려 놓기만 해서는 카탈로그 항목이 생기지 않는다. 에디터가 떠 있을 때는
 * 파일 추가를 실시간으로 감지해 등록해 주기도 하지만, 재시작 시점의 대조에서는
 * 카탈로그가 이긴다. **에디터 UI 의 스크립트 목록에서 직접 추가**해야 확실하다.
 *
 * 사용법 (스크립트 루트에서)
 *   node Documents/Tools/check_registry.js
 *
 * 배경: Documents/생성 문서/가이드/타입체크와_테스트_실행.md §3.1
 */
const fs = require('fs');
const path = require('path');

const SCRIPTS = path.resolve(__dirname, '..', '..');
const EDITOR = path.join(SCRIPTS, '.editor');

if (!fs.existsSync(EDITOR)) {
    console.error('.editor 를 찾을 수 없다: ' + EDITOR);
    process.exit(2);
}

const registry = JSON.parse(fs.readFileSync(EDITOR, 'utf8'));
const onDisk = fs.readdirSync(SCRIPTS)
    .filter(f => f.endsWith('.ts'))
    .map(f => f.slice(0, -3));

const registered = new Set(Object.keys(registry));
const disk = new Set(onDisk);

const atRisk = onDisk.filter(n => !registered.has(n)).sort();
const dangling = Object.keys(registry).filter(n => !disk.has(n)).sort();

const bytes = onDisk.reduce((s, n) => s + fs.statSync(path.join(SCRIPTS, n + '.ts')).size, 0);

console.log('.editor mtime :', fs.statSync(EDITOR).mtime.toISOString());
console.log('registry      :', registered.size, 'entries');
console.log('on disk       :', disk.size, 'files /', bytes.toLocaleString('en-US'), 'B');
console.log('');

if (atRisk.length) {
    console.log('[위험] 디스크에만 있고 카탈로그에 없다 - 다음 대조 때 삭제된다:');
    for (const n of atRisk) console.log('   ' + n + '.ts');
    console.log('   -> 에디터 UI 의 스크립트 목록에서 직접 추가한다.');
    console.log('');
}
if (dangling.length) {
    console.log('[깨짐] 카탈로그에만 있고 디스크에 없다 - 컴파일이 깨진다:');
    for (const n of dangling) console.log('   ' + n);
    console.log('   -> .backups/<이름>.ts/ 에서 되살리거나 에디터에서 항목을 지운다.');
    console.log('');
}
if (!atRisk.length && !dangling.length) {
    console.log('일치한다. 어긋난 항목이 없다.');
}

const backups = path.join(SCRIPTS, '.backups');
if (fs.existsSync(backups)) {
    const entries = fs.readdirSync(backups);
    if (entries.length) {
        console.log('최근 삭제 백업 (.backups/) - 영구 보관이 아니다, 필요하면 바로 꺼낸다:');
        for (const e of entries) {
            for (const f of fs.readdirSync(path.join(backups, e))) {
                console.log('   ' + e + '/' + f);
            }
        }
    }
}

process.exit(atRisk.length || dangling.length ? 1 : 0);
