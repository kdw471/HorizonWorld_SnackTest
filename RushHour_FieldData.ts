/**
 * !!! 자동 생성 파일 — 직접 수정하지 말 것 !!!
 *
 * 생성기: Documents/Tools/build_fielddata.py
 * 원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_02_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_02_ObjectData.csv
 *
 * 러시아워 퍼즐(PUZ_02) 기획 필드 테이블 53판.
 * 난이도별 판 수: D1 3판, D2 10판, D3 10판, D4 10판, D5 10판, D6 10판
 * 도착 포인트 개수별 판 수: 1개 38판, 2개 15판
 *
 * 인코딩: `인덱스|도착포인트|오브젝트|최소이동수`
 *   도착포인트 : <변><색><칸>       변 T/B/L/R = 목표에서 봤을 때 포인트가 있는 쪽, 색 R/B
 *   오브젝트   : <길이><축><색><칸>  축 V 세로 / H 가로 / F 자유(1x1), 색 R·B 는 목표 USB, - 는 방해물
 *   칸         : A1..G7 (좌측·상단 칸 기준, 기획서 §7)
 *   최소이동수 : BFS 솔버로 미리 구한 값. -1 은 탐색 상한 안에 못 구한 미검증 판
 *
 * 원본 CSV 는 오브젝트를 "머리 칸" 한 곳에만 적고 몸통이 머리 반대쪽으로 뻗는 형식이라,
 * 변환하면서 좌측·상단 칸 기준으로 바꿨다. 도착 포인트도 원본은 7x7 안쪽 좌표라
 * 전체 9x9 좌표로 옮긴다(로컬 + 1).
 */
import {
	EEdge,
	EOrientation,
	EPieceColor,
	RushHourEndPoint,
	toFullGridIndex,
} from 'RushHour_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { RushHourFieldTableEntry, RushHourPlacement } from 'RushHour_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type RushHourCsvObjectRow = {
	objectId: string,
	/** 1 목표 USB / 2 방해 블록 / 3 도착 포인트 */
	kind: string,
	size: number,
	/** 1 세로 / 2 가로 / 3 없음(1x1) / 0 없음 */
	axis: number,
	/** 1 U / 2 D / 3 L / 4 R / 0 없음 */
	head: number,
	/** 1 빨강 / 2 파랑 / 0 무색 */
	color: string,
	meshPath: string,
}

