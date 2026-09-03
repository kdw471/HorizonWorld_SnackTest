/**
 * !!! 자동 생성 파일 — 직접 수정하지 말 것 !!!
 *
 * 생성기: Documents/Tools/build_fielddata.py
 * 원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_08_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_08_ObjectData.csv
 *
 * 스위치 퍼즐(PUZ_08) 기획 필드 테이블 87판.
 * 난이도별 (판 수 / 키 캡 수 / 최소 누름 수): D1 (20판 / 9~9칸 / 1~2수), D2 (23판 / 9~9칸 / 2~3수), D3 (14판 / 15~15칸 / 3~7수), D4 (16판 / 21~25칸 / 5~13수), D5 (14판 / 21~25칸 / 4~11수)
 * 도장(3x3 마스크) 20종.
 *
 * 원본 CSV 는 다른 퍼즐과 달리 **초기 눌림 상태를 그대로** 담고 있다.
 *   0 = 안 눌림(빨강) / 1 = 눌림(녹색, 목표 상태) / 2 = FREE(키 캡 없음)
 * 그래서 이 판들은 역셔플로 만들지 않고 데이터 그대로 로드한다 (`initialRows`).
 * `shuffleCount` 에는 GF(2) 선형대수로 미리 구한 **최소 누름 수**를 넣었다.
 */
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { SwitchFieldTableEntry, SwitchObjectTableEntry } from 'Switch_DataTables';

/**
 * NPUZ_08_ObjectData.csv 의 도장 20종.
 * `switchAreaId` 에 원본 오브젝트 ID 를 그대로 쓴다.
 */
export const SWITCH_CSV_OBJECT_TABLE: SwitchObjectTableEntry[] = [
	{ switchAreaId: '4700000001', name: '기획 도장 001', maskRows: ['010', '111', '010'] },
	{ switchAreaId: '4700000002', name: '기획 도장 002', maskRows: ['101', '010', '101'] },
	{ switchAreaId: '4700000003', name: '기획 도장 003', maskRows: ['000', '111', '000'] },
	{ switchAreaId: '4700000004', name: '기획 도장 004', maskRows: ['010', '010', '010'] },
	{ switchAreaId: '4700000005', name: '기획 도장 005', maskRows: ['100', '010', '001'] },
	{ switchAreaId: '4700000006', name: '기획 도장 006', maskRows: ['001', '010', '100'] },
	{ switchAreaId: '4700000007', name: '기획 도장 007', maskRows: ['101', '111', '101'] },
	{ switchAreaId: '4700000008', name: '기획 도장 008', maskRows: ['111', '010', '111'] },
	{ switchAreaId: '4700000009', name: '기획 도장 009', maskRows: ['010', '111', '000'] },
	{ switchAreaId: '4700000010', name: '기획 도장 010', maskRows: ['010', '011', '010'] },
	{ switchAreaId: '4700000011', name: '기획 도장 011', maskRows: ['000', '111', '010'] },
	{ switchAreaId: '4700000012', name: '기획 도장 012', maskRows: ['010', '110', '010'] },
	{ switchAreaId: '4700000013', name: '기획 도장 013', maskRows: ['010', '011', '000'] },
	{ switchAreaId: '4700000014', name: '기획 도장 014', maskRows: ['000', '011', '010'] },
	{ switchAreaId: '4700000015', name: '기획 도장 015', maskRows: ['000', '110', '010'] },
	{ switchAreaId: '4700000016', name: '기획 도장 016', maskRows: ['010', '110', '000'] },
	{ switchAreaId: '4700000017', name: '기획 도장 017', maskRows: ['101', '010', '000'] },
	{ switchAreaId: '4700000018', name: '기획 도장 018', maskRows: ['001', '010', '001'] },
	{ switchAreaId: '4700000019', name: '기획 도장 019', maskRows: ['000', '010', '101'] },
	{ switchAreaId: '4700000020', name: '기획 도장 020', maskRows: ['100', '010', '100'] },
];

/**
 * NPUZ_08_FieldData.csv 전체 (87행).
 * `index` 는 구현 기본 행(1~5)과 겹치지 않도록 100 부터 매긴다.
 */
