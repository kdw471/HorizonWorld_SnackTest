"""NPUZ_03 (정렬 퍼즐) -> ColorSort_FieldData.ts"""

import collections

from dt_common import banner, read_table, parse_index, write_ts, FREE

# 오브젝트 ID: 42 + 0 + 유형(2) + 색(2) + 일련번호(3)
#   유형 01 일반 건전지 / 02 블랙(미지) 건전지 / 00 케이스·덮개
#
# 색 코드는 ObjectData 의 설명 컬럼 기준 R O Y G B I V P 8종이다.
# 구현 쪽 EBatteryColor 는 10종이라 아래처럼 대응시킨다.
# (실제로 보이는 색은 오브젝트 테이블의 메쉬 경로가 결정하므로, enum 값은 식별자 역할만 한다)
COLOR_LETTER = {
    '01': 'R',   # 건전지_R -> RED
    '02': 'O',   # 건전지_O -> ORANGE
    '03': 'Y',   # 건전지_Y -> YELLOW
    '04': 'G',   # 건전지_G -> GREEN
    '05': 'B',   # 건전지_B -> BLUE
    '06': 'I',   # 건전지_I (인디고) -> CYAN 슬롯
    '07': 'V',   # 건전지_V (바이올렛) -> PURPLE 슬롯
    '08': 'P',   # 건전지_P -> PINK
}

CASE_COUNT = 8
CASE_CAPACITY = 4
# CSV 의 행 A~D 는 위에서 아래로다. 구현 쪽 배열은 아래 -> 위 순서라 뒤집어 넣는다.
SLOT_ROWS = 'ABCD'


