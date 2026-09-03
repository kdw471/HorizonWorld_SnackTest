"""NPUZ_06 (카드 맞추기 퍼즐) -> CardMatch_FieldData.ts"""

import collections

from dt_common import banner, read_table, parse_index, write_ts

# 기획 CSV 행에 붙일 index 시작값.
# 구현이 원래 들고 있던 기본 필드 행(1~5)과 겹치지 않게 100 부터 쓴다.
CSV_INDEX_BASE = 100


def build():
    keys, _labels, rows = read_table('NPUZ_06_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_06_ObjectData.csv')

    group_col = keys.index('iObjectGroupID')
    x_col = keys.index('iXArrayNum')
    y_col = keys.index('iYArrayNum')
    bomb_col = keys.index('iBombNum')

    o_group_col = okeys.index('iObjectGroupID')
    o_mesh_col = okeys.index('sStaticMeshPath')
    o_size_col = okeys.index('sObjectSize')

    group_sizes = collections.Counter(r[o_group_col].strip() for r in orows)

    problems = []
    empty_rows = []
    levels = []

    for row in rows:
        index = row[0]
        _category, difficulty, _order = parse_index(index)
        group = row[group_col].strip()
        tiles_x = int(row[x_col])
        tiles_y = int(row[y_col])
        bombs = int(row[bomb_col])

        # 아직 채워지지 않은 행 (그룹/배열이 전부 0)
        if group == '0' and tiles_x == 0 and tiles_y == 0:
            empty_rows.append(index)
            continue

        tile_count = tiles_x * tiles_y
        object_tiles = tile_count - bombs
        if object_tiles <= 0:
            problems.append('%s: %d tiles with %d bombs leaves no object tile' % (index, tile_count, bombs))
            continue
        if object_tiles % 2 != 0:
            problems.append('%s: object tiles must be even (got %d from %dx%d with %d bombs)'
                            % (index, object_tiles, tiles_x, tiles_y, bombs))
        pairs = object_tiles // 2
        if group not in group_sizes:
            problems.append('%s: object group %s is not in the object table' % (index, group))
        elif group_sizes[group] < pairs:
            problems.append('%s: group %s has only %d objects but the field needs %d pairs'
                            % (index, group, group_sizes[group], pairs))

        levels.append((index, difficulty, group, tiles_x, tiles_y, bombs, object_tiles))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    field_lines = []
    for offset, (index, difficulty, group, tiles_x, tiles_y, bombs, object_tiles) in enumerate(levels):
        field_lines.append(
            "\t{ index: %d, puzzleId: '%s', difficulty: %d, objectGroupId: 'GROUP_%s', "
            "tileArrayX: %d, tileArrayY: %d, bombTile: %d, objectTile: %d },"
            % (CSV_INDEX_BASE + offset, index, difficulty, group, tiles_x, tiles_y, bombs, object_tiles))

    object_lines = []
    for r in orows:
        group = r[o_group_col].strip()
        object_lines.append("\t{ objectId: '%s', groupId: 'GROUP_%s', meshPath: '%s', levelSize: %s },"
                            % (r[0], group, r[o_mesh_col].strip().replace("'", "\\'"), r[o_size_col].strip() or '1'))

    difficulty_counts = collections.Counter(d for _i, d, _g, _x, _y, _b, _o in levels)
    layout_counts = collections.Counter('%dx%d' % (x, y) for _i, _d, _g, x, y, _b, _o in levels)

    text = banner(
        ['NPUZ_06_FieldData.csv', 'NPUZ_06_ObjectData.csv'],
        """
카드 맞추기 퍼즐(PUZ_06) 기획 필드 테이블 %d판 (원본 %d행 중 %d행은 아직 값이 비어 있어 제외).
난이도별 판 수: %s
배치별 판 수: %s
오브젝트 그룹별 종류 수: %s

원본 CSV 는 배치를 직접 적지 않고 **필드 규격**만 담는다.
(오브젝트 그룹 ID / X열 / Y열 / 폭탄 수) 실제 타일 배치와 짝 배정은 런타임 생성기가 만든다.
""" % (len(levels), len(rows), len(empty_rows),
       ', '.join('D%d %d판' % (d, difficulty_counts[d]) for d in sorted(difficulty_counts)),
       ', '.join('%s %d판' % (k, v) for k, v in sorted(layout_counts.items())),
       ', '.join('GROUP_%s %d종' % (g, n) for g, n in sorted(group_sizes.items()))))

    text += """// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { CardFieldTableEntry } from 'CardMatch_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type CardMatchCsvObjectRow = {
\tobjectId: string,
\t/** GROUP_0 은 폭탄(함정), GROUP_1~4 는 챕터별 오브젝트 세트 */
\tgroupId: string,
\tmeshPath: string,
\tlevelSize: number,
}

/** NPUZ_06_ObjectData.csv 전체 (%d행) */
export const CARDMATCH_CSV_OBJECT_ROWS: CardMatchCsvObjectRow[] = [
%s
];

/**
 * NPUZ_06_FieldData.csv 에서 값이 채워진 %d행.
 *
 * `index` 는 구현이 원래 들고 있던 기본 행(1~5)과 겹치지 않도록 %d 부터 매긴다.
 * `puzzleId` 는 원본 인덱스를 그대로 쓴다.
 */
export const CARDMATCH_CSV_FIELD_TABLE: CardFieldTableEntry[] = [
%s
];
""" % (len(object_lines), '\n'.join(object_lines), len(field_lines), CSV_INDEX_BASE, '\n'.join(field_lines))

    write_ts('CardMatch_FieldData.ts', text)

    print('  levels: %d (skipped %d empty rows), difficulties: %s'
          % (len(levels), len(empty_rows), sorted(difficulty_counts)))
    if empty_rows:
        print('  ~ empty rows (group/array all zero): %s' % ' '.join(empty_rows[:6])
              + (' ...' if len(empty_rows) > 6 else ''))
    if problems:
        print('  !! %d problem(s):' % len(problems))
        for p in problems[:20]:
            print('     ' + p)
    else:
        print('  no problems')
    return len(levels), problems


if __name__ == '__main__':
    build()
