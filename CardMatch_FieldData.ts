/**
 * !!! 자동 생성 파일 — 직접 수정하지 말 것 !!!
 *
 * 생성기: Documents/Tools/build_fielddata.py
 * 원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_06_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_06_ObjectData.csv
 *
 * 카드 맞추기 퍼즐(PUZ_06) 기획 필드 테이블 30판 (원본 60행 중 30행은 아직 값이 비어 있어 제외).
 * 난이도별 판 수: D1 10판, D3 10판, D5 10판
 * 배치별 판 수: 3x3 10판, 3x5 10판, 5x5 10판
 * 오브젝트 그룹별 종류 수: GROUP_0 1종, GROUP_1 15종, GROUP_2 17종, GROUP_3 15종, GROUP_4 17종
 *
 * 원본 CSV 는 배치를 직접 적지 않고 **필드 규격**만 담는다.
 * (오브젝트 그룹 ID / X열 / Y열 / 폭탄 수) 실제 타일 배치와 짝 배정은 런타임 생성기가 만든다.
 */
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { CardFieldTableEntry } from 'CardMatch_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type CardMatchCsvObjectRow = {
	objectId: string,
	/** GROUP_0 은 폭탄(함정), GROUP_1~4 는 챕터별 오브젝트 세트 */
	groupId: string,
	meshPath: string,
	levelSize: number,
}