export const SWITCH_CSV_FIELD_TABLE: SwitchFieldTableEntry[] = [
	{
		index: 100, puzzleId: '8000801001', difficulty: 1, switchAreaId: '4700000001', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.000.', '.101.', '.....'],
	},
	{
		index: 101, puzzleId: '8000801002', difficulty: 1, switchAreaId: '4700000002', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.101.', '.010.', '.....'],
	},
	{
		index: 102, puzzleId: '8000801003', difficulty: 1, switchAreaId: '4700000003', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.000.', '.111.', '.....'],
	},
	{
		index: 103, puzzleId: '8000801004', difficulty: 1, switchAreaId: '4700000004', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.101.', '.101.', '.....'],
	},
	{
		index: 104, puzzleId: '8000801005', difficulty: 1, switchAreaId: '4700000005', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.011.', '.101.', '.110.', '.....'],
	},
	{
		index: 105, puzzleId: '8000801006', difficulty: 1, switchAreaId: '4700000006', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.110.', '.101.', '.011.', '.....'],
	},
	{
		index: 106, puzzleId: '8000801007', difficulty: 1, switchAreaId: '4700000007', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.000.', '.010.', '.....'],
	},
	{
		index: 107, puzzleId: '8000801008', difficulty: 1, switchAreaId: '4700000008', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.000.', '.101.', '.000.', '.....'],
	},
	{
		index: 108, puzzleId: '8000801009', difficulty: 1, switchAreaId: '4700000009', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.000.', '.111.', '.....'],
	},
	{
		index: 109, puzzleId: '8000801010', difficulty: 1, switchAreaId: '4700000010', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.100.', '.101.', '.....'],
	},
	{
		index: 110, puzzleId: '8000801011', difficulty: 1, switchAreaId: '4700000011', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.000.', '.101.', '.....'],
	},
	{
		index: 111, puzzleId: '8000801012', difficulty: 1, switchAreaId: '4700000012', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.001.', '.101.', '.....'],
	},
	{
		index: 112, puzzleId: '8000801013', difficulty: 1, switchAreaId: '4700000013', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.100.', '.111.', '.....'],
	},
	{
		index: 113, puzzleId: '8000801014', difficulty: 1, switchAreaId: '4700000014', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.100.', '.101.', '.....'],
	},
	{
		index: 114, puzzleId: '8000801015', difficulty: 1, switchAreaId: '4700000015', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.001.', '.101.', '.....'],
	},
	{
		index: 115, puzzleId: '8000801016', difficulty: 1, switchAreaId: '4700000016', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.001.', '.111.', '.....'],
	},
	{
		index: 116, puzzleId: '8000801017', difficulty: 1, switchAreaId: '4700000017', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.101.', '.111.', '.....'],
	},
	{
		index: 117, puzzleId: '8000801018', difficulty: 1, switchAreaId: '4700000018', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.110.', '.101.', '.110.', '.....'],
	},
	{
		index: 118, puzzleId: '8000801019', difficulty: 1, switchAreaId: '4700000019', shuffleCount: 1,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.101.', '.010.', '.....'],
	},
	{
		index: 119, puzzleId: '8000801020', difficulty: 1, switchAreaId: '4700000020', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.101.', '.010.', '.....'],
	},
	{
		index: 120, puzzleId: '8000802001', difficulty: 2, switchAreaId: '4700000001', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.001.', '.010.', '.100.', '.....'],
	},
	{
		index: 121, puzzleId: '8000802002', difficulty: 2, switchAreaId: '4700000001', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.100.', '.010.', '.001.', '.....'],
	},
	{
		index: 122, puzzleId: '8000802003', difficulty: 2, switchAreaId: '4700000002', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.111.', '.101.', '.....'],
	},
	{
		index: 123, puzzleId: '8000802004', difficulty: 2, switchAreaId: '4700000002', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.010.', '.111.', '.....'],
	},
	{
		index: 124, puzzleId: '8000802005', difficulty: 2, switchAreaId: '4700000003', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.010.', '.111.', '.....'],
	},
	{
		index: 125, puzzleId: '8000802006', difficulty: 2, switchAreaId: '4700000003', shuffleCount: 3,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.000.', '.000.', '.000.', '.....'],
	},
	{
		index: 126, puzzleId: '8000802007', difficulty: 2, switchAreaId: '4700000004', shuffleCount: 3,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.000.', '.000.', '.000.', '.....'],
	},
	{
		index: 127, puzzleId: '8000802008', difficulty: 2, switchAreaId: '4700000005', shuffleCount: 3,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.101.', '.010.', '.....'],
	},
	{
		index: 128, puzzleId: '8000802009', difficulty: 2, switchAreaId: '4700000006', shuffleCount: 3,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.101.', '.010.', '.....'],
	},
	{
		index: 129, puzzleId: '8000802010', difficulty: 2, switchAreaId: '4700000007', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.111.', '.010.', '.111.', '.....'],
	},
	{
		index: 130, puzzleId: '8000802011', difficulty: 2, switchAreaId: '4700000008', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.111.', '.101.', '.....'],
	},
	{
		index: 131, puzzleId: '8000802012', difficulty: 2, switchAreaId: '4700000009', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.000.', '.101.', '.000.', '.....'],
	},
	{
		index: 132, puzzleId: '8000802013', difficulty: 2, switchAreaId: '4700000010', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.000.', '.010.', '.....'],
	},
	{
		index: 133, puzzleId: '8000802014', difficulty: 2, switchAreaId: '4700000011', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.000.', '.101.', '.000.', '.....'],
	},
	{
		index: 134, puzzleId: '8000802015', difficulty: 2, switchAreaId: '4700000012', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.000.', '.010.', '.....'],
	},
	{
		index: 135, puzzleId: '8000802016', difficulty: 2, switchAreaId: '4700000013', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.000.', '.001.', '.....'],
	},
	{
		index: 136, puzzleId: '8000802017', difficulty: 2, switchAreaId: '4700000014', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.001.', '.000.', '.101.', '.....'],
	},
	{
		index: 137, puzzleId: '8000802018', difficulty: 2, switchAreaId: '4700000015', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.100.', '.000.', '.101.', '.....'],
	},
	{
		index: 138, puzzleId: '8000802019', difficulty: 2, switchAreaId: '4700000016', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.000.', '.100.', '.....'],
	},
	{
		index: 139, puzzleId: '8000802020', difficulty: 2, switchAreaId: '4700000017', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.010.', '.000.', '.101.', '.....'],
	},
	{
		index: 140, puzzleId: '8000802021', difficulty: 2, switchAreaId: '4700000018', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.100.', '.001.', '.100.', '.....'],
	},
	{
		index: 141, puzzleId: '8000802022', difficulty: 2, switchAreaId: '4700000019', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.101.', '.000.', '.010.', '.....'],
	},
	{
		index: 142, puzzleId: '8000802023', difficulty: 2, switchAreaId: '4700000020', shuffleCount: 2,
		layoutRows: ['.....', '.OOO.', '.OOO.', '.OOO.', '.....'],
		initialRows: ['.....', '.001.', '.100.', '.001.', '.....'],
	},
	{
		index: 143, puzzleId: '8000803001', difficulty: 3, switchAreaId: '4700000001', shuffleCount: 3,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '10001', '01010', '10001', '.....'],
	},
	{
		index: 144, puzzleId: '8000803002', difficulty: 3, switchAreaId: '4700000001', shuffleCount: 3,
		layoutRows: ['.OOO.', '.OOO.', '.OOO.', '.OOO.', '.OOO.'],
		initialRows: ['.101.', '.010.', '.000.', '.010.', '.101.'],
	},
	{
		index: 145, puzzleId: '8000803003', difficulty: 3, switchAreaId: '4700000001', shuffleCount: 7,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '01110', '10001', '01110', '.....'],
	},
	{
		index: 146, puzzleId: '8000803004', difficulty: 3, switchAreaId: '4700000001', shuffleCount: 6,
		layoutRows: ['.OOO.', '.OOO.', '.OOO.', '.OOO.', '.OOO.'],
		initialRows: ['.010.', '.111.', '.010.', '.111.', '.010.'],
	},
	{
		index: 147, puzzleId: '8000803005', difficulty: 3, switchAreaId: '4700000003', shuffleCount: 7,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '00100', '01010', '00100', '.....'],
	},
	{
		index: 148, puzzleId: '8000803006', difficulty: 3, switchAreaId: '4700000004', shuffleCount: 7,
		layoutRows: ['.OOO.', '.OOO.', '.OOO.', '.OOO.', '.OOO.'],
		initialRows: ['.000.', '.010.', '.101.', '.010.', '.000.'],
	},
	{
		index: 149, puzzleId: '8000803007', difficulty: 3, switchAreaId: '4700000005', shuffleCount: 7,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '01001', '00000', '10010', '.....'],
	},
	{
		index: 150, puzzleId: '8000803008', difficulty: 3, switchAreaId: '4700000006', shuffleCount: 7,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '10010', '00000', '01001', '.....'],
	},
	{
		index: 151, puzzleId: '8000803009', difficulty: 3, switchAreaId: '4700000007', shuffleCount: 3,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '00100', '01010', '00100', '.....'],
	},
	{
		index: 152, puzzleId: '8000803010', difficulty: 3, switchAreaId: '4700000008', shuffleCount: 3,
		layoutRows: ['.OOO.', '.OOO.', '.OOO.', '.OOO.', '.OOO.'],
		initialRows: ['.000.', '.010.', '.101.', '.010.', '.000.'],
	},
	{
		index: 153, puzzleId: '8000803011', difficulty: 3, switchAreaId: '4700000009', shuffleCount: 4,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '10001', '01110', '10001', '.....'],
	},
	{
		index: 154, puzzleId: '8000803012', difficulty: 3, switchAreaId: '4700000010', shuffleCount: 4,
		layoutRows: ['.OOO.', '.OOO.', '.OOO.', '.OOO.', '.OOO.'],
		initialRows: ['.101.', '.010.', '.010.', '.010.', '.101.'],
	},
	{
		index: 155, puzzleId: '8000803013', difficulty: 3, switchAreaId: '4700000011', shuffleCount: 4,
		layoutRows: ['.....', 'OOOOO', 'OOOOO', 'OOOOO', '.....'],
		initialRows: ['.....', '10001', '01110', '10001', '.....'],
	},
	{
		index: 156, puzzleId: '8000803014', difficulty: 3, switchAreaId: '4700000012', shuffleCount: 4,
		layoutRows: ['.OOO.', '.OOO.', '.OOO.', '.OOO.', '.OOO.'],
		initialRows: ['.101.', '.010.', '.010.', '.010.', '.101.'],
	},
	{
		index: 157, puzzleId: '8000804001', difficulty: 4, switchAreaId: '4700000001', shuffleCount: 5,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '00000', '10001', '00000', '.010.'],
	},
	{
		index: 158, puzzleId: '8000804002', difficulty: 4, switchAreaId: '4700000002', shuffleCount: 5,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.111.', '11111', '11011', '11111', '.111.'],
	},
	{
		index: 159, puzzleId: '8000804003', difficulty: 4, switchAreaId: '4700000003', shuffleCount: 8,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '10001', '00100', '10001', '.010.'],
	},
	{
		index: 160, puzzleId: '8000804004', difficulty: 4, switchAreaId: '4700000004', shuffleCount: 13,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '10001', '00100', '10001', '.010.'],
	},
	{
		index: 161, puzzleId: '8000804005', difficulty: 4, switchAreaId: '4700000005', shuffleCount: 6,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '01110', '11111', '01110', '.010.'],
	},
	{
		index: 162, puzzleId: '8000804006', difficulty: 4, switchAreaId: '4700000006', shuffleCount: 6,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '01110', '11111', '01110', '.010.'],
	},
	{
		index: 163, puzzleId: '8000804007', difficulty: 4, switchAreaId: '4700000009', shuffleCount: 9,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '00000', '11111', '00000', '.000.'],
	},
	{
		index: 164, puzzleId: '8000804008', difficulty: 4, switchAreaId: '4700000010', shuffleCount: 9,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '00100', '00101', '00100', '.010.'],
	},
	{
		index: 165, puzzleId: '8000804009', difficulty: 4, switchAreaId: '4700000011', shuffleCount: 9,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.000.', '00000', '11111', '00000', '.010.'],
	},
	{
		index: 166, puzzleId: '8000804010', difficulty: 4, switchAreaId: '4700000012', shuffleCount: 9,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '00100', '10100', '00100', '.010.'],
	},
	{
		index: 167, puzzleId: '8000804011', difficulty: 4, switchAreaId: '4700000005', shuffleCount: 5,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['01011', '11101', '01010', '10111', '11010'],
	},
	{
		index: 168, puzzleId: '8000804012', difficulty: 4, switchAreaId: '4700000006', shuffleCount: 5,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['11010', '10111', '01010', '11101', '01011'],
	},
	{
		index: 169, puzzleId: '8000804013', difficulty: 4, switchAreaId: '4700000005', shuffleCount: 10,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['01101', '10100', '11111', '00101', '10110'],
	},
	{
		index: 170, puzzleId: '8000804014', difficulty: 4, switchAreaId: '4700000006', shuffleCount: 10,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10110', '00101', '11111', '10100', '01101'],
	},
	{
		index: 171, puzzleId: '8000804015', difficulty: 4, switchAreaId: '4700000003', shuffleCount: 13,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10101', '00100', '10101', '00100', '10101'],
	},
	{
		index: 172, puzzleId: '8000804016', difficulty: 4, switchAreaId: '4700000004', shuffleCount: 13,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10101', '00000', '11111', '00000', '10101'],
	},
	{
		index: 173, puzzleId: '8000805007', difficulty: 5, switchAreaId: '4700000007', shuffleCount: 4,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.111.', '00100', '11111', '00100', '.111.'],
	},
	{
		index: 174, puzzleId: '8000805008', difficulty: 5, switchAreaId: '4700000008', shuffleCount: 4,
		layoutRows: ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'],
		initialRows: ['.010.', '10101', '11111', '10101', '.010.'],
	},
	{
		index: 175, puzzleId: '8000805001', difficulty: 5, switchAreaId: '4700000001', shuffleCount: 5,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['00100', '01010', '10001', '01010', '00100'],
	},
	{
		index: 176, puzzleId: '8000805002', difficulty: 5, switchAreaId: '4700000002', shuffleCount: 5,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10101', '00100', '11011', '00100', '10101'],
	},
	{
		index: 177, puzzleId: '8000805003', difficulty: 5, switchAreaId: '4700000003', shuffleCount: 11,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['01010', '10001', '01010', '10001', '01010'],
	},
	{
		index: 178, puzzleId: '8000805004', difficulty: 5, switchAreaId: '4700000004', shuffleCount: 11,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['01010', '10101', '00000', '10101', '01010'],
	},
	{
		index: 179, puzzleId: '8000805005', difficulty: 5, switchAreaId: '4700000003', shuffleCount: 8,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10001', '01010', '11111', '01010', '10001'],
	},
	{
		index: 180, puzzleId: '8000805006', difficulty: 5, switchAreaId: '4700000004', shuffleCount: 8,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10101', '01110', '00100', '01110', '10101'],
	},
	{
		index: 181, puzzleId: '8000805011', difficulty: 5, switchAreaId: '4700000007', shuffleCount: 4,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10101', '00100', '11111', '00100', '10101'],
	},
	{
		index: 182, puzzleId: '8000805012', difficulty: 5, switchAreaId: '4700000008', shuffleCount: 4,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10101', '00100', '11111', '00100', '10101'],
	},
	{
		index: 183, puzzleId: '8000805013', difficulty: 5, switchAreaId: '4700000007', shuffleCount: 6,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10101', '01110', '00100', '01110', '10101'],
	},
	{
		index: 184, puzzleId: '8000805014', difficulty: 5, switchAreaId: '4700000008', shuffleCount: 6,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['10001', '01010', '11111', '01010', '10001'],
	},
	{
		index: 185, puzzleId: '8000805015', difficulty: 5, switchAreaId: '4700000001', shuffleCount: 7,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['00100', '11011', '01010', '11011', '00100'],
	},
	{
		index: 186, puzzleId: '8000805016', difficulty: 5, switchAreaId: '4700000002', shuffleCount: 6,
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		initialRows: ['01110', '11111', '11111', '11111', '01110'],
	},
];
