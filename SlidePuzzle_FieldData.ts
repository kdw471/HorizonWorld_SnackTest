/**
 * !!! 자동 생성 파일 — 직접 수정하지 말 것 !!!
 *
 * 생성기: Documents/Tools/build_fielddata.py
 * 원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_07_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_07_ObjectData.csv
 *
 * 슬라이드 퍼즐(PUZ_07) 기획 필드 테이블 60판.
 * 난이도별 (판 수 / 분할 / 섞는 횟수): D1 (10판 / 3분할 / 8회), D2 (10판 / 3분할 / 13회), D3 (10판 / 3분할 / 20회), D4 (10판 / 4분할 / 17회), D5 (10판 / 4분할 / 35회), D6 (10판 / 4분할 / 55회)
 * 이미지 20장. 각 판이 서로 다른 이미지를 쓴다.
 *
 * 원본 CSV 는 배치를 담지 않는다. (이미지 ID / 분할 개수 / 섞는 횟수) 세 값뿐이고,
 * 실제 조각 배치는 런타임에 **합법 이동만으로 섞어서** 만든다 - 항상 풀 수 있는 배치가 보장된다.
 */
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { SlideFieldTableEntry, SlideObjectTableEntry } from 'SlidePuzzle_DataTables';

/**
 * NPUZ_07_ObjectData.csv 전체 (20행).
 * 이 퍼즐은 이미지 하나가 곧 그룹 하나라, `puzzleObjectId` 에 원본 ID 를 그대로 쓴다.
 */
export const SLIDEPUZZLE_CSV_OBJECT_TABLE: SlideObjectTableEntry[] = [
	{ index: 100, puzzleObjectId: '4600000001', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_001.T_PUZ7_001\'' },
	{ index: 101, puzzleObjectId: '4600000002', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_002.T_PUZ7_002\'' },
	{ index: 102, puzzleObjectId: '4600000003', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_003.T_PUZ7_003\'' },
	{ index: 103, puzzleObjectId: '4600000004', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_004.T_PUZ7_004\'' },
	{ index: 104, puzzleObjectId: '4600000005', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_005.T_PUZ7_005\'' },
	{ index: 105, puzzleObjectId: '4600000006', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_006.T_PUZ7_006\'' },
	{ index: 106, puzzleObjectId: '4600000007', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_007.T_PUZ7_007\'' },
	{ index: 107, puzzleObjectId: '4600000008', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_008.T_PUZ7_008\'' },
	{ index: 108, puzzleObjectId: '4600000009', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_009.T_PUZ7_009\'' },
	{ index: 109, puzzleObjectId: '4600000010', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_010.T_PUZ7_010\'' },
	{ index: 110, puzzleObjectId: '4600000011', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_011.T_PUZ7_011\'' },
	{ index: 111, puzzleObjectId: '4600000012', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_012.T_PUZ7_012\'' },
	{ index: 112, puzzleObjectId: '4600000013', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_013.T_PUZ7_013\'' },
	{ index: 113, puzzleObjectId: '4600000014', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_014.T_PUZ7_014\'' },
	{ index: 114, puzzleObjectId: '4600000015', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_015.T_PUZ7_015\'' },
	{ index: 115, puzzleObjectId: '4600000016', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_016.T_PUZ7_016\'' },
	{ index: 116, puzzleObjectId: '4600000017', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_017.T_PUZ7_017\'' },
	{ index: 117, puzzleObjectId: '4600000018', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_018.T_PUZ7_018\'' },
	{ index: 118, puzzleObjectId: '4600000019', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_019.T_PUZ7_019\'' },
	{ index: 119, puzzleObjectId: '4600000020', imagePath: '/Script/Engine.Texture2D\'/Game/Resources/Puzzle/Pieces/T_PUZ7_020.T_PUZ7_020\'' },
];

/**
 * NPUZ_07_FieldData.csv 전체 (60행).
 * `index` 는 구현 기본 행(1~5)과 겹치지 않도록 100 부터 매긴다.
 */