/** NPUZ_02_ObjectData.csv 전체 (23행) */
export const RUSHHOUR_CSV_OBJECT_ROWS: RushHourCsvObjectRow[] = [
	{ objectId: '4112111001', kind: '1', size: 2, axis: 1, head: 1, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_U.SM_NPUZ_02_USB_U\'' },
	{ objectId: '4112121002', kind: '1', size: 2, axis: 1, head: 2, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_D.SM_NPUZ_02_USB_D\'' },
	{ objectId: '4112231003', kind: '1', size: 2, axis: 2, head: 3, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_L.SM_NPUZ_02_USB_L\'' },
	{ objectId: '4112241004', kind: '1', size: 2, axis: 2, head: 4, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_R.SM_NPUZ_02_USB_R\'' },
	{ objectId: '4112112005', kind: '1', size: 2, axis: 1, head: 1, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_U.SM_NPUZ_02_USB_U\'' },
	{ objectId: '4112122006', kind: '1', size: 2, axis: 1, head: 2, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_D.SM_NPUZ_02_USB_D\'' },
	{ objectId: '4112232007', kind: '1', size: 2, axis: 2, head: 3, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_L.SM_NPUZ_02_USB_L\'' },
	{ objectId: '4112242008', kind: '1', size: 2, axis: 2, head: 4, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_USB_R.SM_NPUZ_02_USB_R\'' },
	{ objectId: '4121300009', kind: '2', size: 1, axis: 3, head: 0, color: '0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_Block_1.SM_NPUZ_02_Block_1\'' },
	{ objectId: '4122120010', kind: '2', size: 2, axis: 1, head: 2, color: '0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_Block_2_V.SM_NPUZ_02_Block_2_V\'' },
	{ objectId: '4122240011', kind: '2', size: 2, axis: 2, head: 4, color: '0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_Block_2_H.SM_NPUZ_02_Block_2_H\'' },
	{ objectId: '4123120012', kind: '2', size: 3, axis: 1, head: 2, color: '0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_Block_3_V.SM_NPUZ_02_Block_3_V\'' },
	{ objectId: '4123240013', kind: '2', size: 3, axis: 2, head: 4, color: '0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_Block_3_H.SM_NPUZ_02_Block_3_H\'' },
	{ objectId: '4124120014', kind: '2', size: 4, axis: 1, head: 2, color: '0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_Block_4_V.SM_NPUZ_02_Block_4_V\'' },
	{ objectId: '4124240015', kind: '2', size: 4, axis: 2, head: 4, color: '0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_Block_4_H.SM_NPUZ_02_Block_4_H\'' },
	{ objectId: '4131011016', kind: '3', size: 1, axis: 0, head: 1, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_U.SM_NPUZ_02_End_U\'' },
	{ objectId: '4131021017', kind: '3', size: 1, axis: 0, head: 2, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_D.SM_NPUZ_02_End_D\'' },
	{ objectId: '4131031018', kind: '3', size: 1, axis: 0, head: 3, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_L.SM_NPUZ_02_End_L\'' },
	{ objectId: '4131041019', kind: '3', size: 1, axis: 0, head: 4, color: '1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_R.SM_NPUZ_02_End_R\'' },
	{ objectId: '4131012020', kind: '3', size: 1, axis: 0, head: 1, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_U.SM_NPUZ_02_End_U\'' },
	{ objectId: '4131022021', kind: '3', size: 1, axis: 0, head: 2, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_D.SM_NPUZ_02_End_D\'' },
	{ objectId: '4131032022', kind: '3', size: 1, axis: 0, head: 3, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_L.SM_NPUZ_02_End_L\'' },
	{ objectId: '4131042023', kind: '3', size: 1, axis: 0, head: 4, color: '2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_02/Meshs/SM_NPUZ_02_End_R.SM_NPUZ_02_End_R\'' },
];

