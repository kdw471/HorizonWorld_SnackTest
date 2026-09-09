/*
 * 스크립트 루트의 .ts 에서 주석을 걷어내고, 걷어낸 내용을
 * Documents/생성 문서/ScriptDesc/<스크립트>.md 로 보존한다.
 *
 * Horizon 에디터는 스크립트 루트의 .ts 총 용량에 상한을 두고, 넘어서면 스크립트를
 * 말없이 삭제한다. 주석이 전체의 약 24% 를 차지했기 때문에 코드에서 분리했다.
 * 배경은 Documents/생성 문서/가이드/타입체크와_테스트_실행.md §3.1 을 본다.
 *
 * 언제 다시 돌리나
 *   - build_*.py 로 *_FieldData.ts 를 재생성한 뒤 (템플릿에 남은 인라인 주석을 걷어낸다)
 *   - 주석이 붙은 코드를 새로 받아 온 뒤
 *
 * 사용법 (스크립트 루트에서)
 *   node Documents/Tools/strip_comments.js --dry   # 보고만 한다
 *   node Documents/Tools/strip_comments.js         # 실제로 고쳐 쓴다
 *
 * 안전장치
 *   - TypeScript 스캐너를 쓰므로 문자열·템플릿·정규식 리터럴을 주석으로 오인하지 않는다.
 *   - 주석이 하나도 없는 파일은 기존 ScriptDesc 문서를 덮어쓰지 않는다
 *     (이미 걷어낸 파일을 다시 돌려도 아카이브가 비워지지 않는다).
 *   - 원본의 줄바꿈(CRLF/LF)을 그대로 유지한다.
 *
 * 검증: 걷어내기 전후로 `tsc --removeComments` 결과 JS 가 바이트 단위로 같아야 한다.
 */
const fs = require('fs');
const path = require('path');

const SCRIPTS = path.resolve(__dirname, '..', '..');
const DOCDIR = path.join(SCRIPTS, 'Documents', '생성 문서', 'ScriptDesc');
const DRY = process.argv.includes('--dry');
const ts = require(path.join(SCRIPTS, 'node_modules', 'typescript'));

const GENERATED_GUARD = '// 자동 생성 파일 - 직접 수정 금지. 생성기: Documents/Tools/build_fielddata.py';

function commentMask(text) {
    const mask = new Uint8Array(text.length);
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
    let token;
    while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
        if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
            for (let i = scanner.getTokenPos(); i < scanner.getTextPos(); i++) mask[i] = 1;
        }
    }
    return mask;
}

function cleanCommentLines(raw) {
    return raw
        .replace(/\r/g, '')
        .split('\n')
        .map(l => l.replace(/^\s*\/\*+/, '').replace(/\*+\/\s*$/, '').replace(/^\s*\*\s?/, '').replace(/^\s*\/\/\s?/, ''))
        .map(l => l.replace(/\s+$/, ''));
}

