"""
Documents/기획서 및 데이터 구조/DataTable/*.csv -> scripts/<Puzzle>_FieldData.ts 일괄 변환.

사용법:
    cd Documents/Tools
    python build_fielddata.py            # 8개 퍼즐 전부
    python build_fielddata.py laser flow # 일부만

퍼즐별 변환기는 `build_<이름>.py` 에 따로 있고, 각각 단독 실행도 된다.
스위치 퍼즐(PUZ_08)은 최소 누름 수를 미리 구해 두어야 하므로,
배치가 바뀌었다면 `python switch_minpresses.py switch_minpresses.json` 을 먼저 돌린다.
"""

import sys

import build_cardmatch
import build_colorfill
import build_colorsort
import build_flow
import build_laser
import build_rushhour
import build_slidepuzzle
import build_switch

BUILDERS = [
    ('laser', 'PUZ_01 레이저', build_laser),
    ('rushhour', 'PUZ_02 러시아워', build_rushhour),
    ('colorsort', 'PUZ_03 정렬', build_colorsort),
    ('colorfill', 'PUZ_04 색 채우기', build_colorfill),
    ('flow', 'PUZ_05 연결', build_flow),
    ('cardmatch', 'PUZ_06 카드 맞추기', build_cardmatch),
    ('slidepuzzle', 'PUZ_07 슬라이드', build_slidepuzzle),
    ('switch', 'PUZ_08 스위치', build_switch),
]


def main(names):
    selected = [b for b in BUILDERS if not names or b[0] in names]
    if names:
        unknown = [n for n in names if all(n != b[0] for b in BUILDERS)]
        if unknown:
            print('unknown puzzle(s): %s' % ' '.join(unknown))
            print('available: %s' % ' '.join(b[0] for b in BUILDERS))
            return 1

    total_levels = 0
    total_problems = 0
    for key, label, module in selected:
        print('[%s] %s' % (key, label))
        levels, problems = module.build()
        total_levels += levels
        total_problems += len(problems)

    print()
    print('total: %d levels, %d problem(s)' % (total_levels, total_problems))
    return 1 if total_problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