export const SLIDEPUZZLE_CSV_FIELD_TABLE: SlideFieldTableEntry[] = [
	{ index: 100, puzzleId: '8000701001', difficulty: 1, puzzleObjectId: '4600000001', divideNum: 3, shuffleNum: 8 },
	{ index: 101, puzzleId: '8000701002', difficulty: 1, puzzleObjectId: '4600000002', divideNum: 3, shuffleNum: 8 },
	{ index: 102, puzzleId: '8000701003', difficulty: 1, puzzleObjectId: '4600000003', divideNum: 3, shuffleNum: 8 },
	{ index: 103, puzzleId: '8000701004', difficulty: 1, puzzleObjectId: '4600000004', divideNum: 3, shuffleNum: 8 },
	{ index: 104, puzzleId: '8000701005', difficulty: 1, puzzleObjectId: '4600000005', divideNum: 3, shuffleNum: 8 },
	{ index: 105, puzzleId: '8000701006', difficulty: 1, puzzleObjectId: '4600000006', divideNum: 3, shuffleNum: 8 },
	{ index: 106, puzzleId: '8000701007', difficulty: 1, puzzleObjectId: '4600000007', divideNum: 3, shuffleNum: 8 },
	{ index: 107, puzzleId: '8000701008', difficulty: 1, puzzleObjectId: '4600000008', divideNum: 3, shuffleNum: 8 },
	{ index: 108, puzzleId: '8000701009', difficulty: 1, puzzleObjectId: '4600000009', divideNum: 3, shuffleNum: 8 },
	{ index: 109, puzzleId: '8000701010', difficulty: 1, puzzleObjectId: '4600000010', divideNum: 3, shuffleNum: 8 },
	{ index: 110, puzzleId: '8000702001', difficulty: 2, puzzleObjectId: '4600000011', divideNum: 3, shuffleNum: 13 },
	{ index: 111, puzzleId: '8000702002', difficulty: 2, puzzleObjectId: '4600000012', divideNum: 3, shuffleNum: 13 },
	{ index: 112, puzzleId: '8000702003', difficulty: 2, puzzleObjectId: '4600000013', divideNum: 3, shuffleNum: 13 },
	{ index: 113, puzzleId: '8000702004', difficulty: 2, puzzleObjectId: '4600000014', divideNum: 3, shuffleNum: 13 },
	{ index: 114, puzzleId: '8000702005', difficulty: 2, puzzleObjectId: '4600000015', divideNum: 3, shuffleNum: 13 },
	{ index: 115, puzzleId: '8000702006', difficulty: 2, puzzleObjectId: '4600000016', divideNum: 3, shuffleNum: 13 },
	{ index: 116, puzzleId: '8000702007', difficulty: 2, puzzleObjectId: '4600000017', divideNum: 3, shuffleNum: 13 },
	{ index: 117, puzzleId: '8000702008', difficulty: 2, puzzleObjectId: '4600000018', divideNum: 3, shuffleNum: 13 },
	{ index: 118, puzzleId: '8000702009', difficulty: 2, puzzleObjectId: '4600000019', divideNum: 3, shuffleNum: 13 },
	{ index: 119, puzzleId: '8000702010', difficulty: 2, puzzleObjectId: '4600000020', divideNum: 3, shuffleNum: 13 },
	{ index: 120, puzzleId: '8000703001', difficulty: 3, puzzleObjectId: '4600000001', divideNum: 3, shuffleNum: 20 },
	{ index: 121, puzzleId: '8000703002', difficulty: 3, puzzleObjectId: '4600000002', divideNum: 3, shuffleNum: 20 },
	{ index: 122, puzzleId: '8000703003', difficulty: 3, puzzleObjectId: '4600000003', divideNum: 3, shuffleNum: 20 },
	{ index: 123, puzzleId: '8000703004', difficulty: 3, puzzleObjectId: '4600000004', divideNum: 3, shuffleNum: 20 },
	{ index: 124, puzzleId: '8000703005', difficulty: 3, puzzleObjectId: '4600000005', divideNum: 3, shuffleNum: 20 },
	{ index: 125, puzzleId: '8000703006', difficulty: 3, puzzleObjectId: '4600000006', divideNum: 3, shuffleNum: 20 },
	{ index: 126, puzzleId: '8000703007', difficulty: 3, puzzleObjectId: '4600000007', divideNum: 3, shuffleNum: 20 },
	{ index: 127, puzzleId: '8000703008', difficulty: 3, puzzleObjectId: '4600000008', divideNum: 3, shuffleNum: 20 },
	{ index: 128, puzzleId: '8000703009', difficulty: 3, puzzleObjectId: '4600000009', divideNum: 3, shuffleNum: 20 },
	{ index: 129, puzzleId: '8000703010', difficulty: 3, puzzleObjectId: '4600000010', divideNum: 3, shuffleNum: 20 },
	{ index: 130, puzzleId: '8000704001', difficulty: 4, puzzleObjectId: '4600000011', divideNum: 4, shuffleNum: 17 },
	{ index: 131, puzzleId: '8000704002', difficulty: 4, puzzleObjectId: '4600000012', divideNum: 4, shuffleNum: 17 },
	{ index: 132, puzzleId: '8000704003', difficulty: 4, puzzleObjectId: '4600000013', divideNum: 4, shuffleNum: 17 },
	{ index: 133, puzzleId: '8000704004', difficulty: 4, puzzleObjectId: '4600000014', divideNum: 4, shuffleNum: 17 },
	{ index: 134, puzzleId: '8000704005', difficulty: 4, puzzleObjectId: '4600000015', divideNum: 4, shuffleNum: 17 },
	{ index: 135, puzzleId: '8000704006', difficulty: 4, puzzleObjectId: '4600000016', divideNum: 4, shuffleNum: 17 },
	{ index: 136, puzzleId: '8000704007', difficulty: 4, puzzleObjectId: '4600000017', divideNum: 4, shuffleNum: 17 },
	{ index: 137, puzzleId: '8000704008', difficulty: 4, puzzleObjectId: '4600000018', divideNum: 4, shuffleNum: 17 },
	{ index: 138, puzzleId: '8000704009', difficulty: 4, puzzleObjectId: '4600000019', divideNum: 4, shuffleNum: 17 },
	{ index: 139, puzzleId: '8000704010', difficulty: 4, puzzleObjectId: '4600000020', divideNum: 4, shuffleNum: 17 },
	{ index: 140, puzzleId: '8000705001', difficulty: 5, puzzleObjectId: '4600000001', divideNum: 4, shuffleNum: 35 },
	{ index: 141, puzzleId: '8000705002', difficulty: 5, puzzleObjectId: '4600000002', divideNum: 4, shuffleNum: 35 },
	{ index: 142, puzzleId: '8000705003', difficulty: 5, puzzleObjectId: '4600000003', divideNum: 4, shuffleNum: 35 },
	{ index: 143, puzzleId: '8000705004', difficulty: 5, puzzleObjectId: '4600000004', divideNum: 4, shuffleNum: 35 },
	{ index: 144, puzzleId: '8000705005', difficulty: 5, puzzleObjectId: '4600000005', divideNum: 4, shuffleNum: 35 },
	{ index: 145, puzzleId: '8000705006', difficulty: 5, puzzleObjectId: '4600000006', divideNum: 4, shuffleNum: 35 },
	{ index: 146, puzzleId: '8000705007', difficulty: 5, puzzleObjectId: '4600000007', divideNum: 4, shuffleNum: 35 },
	{ index: 147, puzzleId: '8000705008', difficulty: 5, puzzleObjectId: '4600000008', divideNum: 4, shuffleNum: 35 },
	{ index: 148, puzzleId: '8000705009', difficulty: 5, puzzleObjectId: '4600000009', divideNum: 4, shuffleNum: 35 },
	{ index: 149, puzzleId: '8000705010', difficulty: 5, puzzleObjectId: '4600000010', divideNum: 4, shuffleNum: 35 },
	{ index: 150, puzzleId: '8000706001', difficulty: 6, puzzleObjectId: '4600000011', divideNum: 4, shuffleNum: 55 },
	{ index: 151, puzzleId: '8000706002', difficulty: 6, puzzleObjectId: '4600000012', divideNum: 4, shuffleNum: 55 },
	{ index: 152, puzzleId: '8000706003', difficulty: 6, puzzleObjectId: '4600000013', divideNum: 4, shuffleNum: 55 },
	{ index: 153, puzzleId: '8000706004', difficulty: 6, puzzleObjectId: '4600000014', divideNum: 4, shuffleNum: 55 },
	{ index: 154, puzzleId: '8000706005', difficulty: 6, puzzleObjectId: '4600000015', divideNum: 4, shuffleNum: 55 },
	{ index: 155, puzzleId: '8000706006', difficulty: 6, puzzleObjectId: '4600000016', divideNum: 4, shuffleNum: 55 },
	{ index: 156, puzzleId: '8000706007', difficulty: 6, puzzleObjectId: '4600000017', divideNum: 4, shuffleNum: 55 },
	{ index: 157, puzzleId: '8000706008', difficulty: 6, puzzleObjectId: '4600000018', divideNum: 4, shuffleNum: 55 },
	{ index: 158, puzzleId: '8000706009', difficulty: 6, puzzleObjectId: '4600000019', divideNum: 4, shuffleNum: 55 },
	{ index: 159, puzzleId: '8000706010', difficulty: 6, puzzleObjectId: '4600000020', divideNum: 4, shuffleNum: 55 },
];
