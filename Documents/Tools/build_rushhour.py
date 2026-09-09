"""NPUZ_02 (러시아워 퍼즐) -> RushHour_FieldData.ts"""

import collections
import json
import os

from dt_common import banner, cell_name, grid_columns, read_table, parse_index, write_ts, FREE

# 오브젝트 ID: 41 + 유형(1) + 길이(1) + 축(1) + 머리(1) + 색(1) + 일련번호(3)
#   유형 1 USB(목표) / 2 방해 블록 / 3 도착 포인트
#   축   1 세로 / 2 가로 / 3 없음(1x1) / 0 없음(도착 포인트)
#   머리 1 U / 2 D / 3 L / 4 R / 0 없음
HEAD_DELTA = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}

# 도착 포인트가 바라보는 방향 -> 목표에서 봤을 때 도착 포인트가 있는 변
EDGE_BY_EXIT_HEAD = {1: 'B', 2: 'T', 3: 'R', 4: 'L'}

COLOR_LETTER = {'1': 'R', '2': 'B'}

GRID = 7


def parse_object(value):
    return value[2], int(value[3]), int(value[4]), int(value[5]), value[6]


def load_minimum_moves():
    """사전에 솔버로 구해 둔 최소 이동 수. 없으면 전부 -1(미검증)로 둔다.

    갱신 방법은 Documents/PUZ_02_러시아워_데이터테이블_적용.md 참조.
    """
    path = os.path.join(os.path.dirname(__file__), 'rushhour_minmoves.json')
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def build():
    minimum_moves = load_minimum_moves()
    keys, _labels, rows = read_table('NPUZ_02_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_02_ObjectData.csv')
    mesh_paths = {r[0]: r[okeys.index('sStaticMeshPath')].strip() for r in orows}

    cells = grid_columns(keys)
    problems = []
    levels = []

    for row in rows:
        index = row[0]
        _category, difficulty, _order = parse_index(index)

        pieces = []   # (size, orient, color, top, left, head)
        exits = []    # (edge, color, r, c)
        occupied = {}

        for csv_col, r, c in cells:
            value = row[csv_col].strip()
            if value == FREE or value == '':
                continue
            kind, length, axis, head, color = parse_object(value)

            if kind == '3':
                exits.append((EDGE_BY_EXIT_HEAD[head], COLOR_LETTER[color], r, c))
                footprint = [(r, c)]
            else:
                # CSV 는 오브젝트를 "머리 칸" 한 곳에만 적고, 몸통은 머리 반대쪽으로 뻗는다.
                # 구현 쪽 좌표는 좌측·상단 칸 기준이라 여기서 변환한다 (기획서 §7).
                if length > 1:
                    dr, dc = HEAD_DELTA[head]
                    footprint = [(r - dr * t, c - dc * t) for t in range(length)]
                else:
                    footprint = [(r, c)]
                top = min(x[0] for x in footprint)
                left = min(x[1] for x in footprint)
                orient = 'F' if length == 1 else ('V' if axis == 1 else 'H')
                pieces.append((length, orient, COLOR_LETTER.get(color, '-') if kind == '1' else '-',
                               top, left, head))

            for rr, cc in footprint:
                if not (0 <= rr < GRID and 0 <= cc < GRID):
                    problems.append('%s: %s sticks out of the field' % (index, value))
                elif (rr, cc) in occupied:
                    problems.append('%s: %s overlaps %s at %s' % (index, value, occupied[(rr, cc)], cell_name(rr, cc)))
                else:
                    occupied[(rr, cc)] = value

        goals = [p for p in pieces if p[2] != '-']
        if len(goals) != len(exits):
            problems.append('%s: %d goal(s) but %d end point(s)' % (index, len(goals), len(exits)))
        for size, orient, color, top, left, head in goals:
            match = [e for e in exits if e[1] == color]
            if not match:
                problems.append('%s: goal %s has no end point of the same color' % (index, color))
                continue
            edge, _color, er, ec = match[0]
            # §5.1 목표는 반드시 도착 포인트와 동일 선상
            if edge in ('T', 'B'):
                if orient != 'V' or left != ec:
                    problems.append('%s: goal %s is not in line with its end point' % (index, color))
            else:
                if orient != 'H' or top != er:
                    problems.append('%s: goal %s is not in line with its end point' % (index, color))

        levels.append((index, difficulty, exits, pieces))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    raw_lines = []
    for index, _difficulty, exits, pieces in levels:
        exit_tokens = ['%s%s%s' % (edge, color, cell_name(r, c)) for edge, color, r, c in exits]
        piece_tokens = ['%d%s%s%s' % (size, orient, color, cell_name(top, left))
                        for size, orient, color, top, left, _head in pieces]
        raw_lines.append("\t'%s|%s|%s|%d'," % (index, ';'.join(exit_tokens), ';'.join(piece_tokens),
                                               minimum_moves.get(index, -1)))

    object_lines = []
    for r in orows:
        object_id = r[0]
        kind, length, axis, head, color = parse_object(object_id)
        object_lines.append("\t{ objectId: '%s', kind: '%s', size: %d, axis: %d, head: %d, color: '%s', meshPath: '%s' },"
                            % (object_id, kind, length, axis, head, color, mesh_paths[object_id].replace("'", "\\'")))

    difficulty_counts = collections.Counter(d for _i, d, _e, _p in levels)
    goal_counts = collections.Counter(len(e) for _i, _d, e, _p in levels)

    text = banner(
        ['NPUZ_02_FieldData.csv', 'NPUZ_02_ObjectData.csv'],
        """
러시아워 퍼즐(PUZ_02) 기획 필드 테이블 %d판.
난이도별 판 수: %s
도착 포인트 개수별 판 수: %s

인코딩: `인덱스|도착포인트|오브젝트|최소이동수`
  도착포인트 : <변><색><칸>       변 T/B/L/R = 목표에서 봤을 때 포인트가 있는 쪽, 색 R/B
  오브젝트   : <길이><축><색><칸>  축 V 세로 / H 가로 / F 자유(1x1), 색 R·B 는 목표 USB, - 는 방해물
  칸         : A1..G7 (좌측·상단 칸 기준, 기획서 §7)
  최소이동수 : BFS 솔버로 미리 구한 값. -1 은 탐색 상한 안에 못 구한 미검증 판

원본 CSV 는 오브젝트를 "머리 칸" 한 곳에만 적고 몸통이 머리 반대쪽으로 뻗는 형식이라,
변환하면서 좌측·상단 칸 기준으로 바꿨다. 도착 포인트도 원본은 7x7 안쪽 좌표라
전체 9x9 좌표로 옮긴다(로컬 + 1).
""" % (len(levels),
       ', '.join('D%d %d판' % (d, difficulty_counts[d]) for d in sorted(difficulty_counts)),
       ', '.join('%d개 %d판' % (n, goal_counts[n]) for n in sorted(goal_counts))))

    text += """import {
\tEEdge,
\tEOrientation,
\tEPieceColor,
\tRushHourEndPoint,
\ttoFullGridIndex,
} from 'RushHour_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { RushHourFieldTableEntry, RushHourPlacement } from 'RushHour_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type RushHourCsvObjectRow = {
\tobjectId: string,
\t/** 1 목표 USB / 2 방해 블록 / 3 도착 포인트 */
\tkind: string,
\tsize: number,
\t/** 1 세로 / 2 가로 / 3 없음(1x1) / 0 없음 */
\taxis: number,
\t/** 1 U / 2 D / 3 L / 4 R / 0 없음 */
\thead: number,
\t/** 1 빨강 / 2 파랑 / 0 무색 */
\tcolor: string,
\tmeshPath: string,
}

/** NPUZ_02_ObjectData.csv 전체 (%d행) */
export const RUSHHOUR_CSV_OBJECT_ROWS: RushHourCsvObjectRow[] = [
%s
];

/** NPUZ_02_FieldData.csv 전체 (%d행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
%s
];

const EDGE_BY_LETTER: { [letter: string]: EEdge } = {
\tT: EEdge.TOP,
\tB: EEdge.BOTTOM,
\tL: EEdge.LEFT,
\tR: EEdge.RIGHT,
};

const ORIENTATION_BY_LETTER: { [letter: string]: EOrientation } = {
\tV: EOrientation.VERTICAL,
\tH: EOrientation.HORIZONTAL,
\tF: EOrientation.FREE,
};

const COLOR_BY_LETTER: { [letter: string]: EPieceColor } = {
\tR: EPieceColor.RED,
\tB: EPieceColor.BLUE,
\t'-': EPieceColor.NEUTRAL,
};

/** 'C3' -> 플레이 로컬 좌표 */
function parseCell(token: string): { row: number, col: number } {
\treturn {
\t\trow: token.charCodeAt(0) - 65,
\t\tcol: parseInt(token.substring(1), 10) - 1,
\t};
}

function splitTokens(section: string): string[] {
\treturn section === '' ? [] : section.split(';');
}

function decodeLevel(raw: string): RushHourFieldTableEntry {
\tconst parts = raw.split('|');
\tconst puzzleId = parts[0];
\t// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
\tconst difficulty = parseInt(puzzleId.substring(5, 7), 10);

\tconst endPoints: RushHourEndPoint[] = [];
\tfor (const token of splitTokens(parts[1])) {
\t\tconst cell = parseCell(token.substring(2));
\t\tendPoints.push({
\t\t\tid: `END_${token.charAt(1)}_${token.substring(2)}`,
\t\t\tedge: EDGE_BY_LETTER[token.charAt(0)],
\t\t\trow: toFullGridIndex(cell.row),
\t\t\tcol: toFullGridIndex(cell.col),
\t\t\tcolor: COLOR_BY_LETTER[token.charAt(1)],
\t\t});
\t}

\tconst placements: RushHourPlacement[] = [];
\tfor (const token of splitTokens(parts[2])) {
\t\tconst size = parseInt(token.charAt(0), 10);
\t\tconst colorLetter = token.charAt(2);
\t\tconst isGoal = colorLetter !== '-';
\t\tconst cell = parseCell(token.substring(3));
\t\tplacements.push({
\t\t\tobjectId: isGoal
\t\t\t\t? (colorLetter === 'R' ? 'USB_RED' : 'USB_BLUE')
\t\t\t\t: `BLOCK_${size}x1`,
\t\t\trow: cell.row,
\t\t\tcol: cell.col,
\t\t\torientation: ORIENTATION_BY_LETTER[token.charAt(1)],
\t\t\tcolor: COLOR_BY_LETTER[colorLetter],
\t\t\tisGoal: isGoal,
\t\t});
\t}

\treturn {
\t\tpuzzleId: puzzleId,
\t\tdifficulty: difficulty,
\t\tendPoints: endPoints,
\t\tplacements: placements,
\t\tobjectCount: placements.length,
\t\t// 기획 데이터에는 최소 이동 수가 없다. 필요하면 솔버로 구한다
\t\tminimumMoves: -1,
\t};
}

/** 기획 CSV 에서 뽑은 러시아워 필드 테이블 (%d판) */
export const RUSHHOUR_CSV_FIELD_TABLE: RushHourFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
""" % (len(object_lines), '\n'.join(object_lines), len(raw_lines), '\n'.join(raw_lines), len(levels))

    write_ts('RushHour_FieldData.ts', text)

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
