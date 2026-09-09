"""NPUZ_08 스위치 퍼즐: GF(2) 로 풀이 가능성과 최소 누름 수를 구한다.

사용법:
    python switch_minpresses.py switch_minpresses.json
    python build_switch.py

키 캡을 누르면 도장(3x3 마스크) 모양대로 XOR 반전된다. 각 칸을 변수로 두고
`A x = (목표 - 현재)` 를 GF(2) 위에서 풀어 해의 존재를 확인하고,
커널을 전수 탐색해 최소 누름 수를 구한다.
"""

import csv
import io
import itertools
import json
import os
import sys

# CSV 폴더 경로는 dt_common 한 곳에서만 관리한다 (폴더를 옮겨도 여기를 고칠 필요가 없다)
from dt_common import DATATABLE_DIR

N = 5


def load(name):
    raw = open(os.path.join(DATATABLE_DIR, name), 'rb').read()
    for enc in ('utf-8-sig', 'cp949'):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            pass
    rows = list(csv.reader(io.StringIO(text)))
    return [k.strip() for k in rows[1]], [r for r in rows[3:] if r and r[0].strip().isdigit()]


okeys, orows = load('NPUZ_08_ObjectData.csv')
masks = {r[0]: [int(r[i]) for i in range(1, 10)] for r in orows}

keys, rows = load('NPUZ_08_FieldData.csv')
cell_cols = [keys.index('i%s%d' % (R, c)) for R in 'ABCDE' for c in range(1, 6)]
stamp_col = keys.index('sStamp')


def solve_level(state, mask):
    """state: 25칸 (0/1/2), mask: 9칸. 돌려주는 값은 (풀림?, 최소 누름 수, 커널 차원)"""
    usable = [i for i in range(25) if state[i] != 2]
    index_of = {p: i for i, p in enumerate(usable)}
    n = len(usable)

    # A[i] = 비트마스크: 변수 j 를 누르면 뒤집히는 칸들
    columns = []
    for p in usable:
        r, c = divmod(p, N)
        bits = 0
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if mask[(dr + 1) * 3 + (dc + 1)] != 1:
                    continue
                nr, nc = r + dr, c + dc
                if not (0 <= nr < N and 0 <= nc < N):
                    continue
                q = nr * N + nc
                if state[q] == 2:
                    continue
                bits |= 1 << index_of[q]
        columns.append(bits)

    target = 0
    for p in usable:
        if state[p] == 0:
            target |= 1 << index_of[p]

    # 가우스 소거 (행 = 칸, 열 = 변수). 열 비트마스크를 행 비트마스크로 바꾼다
    rows_bits = [0] * n
    for j, col in enumerate(columns):
        for i in range(n):
            if col >> i & 1:
                rows_bits[i] |= 1 << j

    aug = [(rows_bits[i], (target >> i) & 1) for i in range(n)]
    pivot_of = {}
    r_index = 0
    for j in range(n):
        pivot = None
        for i in range(r_index, n):
            if aug[i][0] >> j & 1:
                pivot = i
                break
        if pivot is None:
            continue
        aug[r_index], aug[pivot] = aug[pivot], aug[r_index]
        for i in range(n):
            if i != r_index and (aug[i][0] >> j & 1):
                aug[i] = (aug[i][0] ^ aug[r_index][0], aug[i][1] ^ aug[r_index][1])
        pivot_of[j] = r_index
        r_index += 1

    for i in range(r_index, n):
        if aug[i][0] == 0 and aug[i][1] == 1:
            return False, -1, -1  # 모순 -> 풀 수 없다

    free_vars = [j for j in range(n) if j not in pivot_of]
    base = 0
    for j, i in pivot_of.items():
        if aug[i][1]:
            base |= 1 << j

    # 커널 기저
    kernel = []
    for f in free_vars:
        vec = 1 << f
        for j, i in pivot_of.items():
            if aug[i][0] >> f & 1:
                vec |= 1 << j
        kernel.append(vec)

    best = bin(base).count('1')
    if len(kernel) <= 16:
        for k in range(1, len(kernel) + 1):
            for combo in itertools.combinations(kernel, k):
                v = base
                for x in combo:
                    v ^= x
                w = bin(v).count('1')
                if w < best:
                    best = w
    return True, best, len(kernel)


out = {}
unsolvable = []
presolved = []
for row in rows:
    index = row[0]
    state = [int(row[c]) for c in cell_cols]
    mask = masks[row[stamp_col].strip()]
    if all(s != 0 for s in state):
        presolved.append(index)
    ok, best, kdim = solve_level(state, mask)
    if not ok:
        unsolvable.append(index)
        out[index] = -1
    else:
        out[index] = best

print('levels %d | unsolvable %d | already solved at start %d' % (len(rows), len(unsolvable), len(presolved)))
if unsolvable:
    print('  unsolvable:', ' '.join(unsolvable))
if presolved:
    print('  presolved:', ' '.join(presolved))

import collections
by_difficulty = collections.defaultdict(list)
for index, best in out.items():
    if best >= 0:
        by_difficulty[int(index[5:7])].append(best)
for d in sorted(by_difficulty):
    v = sorted(by_difficulty[d])
    print('  D%d %2d판  최소 누름 %d~%d (중앙 %d)' % (d, len(v), v[0], v[-1], v[len(v) // 2]))

if len(sys.argv) > 1:
    with open(sys.argv[1], 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('written', sys.argv[1])