function processFile(file) {
    const text = fs.readFileSync(path.join(SCRIPTS, file), 'utf8');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const mask = commentMask(text);

    const info = [];
    let pos = 0;
    for (const line of text.split(/\r?\n/)) {
        const start = pos;
        pos += line.length + eol.length;
        let code = '', commentRaw = '';
        for (let i = 0; i < line.length; i++) {
            if (mask[start + i]) commentRaw += line[i];
            else code += line[i];
        }
        info.push({
            code: code.replace(/\s+$/, ''),
            commentRaw,
            hadContent: line.trim().length > 0,
            hasCode: code.trim().length > 0,
        });
    }

    const kept = [];
    for (const it of info) {
        if (it.hadContent && !it.hasCode) continue;
        kept.push(it.code);
    }
    const out = [];
    for (const l of kept) {
        if (l === '' && out.length && out[out.length - 1] === '') continue;
        out.push(l);
    }
    while (out.length && out[0] === '') out.shift();
    while (out.length && out[out.length - 1] === '') out.pop();
    if (/_FieldData\.ts$/.test(file)) out.unshift(GENERATED_GUARD, '');

    const stripped = out.join(eol) + eol;

    const blocks = [];
    let i = 0, seenCode = false;
    while (i < info.length) {
        const it = info[i];
        if (it.hadContent && !it.hasCode) {
            const startLine = i;
            const body = [];
            while (i < info.length && info[i].hadContent && !info[i].hasCode) body.push(info[i++].commentRaw);
            let anchor = null;
            for (let j = i; j < info.length; j++) if (info[j].hasCode) { anchor = info[j].code.trim(); break; }
            blocks.push({
                line: startLine + 1,
                anchor: anchor || '(파일 끝)',
                leading: !seenCode,
                body: cleanCommentLines(body.join('\n')),
            });
            continue;
        }
        if (it.hasCode) {
            seenCode = true;
            if (it.commentRaw.trim().length > 0) {
                blocks.push({ line: i + 1, anchor: it.code.trim(), trailing: true, body: cleanCommentLines(it.commentRaw) });
            }
        }
        i++;
    }

    return {
        file, stripped, blocks,
        before: Buffer.byteLength(text, 'utf8'),
        after: Buffer.byteLength(stripped, 'utf8'),
    };
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function renderDoc(r) {
    const L = [];
    L.push('# ' + r.file + ' — 주석 아카이브');
    L.push('');
    L.push('> 원본 스크립트: `' + r.file + '`');
    L.push('> 걷어낸 주석 ' + r.blocks.length + '건 / ' + (r.before - r.after).toLocaleString('en-US') +
        ' B 절감 (' + r.before.toLocaleString('en-US') + ' B → ' + r.after.toLocaleString('en-US') + ' B)');
    L.push('>');
    L.push('> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.');
    L.push('> 그래서 설명은 코드가 아니라 이 문서에 둔다.');
    L.push('> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.');
    L.push('');
    L.push('---');
    L.push('');
    for (const b of r.blocks) {
        L.push('## ' + (b.leading ? '파일 머리말' : '`' + truncate(b.anchor, 110) + '`'));
        L.push('');
        L.push('> 원본 L' + b.line + (b.trailing ? ' (코드 뒤 붙은 주석)' : ''));
        L.push('');
        const body = b.body.slice();
        while (body.length && body[0].trim() === '') body.shift();
        while (body.length && body[body.length - 1].trim() === '') body.pop();
        for (const line of body) L.push(/^#{1,4} /.test(line) ? '##' + line : line);
        L.push('');
    }
    return L.join('\n');
}

const files = fs.readdirSync(SCRIPTS).filter(f => f.endsWith('.ts')).sort();
const results = files.map(processFile);

let beforeTotal = 0, afterTotal = 0, blockTotal = 0, docsWritten = 0, docsKept = 0;
for (const r of results) { beforeTotal += r.before; afterTotal += r.after; blockTotal += r.blocks.length; }

if (!DRY) {
    fs.mkdirSync(DOCDIR, { recursive: true });
    for (const r of results) {
        fs.writeFileSync(path.join(SCRIPTS, r.file), r.stripped, 'utf8');
        const docPath = path.join(DOCDIR, r.file.replace(/\.ts$/, '.md'));
        // 주석이 없으면 기존 아카이브를 지우지 않는다 - 이미 걷어낸 파일을 다시 돌린 경우다.
        if (r.blocks.length === 0 && fs.existsSync(docPath)) { docsKept++; continue; }
        fs.writeFileSync(docPath, renderDoc(r) + '\n', 'utf8');
        docsWritten++;
    }
}

console.log('files          :', results.length);
console.log('comment blocks :', blockTotal);
console.log('before / after :', beforeTotal, '/', afterTotal);
console.log('saved          :', beforeTotal - afterTotal,
    '(' + (beforeTotal ? ((beforeTotal - afterTotal) / beforeTotal * 100).toFixed(1) : '0') + '%)');
if (!DRY) console.log('docs written   :', docsWritten, '/ kept as-is:', docsKept);
console.log(DRY ? '(dry run - nothing written)' : 'written');
