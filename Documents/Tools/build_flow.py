"""NPUZ_05 (연결 퍼즐) -> Flow_FieldData.ts"""

import collections

from dt_common import banner, cell_name, grid_columns, read_table, parse_index, write_ts, FREE

# 오브젝트 ID: 44 + 0 + 유형(2) + 색(2) + 일련번호(3)
#   유형 01 메인 전구 (S=출발) / 02 메인 전구 [E]=도착 / 03 서브 전구(무색)
COLOR_LETTER = {
    '01': 'R', '02': 'O', '03': 'Y', '04': 'G',
    '05': 'B', '06': 'I', '07': 'V', '08': 'P',
}

GRID = 7


def build():
    keys, _labels, rows = read_table('NPUZ_05_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_05_ObjectData.csv')
    # 이 파일은 '#PUZObject' 컬럼이 두 번 나온다. 뒤쪽(오브젝트 이름)을 설명으로 쓴다
    name_col = len(okeys) - 2
    mesh_col = okeys.index('sStaticMeshPath')
    mesh_paths = {r[0]: r[mesh_col].strip() for r in orows}
    names = {r[0]: r[name_col].strip() for r in orows}

    cells = grid_columns(keys)
    problems = []
    remapped = []
    levels = []

    for row in rows:
        index = row[0]
        _category, difficulty, _order = parse_index(index)

        grid = [['.'] * GRID for _ in range(GRID)]
        starts = collections.Counter()
        ends = collections.Counter()
        tile_count = 0
        sub_count = 0

        for csv_col, r, c in cells:
            value = row[csv_col].strip()
            if value == FREE or value == '':
                continue
            tile_count += 1
            kind, color = value[3:5], value[5:7]
            if kind == '03':
                grid[r][c] = '#'
                sub_count += 1
            elif kind == '01':
                grid[r][c] = COLOR_LETTER[color]
                starts[COLOR_LETTER[color]] += 1
            elif kind == '02':
                grid[r][c] = COLOR_LETTER[color].lower()
                ends[COLOR_LETTER[color]] += 1
            else:
                problems.append('%s: unknown object category %s (%s) at %s'
                                % (index, kind, value, cell_name(r, c)))

        # 타일이 여러 덩어리로 나뉜 판이 있다 (한 필드 위의 독립된 미니 보드).
        # 따라서 "색마다 출발/도착 1개" 는 **레벨 전체가 아니라 연결 영역별로** 봐야 한다.
        region = {}
        region_count = 0
        for r in range(GRID):
            for c in range(GRID):
                if grid[r][c] == '.' or (r, c) in region:
                    continue
                stack = [(r, c)]
                while stack:
                    a, b = stack.pop()
                    if (a, b) in region:
                        continue
                    region[(a, b)] = region_count
                    for da, db in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        x, y = a + da, b + db
                        if 0 <= x < GRID and 0 <= y < GRID and grid[x][y] != '.' and (x, y) not in region:
                            stack.append((x, y))
                region_count += 1

        region_starts = collections.defaultdict(dict)
        region_ends = collections.defaultdict(dict)
        for (r, c), region_index in region.items():
            symbol = grid[r][c]
            if symbol == '#':
                continue
            table = region_starts if symbol.isupper() else region_ends
            table[region_index].setdefault(symbol.upper(), []).append((r, c))

        for region_index in range(region_count):
            starts_here = region_starts[region_index]
            ends_here = region_ends[region_index]
            if not starts_here:
                problems.append('%s: region %d has no colour pair' % (index, region_index))
            for color in set(list(starts_here.keys()) + list(ends_here.keys())):
                if len(starts_here.get(color, [])) != 1 or len(ends_here.get(color, [])) != 1:
                    problems.append('%s: region %d has %d start / %d end bulbs of colour %s'
                                    % (index, region_index, len(starts_here.get(color, [])),
                                       len(ends_here.get(color, [])), color))

        if not starts:
            problems.append('%s: no main bulbs' % index)

        # 구현은 경로를 **색으로** 관리하므로 한 판에 같은 색 쌍이 둘 있으면 짝을 지을 수 없다.
        # 영역이 다르면 기획상 문제가 없으니, 남는 색으로 바꿔 준다.
        duplicated = [color for color, n in starts.items() if n > 1]
        if duplicated:
            spare = [c for c in COLOR_LETTER.values() if c not in starts]
            for color in duplicated:
                # 첫 영역은 그대로 두고 두 번째부터 남는 색으로 옮긴다
                owners = sorted(set(region_starts[i].get(color) and i for i in range(region_count)
                                    if color in region_starts[i]))
                for region_index in owners[1:]:
                    if not spare:
                        problems.append('%s: colour %s is duplicated but no spare colour is left' % (index, color))
                        break
                    replacement = spare.pop(0)
                    (sr, sc) = region_starts[region_index][color][0]
                    (er, ec) = region_ends[region_index][color][0]
                    grid[sr][sc] = replacement
                    grid[er][ec] = replacement.lower()
                    starts[color] -= 1
                    starts[replacement] = 1
                    remapped.append('%s: colour %s in region %d remapped to %s (duplicate pair in one level)'
                                    % (index, color, region_index, replacement))

        levels.append((index, difficulty, grid, len(starts), sub_count, tile_count))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    raw_lines = []
    for index, _difficulty, grid, _colors, _subs, _tiles in levels:
        raw_lines.append("\t'%s|%s'," % (index, ''.join(''.join(r) for r in grid)))

    object_lines = []
    for r in orows:
        object_id = r[0]
        object_lines.append("\t{ objectId: '%s', category: '%s', color: '%s', meshPath: '%s', name: '%s' },"
                            % (object_id, object_id[3:5], object_id[5:7],
                               mesh_paths[object_id].replace("'", "\\'"),
                               names[object_id].replace("'", "\\'")))

    difficulty_counts = collections.Counter(d for _i, d, _g, _c, _s, _t in levels)
    color_stats = collections.defaultdict(list)
    tile_stats = collections.defaultdict(list)
    for _i, d, _g, colors, _subs, tiles in levels:
        color_stats[d].append(colors)
        tile_stats[d].append(tiles)

    text = banner(
        ['NPUZ_05_FieldData.csv', 'NPUZ_05_ObjectData.csv'],
        """
연결 퍼즐(PUZ_05) 기획 필드 테이블 %d판.
난이도별 판 수: %s
난이도별 색상 쌍 수: %s
난이도별 타일 수: %s

인코딩: `인덱스|49글자`
  49글자 = 7x7 을 A1..A7,B1..B7,... 순서로 이어 붙인 것
    '.'  타일 없음
    '#'  서브 전구 (색 없음)
    대문자 R O Y G B I V P  메인 전구 **출발**
    소문자 r o y g b i v p  메인 전구 **도착**
""" % (len(levels),
       ', '.join('D%d %d판' % (d, difficulty_counts[d]) for d in sorted(difficulty_counts)),
       ', '.join('D%d %d~%d' % (d, min(color_stats[d]), max(color_stats[d])) for d in sorted(color_stats)),
       ', '.join('D%d %d~%d' % (d, min(tile_stats[d]), max(tile_stats[d])) for d in sorted(tile_stats))))

    text += """import {
\tENodeKind,
\tENodeRole,
\tEFlowColor,
\tFLOW_GRID_SIZE,
\tFlowNode,
} from 'Flow_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { FlowFieldTableEntry } from 'Flow_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type FlowCsvObjectRow = {
\tobjectId: string,
\t/** 01 메인(출발) / 02 메인(도착) / 03 서브 */
\tcategory: string,
\t/** 01 R ~ 08 P / 00 무색 */
\tcolor: string,
\tmeshPath: string,
\tname: string,
}

/** NPUZ_05_ObjectData.csv 전체 (%d행) */
export const FLOW_CSV_OBJECT_ROWS: FlowCsvObjectRow[] = [
%s
];

/** NPUZ_05_FieldData.csv 전체 (%d행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
%s
];

/**
 * 기획 CSV 의 색 코드 -> 구현 색상 enum.
 * 기획은 R O Y G B I(인디고) V(바이올렛) P 8종, 구현도 8종이라 1:1 대응한다.
 * (인디고/바이올렛은 구현의 CYAN/PURPLE 슬롯을 쓴다. 실제 색은 메쉬가 정한다)
 */
const COLOR_BY_LETTER: { [letter: string]: EFlowColor } = {
\tR: EFlowColor.RED,
\tO: EFlowColor.ORANGE,
\tY: EFlowColor.YELLOW,
\tG: EFlowColor.GREEN,
\tB: EFlowColor.BLUE,
\tI: EFlowColor.CYAN,
\tV: EFlowColor.PURPLE,
\tP: EFlowColor.PINK,
};

function decodeLevel(raw: string): FlowFieldTableEntry {
\tconst parts = raw.split('|');
\tconst puzzleId = parts[0];
\t// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
\tconst difficulty = parseInt(puzzleId.substring(5, 7), 10);
\tconst map = parts[1];

\tconst tileBitmap: string[] = [];
\tconst nodes: FlowNode[] = [];
\tconst colors: EFlowColor[] = [];
\tlet mainCount = 0;
\tlet subCount = 0;

\tfor (let row = 0; row < FLOW_GRID_SIZE; row++) {
\t\tlet bits = '';
\t\tfor (let col = 0; col < FLOW_GRID_SIZE; col++) {
\t\t\tconst symbol = map.charAt(row * FLOW_GRID_SIZE + col);
\t\t\tif (symbol === '.') {
\t\t\t\tbits += '0';
\t\t\t\tcontinue;
\t\t\t}
\t\t\tbits += '1';

\t\t\tif (symbol === '#') {
\t\t\t\tnodes.push({ row: row, col: col, kind: ENodeKind.SUB });
\t\t\t\tsubCount++;
\t\t\t\tcontinue;
\t\t\t}

\t\t\t// 대문자 = 출발, 소문자 = 도착
\t\t\tconst isStart = symbol === symbol.toUpperCase();
\t\t\tconst color = COLOR_BY_LETTER[symbol.toUpperCase()];
\t\t\tnodes.push({
\t\t\t\trow: row,
\t\t\t\tcol: col,
\t\t\t\tkind: ENodeKind.MAIN,
\t\t\t\tcolor: color,
\t\t\t\trole: isStart ? ENodeRole.START : ENodeRole.END,
\t\t\t});
\t\t\tmainCount++;
\t\t\tif (isStart && colors.indexOf(color) < 0) {
\t\t\t\tcolors.push(color);
\t\t\t}
\t\t}
\t\ttileBitmap.push(bits);
\t}

\treturn {
\t\tpuzzleId: puzzleId,
\t\tdifficulty: difficulty,
\t\ttileBitmap: tileBitmap,
\t\tnodes: nodes,
\t\tmainCount: mainCount,
\t\tsubCount: subCount,
\t\tcolorCount: colors.length,
\t};
}

/** 기획 CSV 에서 뽑은 연결 퍼즐 필드 테이블 (%d판) */
export const FLOW_CSV_FIELD_TABLE: FlowFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
""" % (len(object_lines), '\n'.join(object_lines), len(raw_lines), '\n'.join(raw_lines), len(levels))

    write_ts('Flow_FieldData.ts', text)

    print('  levels: %d, difficulties: %s' % (len(levels), sorted(difficulty_counts)))
    for note in remapped:
        print('  ~ ' + note)
    if problems:
        print('  !! %d problem(s):' % len(problems))
        for p in problems[:20]:
            print('     ' + p)
    else:
        print('  no problems')
    return len(levels), problems


if __name__ == '__main__':
    build()
