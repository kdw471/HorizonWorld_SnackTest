"""NPUZ_08 (스위치 퍼즐) -> Switch_FieldData.ts"""

import collections
import json
import os

from dt_common import banner, read_table, parse_index, write_ts

# 기획 CSV 행에 붙일 index 시작값 (구현 기본 행 1~5 와 겹치지 않게)
CSV_INDEX_BASE = 100

BOARD = 5
# 필드 셀 값: 0 안 눌림 / 1 눌림(목표 상태) / 2 FREE
FREE_VALUE = 2


def load_minimum_presses():
    """GF(2) 로 미리 구해 둔 최소 누름 수. 없으면 빈 사전."""
    path = os.path.join(os.path.dirname(__file__), 'switch_minpresses.json')
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def build():
    minimum_presses = load_minimum_presses()

    keys, _labels, rows = read_table('NPUZ_08_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_08_ObjectData.csv')

    stamp_col = keys.index('sStamp')
    cell_cols = [keys.index('i%s%d' % (r, c)) for r in 'ABCDE' for c in range(1, BOARD + 1)]

    masks = {r[0]: [int(r[i]) for i in range(1, 10)] for r in orows}

    problems = []
    levels = []

    for row in rows:
        index = row[0]
        _category, difficulty, _order = parse_index(index)
        stamp = row[stamp_col].strip()
        state = [int(row[c]) for c in cell_cols]

        if stamp not in masks:
            problems.append('%s: stamp %s is not in the object table' % (index, stamp))
            continue
        if masks[stamp][4] != 1:
            # 중앙이 0 이면 누른 칸 자신이 안 바뀌어 규칙이 깨진다 (§6)
            problems.append('%s: stamp %s has no centre bit' % (index, stamp))

        usable = [s for s in state if s != FREE_VALUE]
        if len(usable) < 2:
            problems.append('%s: only %d key caps' % (index, len(usable)))
        if all(s != 0 for s in usable):
            problems.append('%s: already completed at start' % index)

        press_count = minimum_presses.get(index, -1)
        if press_count < 0:
            problems.append('%s: no verified minimum press count (unsolvable, or the json is stale)' % index)

        layout_rows = []
        initial_rows = []
        for r in range(BOARD):
            layout = ''
            initial = ''
            for c in range(BOARD):
                value = state[r * BOARD + c]
                layout += '.' if value == FREE_VALUE else 'O'
                initial += '.' if value == FREE_VALUE else str(value)
            layout_rows.append(layout)
            initial_rows.append(initial)

        levels.append((index, difficulty, stamp, layout_rows, initial_rows, press_count, len(usable)))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    field_lines = []
    for offset, (index, difficulty, stamp, layout_rows, initial_rows, press_count, _usable) in enumerate(levels):
        field_lines.append(
            "\t{\n"
            "\t\tindex: %d, puzzleId: '%s', difficulty: %d, switchAreaId: '%s', shuffleCount: %d,\n"
            "\t\tlayoutRows: [%s],\n"
            "\t\tinitialRows: [%s],\n"
            "\t},"
            % (CSV_INDEX_BASE + offset, index, difficulty, stamp, press_count,
               ', '.join("'%s'" % r for r in layout_rows),
               ', '.join("'%s'" % r for r in initial_rows)))

    object_lines = []
    for r in orows:
        bits = [int(r[i]) for i in range(1, 10)]
        mask_rows = [''.join(str(b) for b in bits[i * 3:(i + 1) * 3]) for i in range(3)]
        object_lines.append("\t{ switchAreaId: '%s', name: '기획 도장 %s', maskRows: [%s] },"
                            % (r[0], r[0][-3:], ', '.join("'%s'" % m for m in mask_rows)))

    difficulty_counts = collections.Counter(d for _i, d, _s, _l, _r, _p, _u in levels)
    press_stats = collections.defaultdict(list)
    usable_stats = collections.defaultdict(list)
    for _i, d, _s, _l, _r, press_count, usable in levels:
        if press_count >= 0:
            press_stats[d].append(press_count)
        usable_stats[d].append(usable)

    text = banner(
        ['NPUZ_08_FieldData.csv', 'NPUZ_08_ObjectData.csv'],
        """
스위치 퍼즐(PUZ_08) 기획 필드 테이블 %d판.
난이도별 (판 수 / 키 캡 수 / 최소 누름 수): %s
도장(3x3 마스크) %d종.

원본 CSV 는 다른 퍼즐과 달리 **초기 눌림 상태를 그대로** 담고 있다.
  0 = 안 눌림(빨강) / 1 = 눌림(녹색, 목표 상태) / 2 = FREE(키 캡 없음)
그래서 이 판들은 역셔플로 만들지 않고 데이터 그대로 로드한다 (`initialRows`).
`shuffleCount` 에는 GF(2) 선형대수로 미리 구한 **최소 누름 수**를 넣었다.
""" % (len(levels),
       ', '.join('D%d (%d판 / %d~%d칸 / %d~%d수)'
                 % (d, difficulty_counts[d], min(usable_stats[d]), max(usable_stats[d]),
                    min(press_stats[d]), max(press_stats[d]))
                 for d in sorted(difficulty_counts)),
       len(orows)))

    text += """// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { SwitchFieldTableEntry, SwitchObjectTableEntry } from 'Switch_DataTables';

/**
 * NPUZ_08_ObjectData.csv 의 도장 %d종.
 * `switchAreaId` 에 원본 오브젝트 ID 를 그대로 쓴다.
 */
export const SWITCH_CSV_OBJECT_TABLE: SwitchObjectTableEntry[] = [
%s
];

/**
 * NPUZ_08_FieldData.csv 전체 (%d행).
 * `index` 는 구현 기본 행(1~5)과 겹치지 않도록 %d 부터 매긴다.
 */
export const SWITCH_CSV_FIELD_TABLE: SwitchFieldTableEntry[] = [
%s
];
""" % (len(object_lines), '\n'.join(object_lines), len(field_lines), CSV_INDEX_BASE, '\n'.join(field_lines))

    write_ts('Switch_FieldData.ts', text)

    print('  levels: %d, difficulties: %s' % (len(levels), sorted(difficulty_counts)))
    if problems:
        print('  !! %d problem(s):' % len(problems))
        for p in problems[:20]:
            print('     ' + p)
    else:
        print('  no problems')
    return len(levels), problems


if __name__ == '__main__':
    build()