/** NPUZ_06_ObjectData.csv 전체 (65행) */
export const CARDMATCH_CSV_OBJECT_ROWS: CardMatchCsvObjectRow[] = [
	{ objectId: '4500100001', groupId: 'GROUP_0', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_TumaiBomb.SM_NPUZ_06_TumaiBomb\'', levelSize: 1 },
	{ objectId: '4500000001', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_LoverDuck.SM_NPUZ_06_MU_LoverDuck\'', levelSize: 1 },
	{ objectId: '4500000002', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_ToyWand.SM_NPUZ_06_MU_ToyWand\'', levelSize: 1 },
	{ objectId: '4500000003', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_WalkyTalky.SM_NPUZ_06_MU_WalkyTalky\'', levelSize: 1 },
	{ objectId: '4500000004', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_Flower_3.SM_NPUZ_06_MU_Flower_3\'', levelSize: 1 },
	{ objectId: '4500000005', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_Flower_2.SM_NPUZ_06_MU_Flower_2\'', levelSize: 1 },
	{ objectId: '4500000006', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_Flower_1.SM_NPUZ_06_MU_Flower_1\'', levelSize: 1 },
	{ objectId: '4500000007', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_HolyGrail_3.SM_NPUZ_06_MU_HolyGrail_3\'', levelSize: 1 },
	{ objectId: '4500000008', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_HolyGrail_1.SM_NPUZ_06_MU_HolyGrail_1\'', levelSize: 1 },
	{ objectId: '4500000009', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Hamburger_1.SM_NPUZ_06_MC_Hamburger_1\'', levelSize: 1 },
	{ objectId: '4500000010', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Hamburger_2.SM_NPUZ_06_MC_Hamburger_2\'', levelSize: 1 },
	{ objectId: '4500000011', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_ToySword.SM_NPUZ_06_MU_ToySword\'', levelSize: 1 },
	{ objectId: '4500000012', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_LoverSwan.SM_NPUZ_06_MU_LoverSwan\'', levelSize: 1 },
	{ objectId: '4500000013', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_Statue_B_07.SM_NPUZ_06_MU_Statue_B_07\'', levelSize: 1 },
	{ objectId: '4500000014', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_Statue_B_08.SM_NPUZ_06_MU_Statue_B_08\'', levelSize: 1 },
	{ objectId: '4500000015', groupId: 'GROUP_1', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MU_CanopicJar_3.SM_NPUZ_06_MU_CanopicJar_3\'', levelSize: 1 },
	{ objectId: '4500000016', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Wagon.SM_NPUZ_06_WS_Wagon\'', levelSize: 1 },
	{ objectId: '4500000017', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Totem_1_Pieces_2.SM_NPUZ_06_WS_Totem_1_Pieces_2\'', levelSize: 1 },
	{ objectId: '4500000018', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Totem_2_Pieces_3.SM_NPUZ_06_WS_Totem_2_Pieces_3\'', levelSize: 1 },
	{ objectId: '4500000019', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Guitar2.SM_NPUZ_06_WS_Guitar2\'', levelSize: 1 },
	{ objectId: '4500000020', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Moneybag_1.SM_NPUZ_06_WS_Moneybag_1\'', levelSize: 1 },
	{ objectId: '4500000021', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Moneybag3.SM_NPUZ_06_WS_Moneybag3\'', levelSize: 1 },
	{ objectId: '4500000022', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Lantern_2.SM_NPUZ_06_WS_Lantern_2\'', levelSize: 1 },
	{ objectId: '4500000023', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Lantern_3.SM_NPUZ_06_WS_Lantern_3\'', levelSize: 1 },
	{ objectId: '4500000024', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Wine_1.SM_NPUZ_06_WS_Wine_1\'', levelSize: 1 },
	{ objectId: '4500000025', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Wine_2.SM_NPUZ_06_WS_Wine_2\'', levelSize: 1 },
	{ objectId: '4500000026', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Feather.SM_NPUZ_06_WS_Feather\'', levelSize: 1 },
	{ objectId: '4500000027', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Balloon2.SM_NPUZ_06_WS_Balloon2\'', levelSize: 1 },
	{ objectId: '4500000028', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Balloon.SM_NPUZ_06_WS_Balloon\'', levelSize: 1 },
	{ objectId: '4500000029', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Horse01A.SM_NPUZ_06_WS_Horse01A\'', levelSize: 1 },
	{ objectId: '4500000030', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_Horse01B.SM_NPUZ_06_WS_Horse01B\'', levelSize: 1 },
	{ objectId: '4500000031', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_CactusFlower_1.SM_NPUZ_06_WS_CactusFlower_1\'', levelSize: 1 },
	{ objectId: '4500000032', groupId: 'GROUP_2', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_WS_CactusFlower_2.SM_NPUZ_06_WS_CactusFlower_2\'', levelSize: 1 },
	{ objectId: '4500000033', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Meat_3.SM_NPUZ_06_MC_Meat_3\'', levelSize: 1 },
	{ objectId: '4500000034', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Meat_4.SM_NPUZ_06_MC_Meat_4\'', levelSize: 1 },
	{ objectId: '4500000035', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Pouch01.SM_NPUZ_06_MC_Pouch01\'', levelSize: 1 },
	{ objectId: '4500000036', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_RoadCone_1.SM_NPUZ_06_MC_RoadCone_1\'', levelSize: 1 },
	{ objectId: '4500000037', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Package_3B.SM_NPUZ_06_MC_Package_3B\'', levelSize: 1 },
	{ objectId: '4500000038', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_SubMarine01.SM_NPUZ_06_MC_SubMarine01\'', levelSize: 1 },
	{ objectId: '4500000039', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Toycar_1.SM_NPUZ_06_MC_Toycar_1\'', levelSize: 1 },
	{ objectId: '4500000040', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Toycar_3.SM_NPUZ_06_MC_Toycar_3\'', levelSize: 1 },
	{ objectId: '4500000041', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC10_Zepplin.SM_NPUZ_06_MC10_Zepplin\'', levelSize: 1 },
	{ objectId: '4500000042', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC07_InsideChair01.SM_NPUZ_06_MC07_InsideChair01\'', levelSize: 1 },
	{ objectId: '4500000043', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC07_InsideDeer.SM_NPUZ_06_MC07_InsideDeer\'', levelSize: 1 },
	{ objectId: '4500000044', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_Headphone.SM_NPUZ_06_MC_Headphone\'', levelSize: 1 },
	{ objectId: '4500000045', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_FruitCup_1.SM_NPUZ_06_MC_FruitCup_1\'', levelSize: 1 },
	{ objectId: '4500000046', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_FruitCup_2.SM_NPUZ_06_MC_FruitCup_2\'', levelSize: 1 },
	{ objectId: '4500000047', groupId: 'GROUP_3', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_MC_FruitCup_3.SM_NPUZ_06_MC_FruitCup_3\'', levelSize: 1 },
	{ objectId: '4500000048', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Spider_2.SM_NPUZ_06_HW_Spider_2\'', levelSize: 1 },
	{ objectId: '4500000049', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_JewelrvBox.SM_NPUZ_06_HW_JewelrvBox\'', levelSize: 1 },
	{ objectId: '4500000050', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_FoodIngredient_2.SM_NPUZ_06_HW_FoodIngredient_2\'', levelSize: 1 },
	{ objectId: '4500000051', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Skull_1.SM_NPUZ_06_HW_Skull_1\'', levelSize: 1 },
	{ objectId: '4500000052', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Pumpkin01A.SM_NPUZ_06_HW_Pumpkin01A\'', levelSize: 1 },
	{ objectId: '4500000053', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Doll_3.SM_NPUZ_06_HW_Doll_3\'', levelSize: 1 },
	{ objectId: '4500000054', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Doll_4.SM_NPUZ_06_HW_Doll_4\'', levelSize: 1 },
	{ objectId: '4500000055', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Horse.SM_NPUZ_06_HW_Horse\'', levelSize: 1 },
	{ objectId: '4500000056', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Statue.SM_NPUZ_06_HW_Statue\'', levelSize: 1 },
	{ objectId: '4500000057', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Ghost01.SM_NPUZ_06_HW_Ghost01\'', levelSize: 1 },
	{ objectId: '4500000058', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Statue_PT_5.SM_NPUZ_06_HW_Statue_PT_5\'', levelSize: 1 },
	{ objectId: '4500000059', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Bat.SM_NPUZ_06_HW_Bat\'', levelSize: 1 },
	{ objectId: '4500000060', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_CandleStick_2.SM_NPUZ_06_HW_CandleStick_2\'', levelSize: 1 },
	{ objectId: '4500000061', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_GhostShip.SM_NPUZ_06_HW_GhostShip\'', levelSize: 1 },
	{ objectId: '4500000062', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_HotPot02.SM_NPUZ_06_HW_HotPot02\'', levelSize: 1 },
	{ objectId: '4500000063', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Grave05.SM_NPUZ_06_HW_Grave05\'', levelSize: 1 },
	{ objectId: '4500000064', groupId: 'GROUP_4', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_06/Meshs/SM_NPUZ_06_HW_Grave06.SM_NPUZ_06_HW_Grave06\'', levelSize: 1 },
];