/** NPUZ_02_FieldData.csv 전체 (53행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
	'8000201001|RRE7|2HRE2;3V-C4;2V-F4|2',
	'8000201002|RBD7|4H-A4;2HBD3;3V-B6;2V-E6|3',
	'8000201003|RRC7|2HRC1;3V-A6;2H-D5;3V-D4|4',
	'8000202001|RRE7|3V-A5;2H-C6;2H-D6;2HRE3;4H-G1;3V-E6|6',
	'8000202002|RRA7|2HRA1;2V-A5;3V-A3;3V-A4;2H-C5;2H-D3;4V-C7;2H-G1|6',
	'8000202003|RBG7|4V-A1;3H-D4;2V-D2;2H-E3;2HBG1;2V-F4;3V-E5;3V-E6|7',
	'8000202004|RRE7|2H-C3;2H-D2;2HRE1;3V-E3;4V-D4;3V-E5;4V-D6|7',
	'8000202005|RBF7|2H-A4;2H-D3;3V-B6;3V-C2;2HBF1;3V-E3;3V-E4|5',
	'8000202006|BBG4|3H-D1;2VBD4;2H-F3;3V-E1;3V-E2;2V-F5|3',
	'8000202007|BRG3|2V-A1;2VRA3;2H-B4;3H-D1;2V-C4;4V-A7;4H-E1;3H-F2|6',
	'8000202008|RBF7|3H-B5;3H-C4;3H-D3;2HBF2;2V-E4;2V-E5;3V-D6;4H-G1;3H-G5|6',
	'8000202009|BRG5|2VRA5;4H-C4;3H-D4;3V-C3;2H-E4;3V-E6;4V-D7|6',
	'8000202010|RRD7|4H-B4;2H-C4;2H-C6;2HRD3;2V-D5;2V-D6;2H-F4;2H-F6;4H-G4|5',
	'8000203001|RRD7|2V-A1;3V-A6;2HRD2;3V-C1;3V-C4;3V-C5;2V-D6;2H-F6;2H-G6|5',
	'8000203002|RRC7|2H-A1;3H-B1;2V-A6;2HRC1;2V-C6;3V-C5;2V-E6;2V-F3;4H-G4|6',
	'8000203003|RBB7|2HBB2;3V-A4;3H-D5;2V-D4;3V-D2;3V-D3;3H-G2;2H-G5|4',
	'8000203004|RBE7|2V-A4;2V-A5;2V-C4;2V-C5;2H-D6;2HBE1;3V-E6|5',
	'8000203005|RRA7|2HRA1;3V-A3;3V-A4;3V-A5;3V-A6;3H-D3;2V-D2|8',
	'8000203006|RRE7|2H-A3;4H-B4;2H-D3;2HRE1;3V-C5;2V-E4|4',
	'8000203007|RBF7|4V-A1;3H-D3;2HBF2;2V-E4;2V-E5;3V-D6;4H-G1;3H-G5|6',
	'8000203008|RRA7|2HRA3;2V-A5;2V-A6;3V-A2;4H-C3;3H-D1;2V-D4;4V-D7|7',
	'8000203009|BBG4|4H-A4;4H-B4;3V-A1;2VBC4;4V-B2;3H-E4;3H-F2;2V-F1;2V-F6;3V-E7|6',
	'8000303010|RRG7|2H-C6;2V-C4;2V-C5;2H-D6;4V-D1;2HRG2;3V-E4;3V-E5;3V-E6|7',
	'8000204001|BRG2|2VRA2;3H-B3;3H-C1;2V-B6;2H-D1;2V-C4;2V-D3;4H-F1|8',
	'8000204002|RBB7|2HBB3;2V-A5;2V-A6;3V-C5;3V-C6;4H-F4;3V-E1;2H-G4;2H-G6|9',
	'8000204003|RRE7|3H-A5;3H-B5;2H-D6;2HRE2;2V-D5;3V-E6|5',
	'8000204004|BBG6|3H-A2;2H-B3;2VBA6;3H-C5;2H-D3;3H-D5;3V-C2;2V-F2|6',
	'8000204005|BRG6|3H-A1;2V-A4;2VRA6;2V-B3;3H-C4;3V-B1;2H-D2;3V-E1|4',
	'8000204006|RBD7|2H-A3;2H-A5;3V-A7;4V-A1;2HBD2;3V-C4;3V-C5;3H-F2;2V-F1;3H-G5|5',
	'8000204007|RRE7|3H-A5;3H-B5;3V-A4;2H-D3;2V-C5;2H-D6;2HRE4;3V-E6|9',
	'8000204008|RBB7|2HBB1;3V-A3;3V-A4;3V-A5;3V-A6;2H-D4;2V-D1;2V-D2;2H-E4;3H-F1;3H-G1|9',
	'8000204009|RRE7|2V-A3;2H-B4;2H-B6;2V-C3;2H-D4;2H-D6;2HRE2;3V-E4|7',
	'8000204010|BBG4|3H-B2;2V-A7;2H-D1;2V-C3;2VBC4;2H-E3;3H-E5;3H-F4;3V-E2;2V-F3;2V-F7|10',
	'8000305001|RBC7|3H-A4;2V-A1;2V-A3;2HBC2;2V-B5;2V-B6;4V-B4;2V-E3;2H-F4;3V-D6;2H-G3|10',
	'8000205002|BRG5|2H-A4;2H-A6;2H-B5;3H-C1;2V-B7;2VRC5;2V-C6;2V-D2;2V-D3;3H-E4;2H-F3;2H-F5;4V-D1;3V-E7|16',
	'8000205003|RBF7|2H-A6;3V-A1;2H-C2;2H-C4;3H-D1;3V-B6;2V-D4;2HBF1;2V-E3;2H-G1;3H-G3|7',
	'8000205004|RRC7|2H-A1;2H-A4;2H-B4;2V-A6;2HRC1;3V-A3;2H-D2;2V-D1;3V-C4;2H-F1;2H-F3;2V-F5;3V-E7|9',
	'8000205005|BBG3|2H-B3;2V-A5;3V-B2;2VBC3;2V-C4;2H-D5;2H-E1;2H-E3;3H-F3;2V-E6;2V-F2;3V-E7|10',
	'8000205006|RRC7;BBG3|2H-B2;2H-B4;2V-A7;2HRC1;3V-A6;2VBC3;2V-C5;2V-D1;2H-E2;2H-F2;2V-E7;3V-E4;3H-G5|9',
	'8000205007|RBE7;BRG4|3H-A1;3H-A4;2V-B1;2H-C5;2H-D1;2VRC4;2HBE4;2V-D6;3H-F3;3V-E2;2V-F6;2V-F7|11',
	'8000205008|BBG3;BRG5|2H-A1;2H-B1;3H-C1;3V-A4;2V-B5;2H-C6;2V-D1;2VBD3;2VRD5;2V-D7;2H-F2;2H-F5;2V-F1;2V-F7|13',
	'8000205009|RBC7;BRG1|2H-A6;2VRA1;2V-A2;2H-B4;2HBC1;3V-A3;3H-D1;3H-E1;2V-D4;2H-F3;3V-D7;3V-E6|15',
	'8000205010|RBC7;LRD1|3H-A1;2HBC1;2V-B3;2V-B5;3V-A6;2HRD6;2H-E3;2V-D5;3H-F5;2V-F4;2H-G6|9',
	'8000206001|TRA7;LBG1|2H-A3;2H-A5;2V-A1;1F-B4;3H-C1;1F-C5;1F-D3;2V-C4;3H-D5;3H-E2;2VRE7;3V-D1;2H-F2;2V-E6;1F-G2;2V-F4;3V-E5;2HBG6|-1',
	'8000206002|TRA4;LBC1|1F-B2;3H-B4;1F-B7;2V-B3;1F-C4;2HBC6;2V-C2;2H-D3;2V-C5;2H-E2;2H-E4;2VRF4;1F-F5;3V-D6|-1',
	'8000206003|RBD7;RRE7|1F-A4;3H-A5;2V-A1;3H-B3;2V-B2;1F-C6;2V-B7;2HBD1;2V-C4;2V-C5;3V-C3;2HRE4;1F-F3;2H-F4;3V-D6;2V-F1;2H-G3;2H-G5;2V-F7|-1',
	'8000206004|TBA7;BRG1|2H-A3;2VRA1;2H-B5;3H-C1;2V-B4;1F-D1;3H-D2;2V-C5;2V-C6;1F-D7;2H-E3;3H-E5;2V-E2;2VBF7;2H-G5|12',
	'8000206005|LBA1;BRG7|1F-A4;2HBA6;2H-B1;2V-A3;2V-B4;3V-A5;2VRB7;2H-D3;2H-D5;1F-D7;2V-D2;3H-E3;2H-E6;3H-F5;2V-F1;2V-F4;2H-G5|15',
	'8000206006|BRG2;BBG6|2H-A4;2V-A1;2VRA2;2H-B3;1F-B5;2VBA6;2V-A7;1F-C2;2H-C6;3H-D2;2V-C5;2V-D1;1F-E4;2H-E5;2V-E3;2H-F4;3H-G3;3V-E7|-1',
	'8000206007|LRC1;LBD1|1F-A1;2H-A2;3H-A5;2H-B3;1F-B6;1F-B7;1F-C5;2HRC6;2HBD6;3V-C4;2V-D5;2H-E6;2V-E3;2H-F4;3V-E1;2V-F2;1F-G3;2H-G4;2V-F7|8',
	'8000206008|BRF7;RBG7|2H-A5;2V-A1;3H-B2;2VRA7;1F-C1;3H-C5;2H-D2;2V-C4;2H-D5;1F-D7;2H-E6;2V-E1;2V-E3;1F-F6;2HBG1;2V-F4;3V-E5;1F-G6|-1',
	'8000206009|TRA1;TBA6|3H-A3;2V-A2;1F-B5;2H-C1;2V-B3;2V-B4;2H-C5;3V-A7;2H-D2;1F-D5;2VRE1;2VBE6;2V-E3;1F-F4;2V-E5;1F-G1;3V-E2;2H-G3;2H-G6|10',
	'8000206010|RRC7;BBG3|1F-A1;2H-A4;1F-B1;2V-A2;2VBA3;2V-A6;2HRC1;1F-C3;2V-B4;2V-B5;2H-D1;3H-D3;2H-E2;2V-E1;3V-D7;2H-G1;3V-E4;2H-G6|15',
];

const EDGE_BY_LETTER: { [letter: string]: EEdge } = {
	T: EEdge.TOP,
	B: EEdge.BOTTOM,
	L: EEdge.LEFT,
	R: EEdge.RIGHT,
};

const ORIENTATION_BY_LETTER: { [letter: string]: EOrientation } = {
	V: EOrientation.VERTICAL,
	H: EOrientation.HORIZONTAL,
	F: EOrientation.FREE,
};

const COLOR_BY_LETTER: { [letter: string]: EPieceColor } = {
	R: EPieceColor.RED,
	B: EPieceColor.BLUE,
	'-': EPieceColor.NEUTRAL,
};

/** 'C3' -> 플레이 로컬 좌표 */
function parseCell(token: string): { row: number, col: number } {
	return {
		row: token.charCodeAt(0) - 65,
		col: parseInt(token.substring(1), 10) - 1,
	};
}

