"""NPUZ_04 (색 채우기 퍼즐) -> ColorFill_FieldData.ts"""

import collections

from dt_common import banner, read_table, parse_index, write_ts

DIAL_SLOT_COUNT = 18


def layout(group_sizes):
    """오염 덩어리들을 18칸 다이얼 위에 고르게 배치한다.

    돌아오는 값은 18칸짜리 리스트로, 각 칸은 True(오염) 또는 False(비활성)다.
    덩어리 사이에는 최소 한 칸을 비워야 하나로 붙지 않는다. 빈 칸이 모자라면
    (= sum(group_sizes) + len(group_sizes) > 18) 붙는 덩어리가 생기며 호출부가 경고한다.
    """
    total = sum(group_sizes)
    gap_budget = DIAL_SLOT_COUNT - total
    count = len(group_sizes)

    if gap_budget >= count:
        gaps = [gap_budget // count] * count
        for i in range(gap_budget % count):
            gaps[i] += 1
    else:
        # 빈 칸이 덩어리 수보다 적다 - 앞에서부터 한 칸씩 주고 나머지는 0
        gaps = [1] * gap_budget + [0] * (count - gap_budget)

    slots = []
    for size, gap in zip(group_sizes, gaps):
        slots.extend([True] * size)
        slots.extend([False] * gap)
    return slots[:DIAL_SLOT_COUNT]


def build():
    keys, _labels, rows = read_table('NPUZ_04_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_04_ObjectData.csv')
    mesh_paths = {r[0]: r[okeys.index('sStaticMeshPath')].strip() for r in orows}
    descriptions = {r[0]: r[okeys.index('#Description')].strip() for r in orows}

    divide_col = keys.index('sObjectDivideID')
    count_col = keys.index('iCount')
    speed_col = keys.index('iRotateSpeed')

    problems = []
    levels = []
    round_counts = set()

    for row in rows:
        index = row[0]
        _category, difficulty, _order = parse_index(index)

        group_sizes = [int(x) for x in row[divide_col].split('/')]
        speed = int(row[speed_col])
        round_counts.add(int(row[count_col]))

        total = sum(group_sizes)
        if total + len(group_sizes) > DIAL_SLOT_COUNT:
            problems.append('%s: %d contaminated cells in %d groups do not fit on an %d slot dial '
                            '(groups will touch)' % (index, total, len(group_sizes), DIAL_SLOT_COUNT))
        if total > DIAL_SLOT_COUNT:
            problems.append('%s: contaminated cells (%d) exceed the dial size' % (index, total))
        if speed <= 0:
            problems.append('%s: rotation speed is %d' % (index, speed))

        slots = layout(group_sizes)
        if sum(1 for s in slots if s) != total:
            problems.append('%s: only %d of %d contaminated cells could be placed'
                            % (index, sum(1 for s in slots if s), total))

        levels.append((index, difficulty, slots, speed, group_sizes))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    raw_lines = []
    for index, _difficulty, slots, speed, _groups in levels:
        bits = ''.join('1' if s else '0' for s in slots)
        raw_lines.append("\t'%s|%s|%d'," % (index, bits, speed))

    object_lines = []
    for r in orows:
        object_id = r[0]
        object_lines.append("\t{ objectId: '%s', category: '%s', color: '%s', meshPath: '%s', description: '%s' },"
                            % (object_id, object_id[3:5], object_id[5:7],
                               mesh_paths[object_id].replace("'", "\\'"),
                               descriptions[object_id].replace("'", "\\'")))

    difficulty_counts = collections.Counter(d for _i, d, _s, _sp, _g in levels)
    speeds = {}
    for _i, d, _s, sp, _g in levels:
        speeds.setdefault(d, set()).add(sp)

    text = banner(
        ['NPUZ_04_FieldData.csv', 'NPUZ_04_ObjectData.csv'],
        """
색 채우기 퍼즐(PUZ_04) 기획 필드 테이블 %d판.
난이도별 판 수: %s
난이도별 바늘 속도(도/초): %s
라운드 수(iCount): %s

인코딩: `인덱스|다이얼18칸|바늘속도`
  다이얼 : 18글자. '1' 오염(=활성) 칸 / '0' 비활성 칸
  바늘속도: 초당 회전 각도

원본 CSV 의 `sObjectDivideID` 는 "6/7" 처럼 **오염 덩어리 각각의 칸 수**만 담고 있고
어느 각도에 놓이는지는 없다. 변환기가 덩어리 사이 간격을 최대한 고르게 벌려 18칸 위에 배치했다.
활성 영역은 오염 칸과 같게 잡는다 (기획 데이터에 "활성이지만 깨끗한 칸" 정보가 없다).
""" % (len(levels),
       ', '.join('D%d %d판' % (d, difficulty_counts[d]) for d in sorted(difficulty_counts)),
       ', '.join('D%d %s' % (d, '/'.join(str(x) for x in sorted(speeds[d]))) for d in sorted(speeds)),
       ', '.join(str(x) for x in sorted(round_counts))))

    text += """import {
\tDIAL_SLOT_COUNT,
\tDialSlot,
\tESlotState,
} from 'ColorFill_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { ColorFillFieldTableEntry } from 'ColorFill_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type ColorFillCsvObjectRow = {
\tobjectId: string,
\t/** 01 활성화 다이얼 / 02 비활성화 다이얼 */
\tcategory: string,
\tcolor: string,
\tmeshPath: string,
\tdescription: string,
}

/** NPUZ_04_ObjectData.csv 전체 (%d행) */
export const COLORFILL_CSV_OBJECT_ROWS: ColorFillCsvObjectRow[] = [
%s
];

/** NPUZ_04_FieldData.csv 전체 (%d행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
%s
];

/**
 * 방향 전환 딜레이(초). 기획 CSV 에 없는 값이라 난이도별로 여기서 준다 - §6.
 * 난이도가 올라갈수록 바늘이 빨라지므로 딜레이도 조금씩 늘린다.
 */
const REVERSE_DELAY_BY_DIFFICULTY: number[] = [0.3, 0.3, 0.35, 0.35, 0.4, 0.4];

function decodeLevel(raw: string): ColorFillFieldTableEntry {
\tconst parts = raw.split('|');
\tconst puzzleId = parts[0];
\t// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
\tconst difficulty = parseInt(puzzleId.substring(5, 7), 10);

\tconst slots: DialSlot[] = [];
\tlet contaminatedCount = 0;
\tfor (let index = 0; index < DIAL_SLOT_COUNT; index++) {
\t\tconst isContaminated = parts[1].charAt(index) === '1';
\t\tif (isContaminated) {
\t\t\tcontaminatedCount++;
\t\t}
\t\tslots.push({
\t\t\tindex: index,
\t\t\t// 활성 영역 == 오염 영역 (원본에 "활성이지만 깨끗한 칸" 정보가 없다)
\t\t\tisActive: isContaminated,
\t\t\tstate: isContaminated ? ESlotState.CONTAMINATED : ESlotState.CLEAN,
\t\t});
\t}

\treturn {
\t\tpuzzleId: puzzleId,
\t\tdifficulty: difficulty,
\t\tslots: slots,
\t\tneedleSpeedDegPerSec: parseInt(parts[2], 10),
\t\treverseDelaySeconds: REVERSE_DELAY_BY_DIFFICULTY[difficulty - 1] ?? 0.4,
\t\tstartAngleDeg: 0,
\t\tcontaminatedCount: contaminatedCount,
\t};
}

/** 기획 CSV 에서 뽑은 색 채우기 필드 테이블 (%d판) */
export const COLORFILL_CSV_FIELD_TABLE: ColorFillFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
""" % (len(object_lines), '\n'.join(object_lines), len(raw_lines), '\n'.join(raw_lines), len(levels))

    write_ts('ColorFill_FieldData.ts', text)

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
