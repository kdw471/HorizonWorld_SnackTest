"""NPUZ_01 (레이저 퍼즐) -> Laser_FieldData.ts"""

from dt_common import banner, cell_name, grid_columns, read_table, parse_index, write_ts, FREE

# 오브젝트 ID 규칙: 40 + [1 고정 / 2 이동] + 유형(2) + 색(2) + 일련번호(3)
#   유형 01 발사체 / 02 수신체 / 03 중계체 / 04 해골 / 05 삼각 / 06 십자 / 07 흡수
COLOR_LETTER = {'01': 'R', '02': 'G', '03': 'B'}

# 삼각 크리스탈의 직각 코너. ObjectData 의 #Order 로 방향을 구분한다.
#   고정 029 ◸ / 030 ◹ / 031 ◺ / 032 ◿    이동 035 ◤ / 036 ◥ / 037 ◣ / 038 ◢
TRIANGLE_CORNER = {
    '029': '1', '030': '2', '031': '3', '032': '4',
    '035': '1', '036': '2', '037': '3', '038': '4',
}


def object_kind(object_id):
    """오브젝트 ID -> (movable, category, color, order)"""
    return object_id[2] == '2', object_id[3:5], object_id[5:7], object_id[7:10]


def build():
    keys, _labels, rows = read_table('NPUZ_01_FieldData.csv')
    okeys, _olabels, orows = read_table('NPUZ_01_ObjectData.csv')

    descriptions = {r[0]: r[okeys.index('#Description')].strip() for r in orows}
    mesh_paths = {r[0]: r[okeys.index('sUPStaticMeshPath')].strip() for r in orows}

    cells = grid_columns(keys)
    inventory_cols = [keys.index('sUseMoveObjectID%d' % n) for n in range(1, 11)]

    problems = []
    levels = []

    for row in rows:
        index = row[0]
        _category, difficulty, order = parse_index(index)

        gimmicks = []
        presets = []

        for csv_col, r, c in cells:
            value = row[csv_col].strip()
            if value == FREE or value == '':
                continue
            movable, category, color, serial = object_kind(value)
            if movable:
                problems.append('%s: movable object %s placed on the field' % (index, value))
                continue

            cell = cell_name(r, c)
            if category == '01':
                gimmicks.append('E' + COLOR_LETTER[color] + cell)
            elif category == '02':
                gimmicks.append('R' + COLOR_LETTER[color] + cell)
            elif category == '03':
                gimmicks.append('Y' + COLOR_LETTER[color] + cell)
            elif category == '04':
                gimmicks.append('K-' + cell)
            elif category == '05':
                presets.append('T' + TRIANGLE_CORNER[serial] + cell)
            elif category == '06':
                presets.append('X-' + cell)
            elif category == '07':
                presets.append('F-' + cell)
            else:
                problems.append('%s: unknown object category %s (%s)' % (index, category, value))

        inventory = []
        for csv_col in inventory_cols:
            value = row[csv_col].strip()
            if value == FREE or value == '':
                continue
            movable, category, _color, serial = object_kind(value)
            if not movable:
                problems.append('%s: fixed object %s in an inventory slot' % (index, value))
                continue
            if category == '05':
                inventory.append('T' + TRIANGLE_CORNER[serial])
            elif category == '06':
                inventory.append('X-')
            elif category == '07':
                inventory.append('F-')
            else:
                problems.append('%s: unknown inventory category %s (%s)' % (index, category, value))

        # 사양 검증: 발사체/수신체 존재, 수신체 색과 짝이 맞는 발사체
        emitter_colors = set(g[1] for g in gimmicks if g[0] == 'E')
        receiver_colors = set(g[1] for g in gimmicks if g[0] == 'R')
        if not emitter_colors:
            problems.append('%s: no emitter' % index)
        if not receiver_colors:
            problems.append('%s: no receiver' % index)
        for color in receiver_colors - emitter_colors:
            problems.append('%s: receiver color %s has no matching emitter' % (index, color))

        levels.append((index, difficulty, order, gimmicks, presets, inventory))

    # ── TS 생성 ───────────────────────────────────────────────────────────
    raw_lines = []
    for index, _difficulty, _order, gimmicks, presets, inventory in levels:
        raw_lines.append("\t'%s|%s|%s|%s'," % (index, ';'.join(gimmicks), ';'.join(presets), ';'.join(inventory)))

    object_lines = []
    for r in orows:
        object_id = r[0]
        movable, category, color, _serial = object_kind(object_id)
        object_lines.append("\t{ objectId: '%s', movable: %s, category: '%s', color: '%s', meshPath: '%s', description: '%s' },"
                            % (object_id, 'true' if movable else 'false', category, color,
                               mesh_paths[object_id].replace("'", "\\'"),
                               descriptions[object_id].replace("'", "\\'")))

    difficulty_counts = {}
    for _index, difficulty, _order, _g, _p, _i in levels:
        difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1

    text = banner(
        ['NPUZ_01_FieldData.csv', 'NPUZ_01_ObjectData.csv'],
        """
레이저 퍼즐(PUZ_01) 기획 필드 테이블 %d판.
난이도별 판 수: %s

인코딩: `인덱스|기믹|고정크리스탈|인벤토리`
  기믹        : <종류><색><칸>  종류 E 발사체 / R 수신체 / Y 중계체 / K 해골, 색 R/G/B/-
  고정크리스탈 : <종류><방향><칸>  종류 T 삼각 / X 십자 / F 흡수, 방향 1 ◸ 2 ◹ 3 ◺ 4 ◿ / -
  인벤토리    : <종류><방향>
  칸          : A1..G7 (행 A~G = 전체 그리드 0~6, 열 1~7 = 0~6)

발사체/수신체는 테두리, 중계체/해골/고정크리스탈은 안쪽 5x5 에만 놓인다 (§2 / §5.1).
발사 방향은 테두리 위치에서 유도되므로(getInwardDirection) 따로 저장하지 않는다.
""" % (len(levels), ', '.join('D%d %d판' % (d, difficulty_counts[d]) for d in sorted(difficulty_counts))))

    text += """import {
\tECrystalType,
\tEGimmickType,
\tELaserColor,
\tETriangleCorner,
\tLaserCrystal,
\tLaserGimmick,
\tLaserPlacedCrystal,
\ttoPlacementLocalIndex,
} from 'Laser_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { LaserFieldTableEntry } from 'Laser_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type LaserCsvObjectRow = {
\tobjectId: string,
\t/** true 면 인벤토리로 지급되는 이동 크리스탈, false 면 필드 고정물 */
\tmovable: boolean,
\t/** 01 발사체 / 02 수신체 / 03 중계체 / 04 해골 / 05 삼각 / 06 십자 / 07 흡수 */
\tcategory: string,
\t/** 01 R / 02 G / 03 B / 00 무색 */
\tcolor: string,
\tmeshPath: string,
\tdescription: string,
}

/** NPUZ_01_ObjectData.csv 전체 (%d행) */
export const LASER_CSV_OBJECT_ROWS: LaserCsvObjectRow[] = [
%s
];

/** NPUZ_01_FieldData.csv 전체 (%d행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
%s
];

const COLOR_BY_LETTER: { [letter: string]: ELaserColor } = {
\tR: ELaserColor.RED,
\tG: ELaserColor.GREEN,
\tB: ELaserColor.BLUE,
};

const GIMMICK_BY_LETTER: { [letter: string]: EGimmickType } = {
\tE: EGimmickType.EMITTER,
\tR: EGimmickType.RECEIVER,
\tY: EGimmickType.RELAY,
\tK: EGimmickType.SKULL,
};

const CORNER_BY_DIGIT: { [digit: string]: ETriangleCorner } = {
\t'1': ETriangleCorner.TOP_LEFT,
\t'2': ETriangleCorner.TOP_RIGHT,
\t'3': ETriangleCorner.BOTTOM_LEFT,
\t'4': ETriangleCorner.BOTTOM_RIGHT,
};

/** 'C3' -> 전체 그리드 좌표 */
function parseCell(token: string): { row: number, col: number } {
\treturn {
\t\trow: token.charCodeAt(0) - 65,
\t\tcol: parseInt(token.substring(1), 10) - 1,
\t};
}

function parseCrystal(id: string, kind: string, direction: string): LaserCrystal {
\tif (kind === 'T') {
\t\treturn { id: id, type: ECrystalType.TRIANGLE, corner: CORNER_BY_DIGIT[direction] };
\t}
\tif (kind === 'X') {
\t\treturn { id: id, type: ECrystalType.CROSS };
\t}
\treturn { id: id, type: ECrystalType.FLOWER };
}

function splitTokens(section: string): string[] {
\treturn section === '' ? [] : section.split(';');
}

function decodeLevel(raw: string): LaserFieldTableEntry {
\tconst parts = raw.split('|');
\tconst puzzleId = parts[0];
\t// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
\tconst difficulty = parseInt(puzzleId.substring(5, 7), 10);

\tconst gimmicks: LaserGimmick[] = [];
\tfor (const token of splitTokens(parts[1])) {
\t\tconst type = GIMMICK_BY_LETTER[token.charAt(0)];
\t\tconst colorLetter = token.charAt(1);
\t\tconst cell = parseCell(token.substring(2));
\t\tgimmicks.push({
\t\t\tid: `${token.charAt(0)}${colorLetter}_${token.substring(2)}`,
\t\t\ttype: type,
\t\t\trow: cell.row,
\t\t\tcol: cell.col,
\t\t\tcolors: colorLetter === '-' ? [] : [COLOR_BY_LETTER[colorLetter]],
\t\t});
\t}

\tconst presetCrystals: LaserPlacedCrystal[] = [];
\tfor (const token of splitTokens(parts[2])) {
\t\tconst cellToken = token.substring(2);
\t\tconst cell = parseCell(cellToken);
\t\tconst crystal = parseCrystal(`FX_${cellToken}`, token.charAt(0), token.charAt(1));
\t\tpresetCrystals.push({
\t\t\t...crystal,
\t\t\t// 고정 크리스탈은 배치 영역(5x5) 로컬 좌표로 저장한다
\t\t\trow: toPlacementLocalIndex(cell.row),
\t\t\tcol: toPlacementLocalIndex(cell.col),
\t\t\tisFixed: true,
\t\t});
\t}

\tconst inventory: LaserCrystal[] = [];
\tconst tokens = splitTokens(parts[3]);
\tfor (let i = 0; i < tokens.length; i++) {
\t\tinventory.push(parseCrystal(`INV_${i}`, tokens[i].charAt(0), tokens[i].charAt(1)));
\t}

\treturn {
\t\tpuzzleId: puzzleId,
\t\tdifficulty: difficulty,
\t\tgimmicks: gimmicks,
\t\tpresetCrystals: presetCrystals,
\t\tinventory: inventory,
\t};
}

/** 기획 CSV 에서 뽑은 레이저 필드 테이블 (%d판) */
export const LASER_CSV_FIELD_TABLE: LaserFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
""" % (len(object_lines), '\n'.join(object_lines), len(raw_lines), '\n'.join(raw_lines), len(levels))

    write_ts('Laser_FieldData.ts', text)

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
