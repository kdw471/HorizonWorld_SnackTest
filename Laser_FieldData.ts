/**
 * !!! 자동 생성 파일 — 직접 수정하지 말 것 !!!
 *
 * 생성기: Documents/Tools/build_fielddata.py
 * 원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_01_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_01_ObjectData.csv
 *
 * 레이저 퍼즐(PUZ_01) 기획 필드 테이블 75판.
 * 난이도별 판 수: D1 3판, D2 20판, D3 21판, D4 11판, D5 10판, D6 10판
 *
 * 인코딩: `인덱스|기믹|고정크리스탈|인벤토리`
 *   기믹        : <종류><색><칸>  종류 E 발사체 / R 수신체 / Y 중계체 / K 해골, 색 R/G/B/-
 *   고정크리스탈 : <종류><방향><칸>  종류 T 삼각 / X 십자 / F 흡수, 방향 1 ◸ 2 ◹ 3 ◺ 4 ◿ / -
 *   인벤토리    : <종류><방향>
 *   칸          : A1..G7 (행 A~G = 전체 그리드 0~6, 열 1~7 = 0~6)
 *
 * 발사체/수신체는 테두리, 중계체/해골/고정크리스탈은 안쪽 5x5 에만 놓인다 (§2 / §5.1).
 * 발사 방향은 테두리 위치에서 유도되므로(getInwardDirection) 따로 저장하지 않는다.
 */
import {
	ECrystalType,
	EGimmickType,
	ELaserColor,
	ETriangleCorner,
	LaserCrystal,
	LaserGimmick,
	LaserPlacedCrystal,
	toPlacementLocalIndex,
} from 'Laser_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { LaserFieldTableEntry } from 'Laser_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type LaserCsvObjectRow = {
	objectId: string,
	/** true 면 인벤토리로 지급되는 이동 크리스탈, false 면 필드 고정물 */
	movable: boolean,
	/** 01 발사체 / 02 수신체 / 03 중계체 / 04 해골 / 05 삼각 / 06 십자 / 07 흡수 */
	category: string,
	/** 01 R / 02 G / 03 B / 00 무색 */
	color: string,
	meshPath: string,
	description: string,
}

