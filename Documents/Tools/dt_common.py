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


def write_ts(filename, text):
    path = os.path.join(ROOT, filename)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('  -> %s (%d bytes)' % (filename, len(text.encode('utf-8'))))


def banner(source_files, description):
    lines = [
        '/**',
        ' * !!! 자동 생성 파일 — 직접 수정하지 말 것 !!!',
        ' *',
        ' * 생성기: Documents/Tools/build_fielddata.py',
        ' * 원본  : ' + ', '.join('Documents/기획서 및 데이터 구조/DataTable/' + s for s in source_files),
        ' *',
    ]
    for line in description.strip().split('\n'):
        lines.append(' * ' + line if line else ' *')
    lines.append(' */')
    lines.append('')
    return '\n'.join(lines)
