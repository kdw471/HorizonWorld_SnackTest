"""NPUZ_07 (슬라이드 퍼즐) -> SlidePuzzle_FieldData.ts"""

import collections

from dt_common import banner, read_table, parse_index, write_ts

# 기획 CSV 행에 붙일 index 시작값 (구현 기본 행 1~5 와 겹치지 않게)
CSV_INDEX_BASE = 100

ALLOWED_DIVIDES = (3, 4)


def build():
    keys, _labels, rows = read_table('NPUZ_07_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_07_ObjectData.csv')

    object_col = keys.index('sPUZObjectID')
    divide_col = keys.index('iDivideNum')
    shuffle_col = keys.index('iShuffleNum')
    image_col = okeys.index('sImagePath')

    images = {r[0]: r[image_col].strip() for r in orows}

    problems = []
    levels = []

    for row in rows:
        index = row[0]
        _category, difficulty, _order = parse_index(index)
        object_id = row[object_col].strip()
        divide = int(row[divide_col])
        shuffle = int(row[shuffle_col])

        if object_id not in images:
            problems.append('%s: image %s is not in the object table' % (index, object_id))
        if divide not in ALLOWED_DIVIDES:
            problems.append('%s: divide count %d is not 3 or 4' % (index, divide))
        if shuffle <= 0:
            problems.append('%s: shuffle count is %d' % (index, shuffle))

        levels.append((index, difficulty, object_id, divide, shuffle))

    unused = sorted(set(images.keys()) - set(l[2] for l in levels))
    if unused:
        problems.append('object table has %d image(s) no field row uses: %s' % (len(unused), ' '.join(unused)))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    field_lines = []
    for offset, (index, difficulty, object_id, divide, shuffle) in enumerate(levels):
        field_lines.append(
            "\t{ index: %d, puzzleId: '%s', difficulty: %d, puzzleObjectId: '%s', divideNum: %d, shuffleNum: %d },"
            % (CSV_INDEX_BASE + offset, index, difficulty, object_id, divide, shuffle))

    object_lines = []
    for offset, r in enumerate(orows):
        object_lines.append("\t{ index: %d, puzzleObjectId: '%s', imagePath: '%s' },"
                            % (CSV_INDEX_BASE + offset, r[0], r[image_col].strip().replace("'", "\\'")))

    difficulty_counts = collections.Counter(d for _i, d, _o, _dv, _s in levels)
    by_difficulty = collections.defaultdict(lambda: (set(), set()))
    for _i, d, _o, divide, shuffle in levels:
        by_difficulty[d][0].add(divide)
        by_difficulty[d][1].add(shuffle)

    text = banner(
        ['NPUZ_07_FieldData.csv', 'NPUZ_07_ObjectData.csv'],
        """
슬라이드 퍼즐(PUZ_07) 기획 필드 테이블 %d판.
난이도별 (판 수 / 분할 / 섞는 횟수): %s
이미지 %d장. 각 판이 서로 다른 이미지를 쓴다.

원본 CSV 는 배치를 담지 않는다. (이미지 ID / 분할 개수 / 섞는 횟수) 세 값뿐이고,
실제 조각 배치는 런타임에 **합법 이동만으로 섞어서** 만든다 - 항상 풀 수 있는 배치가 보장된다.
""" % (len(levels),
       ', '.join('D%d (%d판 / %s분할 / %s회)'
                 % (d, difficulty_counts[d],
                    '·'.join(str(x) for x in sorted(by_difficulty[d][0])),
                    '·'.join(str(x) for x in sorted(by_difficulty[d][1])))
                 for d in sorted(difficulty_counts)),
       len(orows)))

    text += """// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { SlideFieldTableEntry, SlideObjectTableEntry } from 'SlidePuzzle_DataTables';

/**
 * NPUZ_07_ObjectData.csv 전체 (%d행).
 * 이 퍼즐은 이미지 하나가 곧 그룹 하나라, `puzzleObjectId` 에 원본 ID 를 그대로 쓴다.
 */
export const SLIDEPUZZLE_CSV_OBJECT_TABLE: SlideObjectTableEntry[] = [
%s
];

/**
 * NPUZ_07_FieldData.csv 전체 (%d행).
 * `index` 는 구현 기본 행(1~5)과 겹치지 않도록 %d 부터 매긴다.
 */
export const SLIDEPUZZLE_CSV_FIELD_TABLE: SlideFieldTableEntry[] = [
%s
];
""" % (len(object_lines), '\n'.join(object_lines), len(field_lines), CSV_INDEX_BASE, '\n'.join(field_lines))

    write_ts('SlidePuzzle_FieldData.ts', text)

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