function splitTokens(section: string): string[] {
	return section === '' ? [] : section.split(';');
}

function decodeLevel(raw: string): RushHourFieldTableEntry {
	const parts = raw.split('|');
	const puzzleId = parts[0];
	// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
	const difficulty = parseInt(puzzleId.substring(5, 7), 10);

	const endPoints: RushHourEndPoint[] = [];
	for (const token of splitTokens(parts[1])) {
		const cell = parseCell(token.substring(2));
		endPoints.push({
			id: `END_${token.charAt(1)}_${token.substring(2)}`,
			edge: EDGE_BY_LETTER[token.charAt(0)],
			row: toFullGridIndex(cell.row),
			col: toFullGridIndex(cell.col),
			color: COLOR_BY_LETTER[token.charAt(1)],
		});
	}

	const placements: RushHourPlacement[] = [];
	for (const token of splitTokens(parts[2])) {
		const size = parseInt(token.charAt(0), 10);
		const colorLetter = token.charAt(2);
		const isGoal = colorLetter !== '-';
		const cell = parseCell(token.substring(3));
		placements.push({
			objectId: isGoal
				? (colorLetter === 'R' ? 'USB_RED' : 'USB_BLUE')
				: `BLOCK_${size}x1`,
			row: cell.row,
			col: cell.col,
			orientation: ORIENTATION_BY_LETTER[token.charAt(1)],
			color: COLOR_BY_LETTER[colorLetter],
			isGoal: isGoal,
		});
	}

	return {
		puzzleId: puzzleId,
		difficulty: difficulty,
		endPoints: endPoints,
		placements: placements,
		objectCount: placements.length,
		// 기획 데이터에는 최소 이동 수가 없다. 필요하면 솔버로 구한다
		minimumMoves: -1,
	};
}

/** 기획 CSV 에서 뽑은 러시아워 필드 테이블 (53판) */
export const RUSHHOUR_CSV_FIELD_TABLE: RushHourFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