/**
 * NPUZ_06_FieldData.csv 에서 값이 채워진 30행.
 *
 * `index` 는 구현이 원래 들고 있던 기본 행(1~5)과 겹치지 않도록 100 부터 매긴다.
 * `puzzleId` 는 원본 인덱스를 그대로 쓴다.
 */
export const CARDMATCH_CSV_FIELD_TABLE: CardFieldTableEntry[] = [
	{ index: 100, puzzleId: '8000701001', difficulty: 1, objectGroupId: 'GROUP_1', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 101, puzzleId: '8000701002', difficulty: 1, objectGroupId: 'GROUP_1', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 102, puzzleId: '8000701003', difficulty: 1, objectGroupId: 'GROUP_1', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 103, puzzleId: '8000701004', difficulty: 1, objectGroupId: 'GROUP_2', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 104, puzzleId: '8000701005', difficulty: 1, objectGroupId: 'GROUP_2', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 105, puzzleId: '8000701006', difficulty: 1, objectGroupId: 'GROUP_2', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 106, puzzleId: '8000701007', difficulty: 1, objectGroupId: 'GROUP_3', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 107, puzzleId: '8000701008', difficulty: 1, objectGroupId: 'GROUP_3', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 108, puzzleId: '8000701009', difficulty: 1, objectGroupId: 'GROUP_4', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 109, puzzleId: '8000701010', difficulty: 1, objectGroupId: 'GROUP_4', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 110, puzzleId: '8000703001', difficulty: 3, objectGroupId: 'GROUP_1', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 111, puzzleId: '8000703002', difficulty: 3, objectGroupId: 'GROUP_1', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 112, puzzleId: '8000703003', difficulty: 3, objectGroupId: 'GROUP_1', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 113, puzzleId: '8000703004', difficulty: 3, objectGroupId: 'GROUP_2', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 114, puzzleId: '8000703005', difficulty: 3, objectGroupId: 'GROUP_2', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 115, puzzleId: '8000703006', difficulty: 3, objectGroupId: 'GROUP_2', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 116, puzzleId: '8000703007', difficulty: 3, objectGroupId: 'GROUP_3', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 117, puzzleId: '8000703008', difficulty: 3, objectGroupId: 'GROUP_3', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 118, puzzleId: '8000703009', difficulty: 3, objectGroupId: 'GROUP_4', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 119, puzzleId: '8000703010', difficulty: 3, objectGroupId: 'GROUP_4', tileArrayX: 3, tileArrayY: 5, bombTile: 1, objectTile: 14 },
	{ index: 120, puzzleId: '8000705001', difficulty: 5, objectGroupId: 'GROUP_1', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 121, puzzleId: '8000705002', difficulty: 5, objectGroupId: 'GROUP_2', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 122, puzzleId: '8000705003', difficulty: 5, objectGroupId: 'GROUP_2', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 123, puzzleId: '8000705004', difficulty: 5, objectGroupId: 'GROUP_3', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 124, puzzleId: '8000705005', difficulty: 5, objectGroupId: 'GROUP_3', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 125, puzzleId: '8000705006', difficulty: 5, objectGroupId: 'GROUP_3', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 126, puzzleId: '8000705007', difficulty: 5, objectGroupId: 'GROUP_3', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 127, puzzleId: '8000705008', difficulty: 5, objectGroupId: 'GROUP_4', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 128, puzzleId: '8000705009', difficulty: 5, objectGroupId: 'GROUP_4', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 129, puzzleId: '8000705010', difficulty: 5, objectGroupId: 'GROUP_4', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
];
