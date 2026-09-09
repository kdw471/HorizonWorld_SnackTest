"""
Documents/기획서 및 데이터 구조/DataTable/*.csv -> scripts/<Puzzle>_FieldData.ts 변환기 공통 모듈.

기획팀이 CSV 를 갱신하면 `python Documents/Tools/build_fielddata.py` 한 번으로
모든 퍼즐의 `<Puzzle>_FieldData.ts` 를 다시 생성한다. 생성 파일은 손으로 고치지 않는다.

CSV 공통 규격
-------------
  1행: "/" 더미 행 (기획 스프레드시트의 csv 출력 버튼)
  2행: 컬럼 키   (sA1, #Difficulty ...)
  3행: 한글 설명
  4행~: 데이터

인덱스 10자리: 80 + 0 + PUZCategory(2) + Difficulty(2) + Order(3)
"""

import csv
import io
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATATABLE_DIR = os.path.join(ROOT, 'Documents', '기획서 및 데이터 구조', 'DataTable')

FREE = 'FREE'


def read_table(name):
    """CSV 한 장을 (keys, labels, rows) 로 읽는다. UTF-8 실패 시 CP949 로 재시도."""
    path = os.path.join(DATATABLE_DIR, name)
    raw = open(path, 'rb').read()
    for encoding in ('utf-8-sig', 'cp949'):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise RuntimeError('cannot decode ' + name)

    rows = list(csv.reader(io.StringIO(text)))
    keys = [k.strip() for k in rows[1]]
    labels = [k.strip() for k in rows[2]]
    data = [r for r in rows[3:] if r and r[0].strip().isdigit()]
    return keys, labels, data


def col_index(keys, name):
    return keys.index(name)


def parse_index(index):
    """10자리 인덱스를 (category, difficulty, order) 로 쪼갠다."""
    return int(index[3:5]), int(index[5:7]), int(index[7:10])


def grid_columns(keys, prefix='s', rows='ABCDEFG', cols=7):
    """sA1..sG7 형태의 좌표 컬럼을 [(csv_index, row, col)] 로 돌려준다."""
    out = []
    for r, letter in enumerate(rows):
        for c in range(1, cols + 1):
            key = '%s%s%d' % (prefix, letter, c)
            if key in keys:
                out.append((keys.index(key), r, c - 1))
    return out


def cell_name(row, col):
    return '%s%d' % ('ABCDEFG'[row], col + 1)


DESC_DIR = os.path.join(ROOT, 'Documents', '생성 문서', 'ScriptDesc')

# banner() 가 담아 두고 바로 뒤따르는 write_ts() 가 꺼내 쓴다.
# 각 build_*.py 는 banner() 한 번 뒤에 write_ts() 한 번을 부르는 구조라 이 짝이 성립한다.
_pending_desc = None


def write_ts(filename, text):
    path = os.path.join(ROOT, filename)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('  -> %s (%d bytes)' % (filename, len(text.encode('utf-8'))))
    _write_desc_doc(filename)


def _write_desc_doc(filename):
    """생성 파일의 설명을 ScriptDesc 문서로 내보낸다.

    Horizon 에디터는 스크립트 루트의 .ts 총 용량에 상한을 두고 넘으면 스크립트를
    말없이 지운다. 그래서 설명은 .ts 안이 아니라 이 문서에 둔다.
    """
    global _pending_desc
    if _pending_desc is None:
        return
    source_files, description = _pending_desc
    _pending_desc = None

    os.makedirs(DESC_DIR, exist_ok=True)
    name = filename[:-3] if filename.endswith('.ts') else filename
    lines = [
        '# %s — 주석 아카이브' % filename,
        '',
        '> 원본 스크립트: `%s` (자동 생성)' % filename,
        '> 생성기: `Documents/Tools/build_fielddata.py`',
        '> 원본 데이터: %s' % ', '.join(
            '`Documents/기획서 및 데이터 구조/DataTable/%s`' % s for s in source_files),
        '>',
        '> Horizon 에디터는 스크립트 루트의 `.ts` 총 용량에 상한을 둔다. 넘어서면 스크립트를',
        '> 말없이 삭제하므로, 설명을 코드에서 분리해 이 문서로 옮겼다.',
        '> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 을 본다.',
        '',
        '---',
        '',
        '## 파일 머리말',
        '',
    ]
    lines.extend(description.strip().split('\n'))
    lines.append('')
    with open(os.path.join(DESC_DIR, name + '.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
    print('  -> ScriptDesc/%s.md' % name)


def banner(source_files, description):
    """생성 파일의 머리말. 한 줄 경고만 남기고 설명은 ScriptDesc 문서로 보낸다."""
    global _pending_desc
    _pending_desc = (list(source_files), description)
    return '// 자동 생성 파일 - 직접 수정 금지. 생성기: Documents/Tools/build_fielddata.py\n\n'