def build():
    keys, _labels, rows = read_table('NPUZ_03_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_03_ObjectData.csv')
    mesh_paths = {r[0]: r[okeys.index('sStaticMeshPath')].strip() for r in orows}
    descriptions = {r[0]: r[okeys.index('#Description')].strip() for r in orows}

    problems = []
    levels = []

    for row in rows:
        index = row[0]
        _category, difficulty, _order = parse_index(index)

        cases = []
        colors = collections.Counter()
        for case_index in range(1, CASE_COUNT + 1):
            is_active = row[keys.index('bCase%d' % case_index)].strip() == '1'
            column = [row[keys.index('s%s%d' % (r, case_index))].strip() for r in SLOT_ROWS]
            stack = []
            for value in column:
                if value == FREE or value == '':
                    continue
                kind, color = value[3:5], value[5:7]
                if color not in COLOR_LETTER:
                    problems.append('%s: unknown color %s (%s)' % (index, color, value))
                    continue
                stack.append(COLOR_LETTER[color] + ('?' if kind == '02' else ''))
                colors[color] += 1

            filled = [v for v in column if v != FREE and v != '']
            if filled and filled != column[:len(filled)]:
                problems.append('%s: case %d has a gap in the stack' % (index, case_index))
            if filled and not is_active:
                problems.append('%s: case %d holds batteries but is inactive' % (index, case_index))
            if len(stack) not in (0, CASE_CAPACITY):
                problems.append('%s: case %d holds %d batteries (expected 0 or %d)'
                                % (index, case_index, len(stack), CASE_CAPACITY))
            # §7 블랙 건전지는 최상단에 올 수 없다 (CSV 의 A행 = 최상단)
            if stack and stack[0].endswith('?'):
                problems.append('%s: case %d starts with an unknown battery on top' % (index, case_index))

            # 구현 쪽은 아래 -> 위 순서
            stack.reverse()
            cases.append((is_active, stack))

        # 색상별 개수가 4의 배수가 아니면 애초에 정렬을 끝낼 수 없다
        for color, count in colors.items():
            if count % CASE_CAPACITY != 0:
                problems.append('%s: color %s appears %d times (not a multiple of %d)'
                                % (index, color, count, CASE_CAPACITY))

        spare = sum(1 for is_active, stack in cases if is_active and not stack)
        if spare < 1:
            problems.append('%s: no spare (empty active) case' % index)

        levels.append((index, difficulty, cases, len(colors)))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    raw_lines = []
    for index, _difficulty, cases, _color_count in levels:
        tokens = []
        for is_active, stack in cases:
            # 비활성 케이스는 '-', 활성 빈 케이스는 '.', 그 외는 아래->위 색 문자열
            tokens.append('-' if not is_active else ('.' if not stack else ''.join(stack)))
        raw_lines.append("\t'%s|%s'," % (index, ';'.join(tokens)))

    object_lines = []
    for r in orows:
        object_id = r[0]
        object_lines.append("\t{ objectId: '%s', category: '%s', color: '%s', meshPath: '%s', description: '%s' },"
                            % (object_id, object_id[3:5], object_id[5:7],
                               mesh_paths[object_id].replace("'", "\\'"),
                               descriptions[object_id].replace("'", "\\'")))

    difficulty_counts = collections.Counter(d for _i, d, _c, _n in levels)
    unknown_counts = collections.Counter()
    for _i, d, cases, _n in levels:
        unknown_counts[d] += sum(1 for _a, stack in cases for b in stack if b.endswith('?'))

    text = banner(
        ['NPUZ_03_FieldData.csv', 'NPUZ_03_ObjectData.csv'],
        """
정렬 퍼즐(PUZ_03) 기획 필드 테이블 %d판.
난이도별 판 수: %s
난이도별 블랙(미지) 건전지 총 개수: %s

인코딩: `인덱스|케이스1;케이스2;...;케이스8`
  케이스 : '-' 비활성 / '.' 활성 빈 케이스(여분) / 그 외는 **아래에서 위로** 쌓인 건전지 색 문자열
  색     : R O Y G B I V P (뒤에 '?' 가 붙으면 블랙(미지) 건전지 - §7)

원본 CSV 는 행 A~D 가 위에서 아래 순서다. 구현 쪽 배열은 아래 -> 위 순서라 뒤집어 넣었다.
(A행에 블랙 건전지가 한 번도 오지 않는 것으로 A = 최상단임을 확인했다 - §7 "최상단에 위치할 수 없다")
""" % (len(levels),
       ', '.join('D%d %d판' % (d, difficulty_counts[d]) for d in sorted(difficulty_counts)),
       ', '.join('D%d %d개' % (d, unknown_counts[d]) for d in sorted(unknown_counts))))

    text += """import {
\tCASE_CAPACITY,
\tBattery,
\tBatteryCase,
\tEBatteryColor,
} from 'ColorSort_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { ColorSortFieldTableEntry } from 'ColorSort_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type ColorSortCsvObjectRow = {
\tobjectId: string,
\t/** 01 일반 건전지 / 02 블랙(미지) 건전지 / 00 케이스·덮개 */
\tcategory: string,
\t/** 01 R ~ 08 P / 00 색 없음 */
\tcolor: string,
\tmeshPath: string,
\tdescription: string,
}

/** NPUZ_03_ObjectData.csv 전체 (%d행) */
export const COLORSORT_CSV_OBJECT_ROWS: ColorSortCsvObjectRow[] = [
%s
];

/** NPUZ_03_FieldData.csv 전체 (%d행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
%s
];

/**
 * 기획 CSV 의 색 코드 -> 구현 색상 enum.
 * 기획 데이터는 R O Y G B I(인디고) V(바이올렛) P 8종을 쓰고 구현은 10종을 정의하고 있어,
 * 인디고/바이올렛을 남는 슬롯에 대응시켰다. 실제로 보이는 색은 오브젝트 테이블의 메쉬가 정한다.
 */
const COLOR_BY_LETTER: { [letter: string]: EBatteryColor } = {
\tR: EBatteryColor.RED,
\tO: EBatteryColor.ORANGE,
\tY: EBatteryColor.YELLOW,
\tG: EBatteryColor.GREEN,
\tB: EBatteryColor.BLUE,
\tI: EBatteryColor.CYAN,
\tV: EBatteryColor.PURPLE,
\tP: EBatteryColor.PINK,
};

function decodeLevel(raw: string): ColorSortFieldTableEntry {
\tconst parts = raw.split('|');
\tconst puzzleId = parts[0];
\t// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
\tconst difficulty = parseInt(puzzleId.substring(5, 7), 10);

\tconst cases: BatteryCase[] = [];
\tconst usedColors: EBatteryColor[] = [];
\tlet activeCaseCount = 0;
\tlet batteryCount = 0;

\tconst tokens = parts[1].split(';');
\tfor (let index = 0; index < tokens.length; index++) {
\t\tconst token = tokens[index];
\t\tconst isActive = token !== '-';
\t\tif (isActive) {
\t\t\tactiveCaseCount++;
\t\t}

\t\tconst batteries: Battery[] = [];
\t\tif (token !== '-' && token !== '.') {
\t\t\tfor (let position = 0; position < token.length; position++) {
\t\t\t\tconst letter = token.charAt(position);
\t\t\t\tif (letter === '?') {
\t\t\t\t\tcontinue;
\t\t\t\t}
\t\t\t\tconst color = COLOR_BY_LETTER[letter];
\t\t\t\t// 색 뒤에 '?' 가 붙어 있으면 블랙(미지) 건전지다 - §7
\t\t\t\tconst isRevealed = token.charAt(position + 1) !== '?';
\t\t\t\tbatteries.push({
\t\t\t\t\tid: `B${index}_${batteries.length}`,
\t\t\t\t\tcolor: color,
\t\t\t\t\tisRevealed: isRevealed,
\t\t\t\t});
\t\t\t\tif (usedColors.indexOf(color) < 0) {
\t\t\t\t\tusedColors.push(color);
\t\t\t\t}
\t\t\t\tbatteryCount++;
\t\t\t}
\t\t}

\t\tcases.push({
\t\t\tid: `CASE_${index}`,
\t\t\tindex: index,
\t\t\tcapacity: CASE_CAPACITY,
\t\t\tbatteries: batteries,
\t\t\tisActive: isActive,
\t\t});
\t}

\treturn {
\t\tpuzzleId: puzzleId,
\t\tdifficulty: difficulty,
\t\tcases: cases,
\t\tactiveCaseCount: activeCaseCount,
\t\tcolorCount: usedColors.length,
\t\tbatteryCount: batteryCount,
\t};
}

/** 기획 CSV 에서 뽑은 정렬 퍼즐 필드 테이블 (%d판) */
export const COLORSORT_CSV_FIELD_TABLE: ColorSortFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
""" % (len(object_lines), '\n'.join(object_lines), len(raw_lines), '\n'.join(raw_lines), len(levels))

    write_ts('ColorSort_FieldData.ts', text)

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