/** NPUZ_01_ObjectData.csv 전체 (40행) */
export const LASER_CSV_OBJECT_ROWS: LaserCsvObjectRow[] = [
	{ objectId: '4010101001', movable: false, category: '01', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_U.SM_NPUZ_01_Laser_Start_U\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▲R' },
	{ objectId: '4010102002', movable: false, category: '01', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_U.SM_NPUZ_01_Laser_Start_U\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▲G' },
	{ objectId: '4010103003', movable: false, category: '01', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_U.SM_NPUZ_01_Laser_Start_U\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▲B' },
	{ objectId: '4010101004', movable: false, category: '01', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_D.SM_NPUZ_01_Laser_Start_D\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▼R' },
	{ objectId: '4010102005', movable: false, category: '01', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_D.SM_NPUZ_01_Laser_Start_D\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▼G' },
	{ objectId: '4010103006', movable: false, category: '01', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_D.SM_NPUZ_01_Laser_Start_D\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▼B' },
	{ objectId: '4010101007', movable: false, category: '01', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_L.SM_NPUZ_01_Laser_Start_L\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ◀R' },
	{ objectId: '4010102008', movable: false, category: '01', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_L.SM_NPUZ_01_Laser_Start_L\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ◀G' },
	{ objectId: '4010103009', movable: false, category: '01', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_L.SM_NPUZ_01_Laser_Start_L\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ◀B' },
	{ objectId: '4010101010', movable: false, category: '01', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_R.SM_NPUZ_01_Laser_Start_R\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▶R' },
	{ objectId: '4010102011', movable: false, category: '01', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_R.SM_NPUZ_01_Laser_Start_R\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▶G' },
	{ objectId: '4010103012', movable: false, category: '01', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Start_R.SM_NPUZ_01_Laser_Start_R\'', description: '[고정]퍼즐퀘스트1 레이저 발사체 ▶B' },
	{ objectId: '4010201013', movable: false, category: '02', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_U.SM_NPUZ_01_Laser_End_U\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 △R' },
	{ objectId: '4010202014', movable: false, category: '02', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_U.SM_NPUZ_01_Laser_End_U\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 △G' },
	{ objectId: '4010203015', movable: false, category: '02', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_U.SM_NPUZ_01_Laser_End_U\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 △B' },
	{ objectId: '4010201016', movable: false, category: '02', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_D.SM_NPUZ_01_Laser_End_D\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ▽R' },
	{ objectId: '4010202017', movable: false, category: '02', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_D.SM_NPUZ_01_Laser_End_D\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ▽G' },
	{ objectId: '4010203018', movable: false, category: '02', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_D.SM_NPUZ_01_Laser_End_D\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ▽B' },
	{ objectId: '4010201019', movable: false, category: '02', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_L.SM_NPUZ_01_Laser_End_L\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ◁R' },
	{ objectId: '4010202020', movable: false, category: '02', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_L.SM_NPUZ_01_Laser_End_L\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ◁G' },
	{ objectId: '4010203021', movable: false, category: '02', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_L.SM_NPUZ_01_Laser_End_L\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ◁B' },
	{ objectId: '4010201022', movable: false, category: '02', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_R.SM_NPUZ_01_Laser_End_R\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ▷R' },
	{ objectId: '4010202023', movable: false, category: '02', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_R.SM_NPUZ_01_Laser_End_R\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ▷G' },
	{ objectId: '4010203024', movable: false, category: '02', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_End_R.SM_NPUZ_01_Laser_End_R\'', description: '[고정]퍼즐퀘스트1 레이저 수신체 ▷B' },
	{ objectId: '4010301025', movable: false, category: '03', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Relay.SM_NPUZ_01_Laser_Relay\'', description: '[고정]퍼즐퀘스트1 레이저 중계체 ⊚R' },
	{ objectId: '4010302026', movable: false, category: '03', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Relay.SM_NPUZ_01_Laser_Relay\'', description: '[고정]퍼즐퀘스트1 레이저 중계체 ⊚G' },
	{ objectId: '4010303027', movable: false, category: '03', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Relay.SM_NPUZ_01_Laser_Relay\'', description: '[고정]퍼즐퀘스트1 레이저 중계체 ⊚B' },
	{ objectId: '4010400028', movable: false, category: '04', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laser_Fail.SM_NPUZ_01_Laser_Fail\'', description: '[고정]퍼즐퀘스트1 해골 크리스탈 ☢' },
	{ objectId: '4010500029', movable: false, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_UR.SM_NPUZ_01_Laserobj_01_UR\'', description: '[고정]퍼즐퀘스트1 크리스탈 1 (◸삼각)' },
	{ objectId: '4010500030', movable: false, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_UL.SM_NPUZ_01_Laserobj_01_UL\'', description: '[고정]퍼즐퀘스트1 크리스탈 1 (◹삼각)' },
	{ objectId: '4010500031', movable: false, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_DR.SM_NPUZ_01_Laserobj_01_DR\'', description: '[고정]퍼즐퀘스트1 크리스탈 1 (◺삼각)' },
	{ objectId: '4010500032', movable: false, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_DL.SM_NPUZ_01_Laserobj_01_DL\'', description: '[고정]퍼즐퀘스트1 크리스탈 1 ( ◿삼각)' },
	{ objectId: '4010600033', movable: false, category: '06', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_02.SM_NPUZ_01_Laserobj_02\'', description: '[고정]퍼즐퀘스트1 크리스탈 2 (⊡+십자)' },
	{ objectId: '4010700034', movable: false, category: '07', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_03.SM_NPUZ_01_Laserobj_03\'', description: '[고정]퍼즐퀘스트1 크리스탈 3 (❖흡수)' },
	{ objectId: '4020500035', movable: true, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_UR.SM_NPUZ_01_Laserobj_01_UR\'', description: '[이동]퍼즐퀘스트1 크리스탈 1 (◤삼각)' },
	{ objectId: '4020500036', movable: true, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_UL.SM_NPUZ_01_Laserobj_01_UL\'', description: '[이동]퍼즐퀘스트1 크리스탈 1 (◥삼각)' },
	{ objectId: '4020500037', movable: true, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_DR.SM_NPUZ_01_Laserobj_01_DR\'', description: '[이동]퍼즐퀘스트1 크리스탈 1 (◣삼각)' },
	{ objectId: '4020500038', movable: true, category: '05', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_01_DL.SM_NPUZ_01_Laserobj_01_DL\'', description: '[이동]퍼즐퀘스트1 크리스탈 1 (◢삼각)' },
	{ objectId: '4020600039', movable: true, category: '06', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_02.SM_NPUZ_01_Laserobj_02\'', description: '[이동]퍼즐퀘스트1 크리스탈 2 (▉+십자)' },
	{ objectId: '4020700040', movable: true, category: '07', color: '00', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_01/Meshs/SM_NPUZ_01_Laserobj_03.SM_NPUZ_01_Laserobj_03\'', description: '[이동]퍼즐퀘스트1 크리스탈 3 (✿흡수)' },
];

/** NPUZ_01_FieldData.csv 전체 (75행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
	'8000101001|ERA2;RRE7||T3',
	'8000101002|ERB1;RRF7||T2;T3',
	'8000101003|ERA3;EBC1;RRE7;RBG5||T2;T3',
	'8000102001|ERA2;ERA4;RRD7;RRG6||T3;T3;T2',
	'8000102002|EBB7;RBE7||T1;T3',
	'8000102003|RGC7;EGF1||T1;T4',
	'8000102004|RRB7;RRD1;RRD7;ERF1||T1;X-;T4',
	'8000102005|RBB1;EBD7;RBG2;RBG4||T2;T1;X-',
	'8000102006|RGA3;RGA5;EGF1||X-;T4',
	'8000102007|ERA2;EGA4;EBA6;RBG2;RGG4;RRG6||X-;X-',
	'8000102008|ERA2;EBA6;RBG2;RRG6||X-;X-',
	'8000102009|RRB1;ERD1;RRD7;RRF1||T2;X-;T4',
	'8000102010|ERA2;RRA4;RRD7;RRG4||T3;X-',
	'8000102011|EGD1;RGE1;RGE7;RGF1||T2;X-;T4',
	'8000102012|RBA5;EBB1;RBE7;EBG4;RBG5;RBG6||T2;T1;X-',
	'8000102013|RRA2;RRA3;ERD7;ERE7;RRG2;RRG3||T3;X-;T1',
	'8000102014|RGA2;EGA3;RGC1;EGE1;RGG5||T2;T3;X-;T4',
	'8000102015|EBB7;RBE1;RBF7||T1;T2;T3;X-',
	'8000102016|ERA2;ERA5;RRB7;RRF7;RRG3||T3;T3;T2;X-',
	'8000102017|EGC1;EGC7;RGD1;RGE7||T2;T1;T4;T3',
	'8000102018|EBA2;RBA3;EBB7;RBC7;RBE1;EBF1;RBG5;EBG6||T1;T3;T2;T4',
	'8000102019|RRA2;RRB1;RRE1;RRE7;RRG2;ERG4||X-;T2;X-',
	'8000102020|RGA3;RGA6;RGB7;EGC1;EGD1;EGE1||T1;T4;T4;T4',
	'8000103001|ERA4;RRA6;RRE1;RRE7;RRG4;RRG6||X-;X-',
	'8000103002|ERA3;EBA5;RBC1;RBC7;RRE1;YRF4;RRG3;RBG5||X-;X-;T2',
	'8000103003|EBA4;RBD1;YBD3;RBD7;RBE1;YBE5;RBE7;RBG4||X-;X-',
	'8000103004|ERA2;RRB1;RRB7;YRD2;RRE7||X-;T3',
	'8000103005|ERA2;YRC4;YRF5;RRG4||T1;T2;T3;T4',
	'8000103006|EGA5;YGB5;YGC6;RGC7;RRE1;YRE2;YRF3;ERG3||T3;T2',
	'8000103007|ERA2;RRA5;YRE3;RRF7||T3;X-;T4;T3',
	'8000103008|RRA4;YRE4;YRE5;ERG6||T1;T2;T3;T4',
	'8000103009|YGD5;RGD7;YGE4;EGG5||T1;T3;T2',
	'8000103010|YBB4;EBB7;YBC4;YBD4;YBE4;RBF1;YBF4||T1;T3;T2;T1;T4;T3;T2;T4',
	'8000103011|RRA6;ERD1;K-D5||T2;T3;T4',
	'8000103012|EBA3;RRA6;RBB1;ERD1;K-E4;YBE5||T2;T4;T3;T4',
	'8000103013|ERA3;RGC1;YGC4;YRD3;RRE7;EGG5||T2;T3',
	'8000103014|ERA3;RRC1;YRC5||T2;T3;T4',
	'8000103015|ERB1;RBC1;YRC5;YBD3;YRD5;YBE3;RRE7;EBF7||T2;T2;T3;T3',
	'8000103016|ERA2;EGA4;YRE3;YGE5;RRG3;RGG5||T3;T2;T3;T2',
	'8000103017|YBB2;RBC1;YBF3;RBF7;EBG4||X-;T2;T3',
	'8000103018|EBB1;YBC4;YBD5;RBE1;YBE3;RBF7||T2;X-;T2;T4;T3',
	'8000103019|ERA3;RRA4;RRC1;YRC5;RRD1;ERD7;RRG4||T2;X-;T3;T4',
	'8000103020|RGA2;RGA3;RGA4;RGA5;RGA6;RGB1;EGB7;EGC1;RGC7;RGD1;EGD7;EGE1;RGE7;RGF1;EGF7;RGG2;RGG3;RGG4;RGG5;RGG6||X-;X-;X-;X-;X-',
	'8000103021|ERC1;K-C5;YRD3;YRE4;RRG5||T2;T3;T2',
	'8000104001|EGA5;YGC4;RGD1;YGD4;K-D6;YGE4||T1;T2;X-;T1;T3;T4',
	'8000104002|EGA2;ERA3;EBA4;YBC5;RBC7;YGD5;RGD7;YRF4;RRF7||T3;T3;T3',
	'8000104003|YRB3;ERC1;YRC5;YRD4;YRE2;YRF4;RRG5|T2B5;T2D6|T1;T2;T1;T3;T4;T3;T4',
	'8000104004|ERA3;EGA5;EBA6;YRE4;YGE6;RBF7;RRG4;RGG6||T1;T4;T3;T2;T3;T2;T3',
	'8000104005|EGA4;RGC1;RGD1;K-D6;RGE7||T2;X-;T4;T3',
	'8000104006|RBA4;ERA5;RBA6;YBB3;EBB7;YBF4;RRG5|T4C5|T1;X-;T1;T3;T2;T3;T4',
	'8000104007|ERA3;K-D2;YRD4;YRD6;RRD7;RRG5||T3;T2;F-;X-',
	'8000104008|RBA4;RBB1;YBB5;EBF1;K-F5;YBF6||X-;T2;T4',
	'8000104009|EGA2;RGA4;EGB7;RGC7;K-D6;EGF1;RGG3;RGG5;EGG6||T1;T1;T3;T4;T4;T1;T2',
	'8000104010|RRA4;ERB1;EGC1;YGC5;EBD1;YRD3;RBF7;RGG6||T2;T2;T2;T3;T4;T3',
	'8000104011|ERB1;RBC7;EBE1;YBE4;YRF4;RRF7||T2;T1;T4;T3',
	'8000105001|ERA2;K-B6;K-C2;EGD1;YGD2;YRD4;K-D5;RGE1;EBF7;RBG3;RRG4|T4D3|T3;T2;T1;T2;T4;T1',
	'8000105002|EBA5;K-C2;RBC7;K-E2;RBE7;RBG3;RBG4;RBG5||T1;X-;T1;X-',
	'8000105003|RBA2;EBB1;YBB3;YGC4;YRD5;RRD7;EGE1;YGE3;RGG3;ERG4||T2;T1;T2;T1;T4;T3;T4',
	'8000105004|ERA2;YGC5;RRD1;EGE1;YRF3;RGG4||T1;T2;T2;T4;T3;T4',
	'8000105005|ERA2;YRC3;YRC4;YRC5;YRD3;YRD4;YRD5;YRE3;YRE4;YRE5;RRG3||T1;T2;X-;X-;T3;T4',
	'8000105006|RGA4;RGC1;RGC7;YGD3;YGD4;YGD5;EGG4||T2;T1;T3;X-;T4',
	'8000105007|RBA2;EBA5;YBD2;YGD3;K-D4;YBD5;YGD6;EGG3;RGG6||T1;T2;T3;T4',
	'8000105008|ERA2;RBA3;EBA5;RRC1;YRC4;YRF3;K-F6|T3E3;T3F2|T1;T2;T4;T4;T4',
	'8000105009|ERA2;ERA3;ERA4;ERA5;RRA6;RRB7;RRC1;RRD1;K-F2;K-F3;K-F4;K-F5;K-F6||T3;T4;T4;T3;T4',
	'8000105010|ERB1;RRB7;YRC4;EGD1;K-D4;RGD7;EBF1;YBF4;RBF7|T2B2;T1B3;T3F6|T2;T1;T3;T4;T4;T3;T1;T2;T4',
	'8000106001|EGA3;ERA4;RGA5;RGE1;K-E6;RRF1;K-F6;RGG3||X-;T4;T4',
	'8000106002|ERA3;RRC7;K-E3;YRF3||T1;T3;T2;T3;T4',
	'8000106003|RRA2;YGB4;EGD1;ERD7;YRF4;RGG6|F-D4|T1;T2;T4;T1;T3;T4',
	'8000106004|RGA4;EGA5;K-C2;K-D2;YGD5;K-E2;K-F5;RGG3|T2C6;T4D6|T1;X-;T3;F-',
	'8000106005|EGA2;YGC3;YGC5;K-D2;K-D3;K-D5;K-D6;YGF3;YGF5;RGG4||T3;T2;X-;X-',
	'8000106006|EBA4;K-C3;YBC4;K-C5;YBD3;YBD5;K-E3;YBE4;K-E5;RBG6|T3D4|T1;T2;X-;T4;T3;X-;T2',
	'8000106007|ERA4;K-B2;K-B6;YRC4;K-C5;YRD5;K-E2;YRE4;K-F4;RRG3|X-B4|F-;F-;T3;T2;T1;T4',
	'8000106008|RBA4;EBB1;YBC4;YBC5;YBD4;YBD5;K-F4;RBF7||X-;T2;F-;T3',
	'8000106009|YGC3;K-C4;YGC5;YGE4;YGF4;RGG2;EGG6|T1B3;T2B5|T3;T2;T1;T4',
	'8000106010|RRA5;YRB3;YRB6;RRB7;YRE5;YRE6;ERG4|X-D4|T1;T3;T2;T3;T4',
];

const COLOR_BY_LETTER: { [letter: string]: ELaserColor } = {
	R: ELaserColor.RED,
	G: ELaserColor.GREEN,
	B: ELaserColor.BLUE,
};

const GIMMICK_BY_LETTER: { [letter: string]: EGimmickType } = {
	E: EGimmickType.EMITTER,
	R: EGimmickType.RECEIVER,
	Y: EGimmickType.RELAY,
	K: EGimmickType.SKULL,
};

const CORNER_BY_DIGIT: { [digit: string]: ETriangleCorner } = {
	'1': ETriangleCorner.TOP_LEFT,
	'2': ETriangleCorner.TOP_RIGHT,
	'3': ETriangleCorner.BOTTOM_LEFT,
	'4': ETriangleCorner.BOTTOM_RIGHT,
};

/** 'C3' -> 전체 그리드 좌표 */
function parseCell(token: string): { row: number, col: number } {
	return {
		row: token.charCodeAt(0) - 65,
		col: parseInt(token.substring(1), 10) - 1,
	};
}

function parseCrystal(id: string, kind: string, direction: string): LaserCrystal {
	if (kind === 'T') {
		return { id: id, type: ECrystalType.TRIANGLE, corner: CORNER_BY_DIGIT[direction] };
	}
	if (kind === 'X') {
		return { id: id, type: ECrystalType.CROSS };
	}
	return { id: id, type: ECrystalType.FLOWER };
}

function splitTokens(section: string): string[] {
	return section === '' ? [] : section.split(';');
}

function decodeLevel(raw: string): LaserFieldTableEntry {
	const parts = raw.split('|');
	const puzzleId = parts[0];
	// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
	const difficulty = parseInt(puzzleId.substring(5, 7), 10);

	const gimmicks: LaserGimmick[] = [];
	for (const token of splitTokens(parts[1])) {
		const type = GIMMICK_BY_LETTER[token.charAt(0)];
		const colorLetter = token.charAt(1);
		const cell = parseCell(token.substring(2));
		gimmicks.push({
			id: `${token.charAt(0)}${colorLetter}_${token.substring(2)}`,
			type: type,
			row: cell.row,
			col: cell.col,
			colors: colorLetter === '-' ? [] : [COLOR_BY_LETTER[colorLetter]],
		});
	}

	const presetCrystals: LaserPlacedCrystal[] = [];
	for (const token of splitTokens(parts[2])) {
		const cellToken = token.substring(2);
		const cell = parseCell(cellToken);
		const crystal = parseCrystal(`FX_${cellToken}`, token.charAt(0), token.charAt(1));
		presetCrystals.push({
			...crystal,
			// 고정 크리스탈은 배치 영역(5x5) 로컬 좌표로 저장한다
			row: toPlacementLocalIndex(cell.row),
			col: toPlacementLocalIndex(cell.col),
			isFixed: true,
		});
	}

	const inventory: LaserCrystal[] = [];
	const tokens = splitTokens(parts[3]);
	for (let i = 0; i < tokens.length; i++) {
		inventory.push(parseCrystal(`INV_${i}`, tokens[i].charAt(0), tokens[i].charAt(1)));
	}

	return {
		puzzleId: puzzleId,
		difficulty: difficulty,
		gimmicks: gimmicks,
		presetCrystals: presetCrystals,
		inventory: inventory,
	};
}

/** 기획 CSV 에서 뽑은 레이저 필드 테이블 (75판) */
export const LASER_CSV_FIELD_TABLE: LaserFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
