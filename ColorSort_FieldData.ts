/**
 * !!! 자동 생성 파일 — 직접 수정하지 말 것 !!!
 *
 * 생성기: Documents/Tools/build_fielddata.py
 * 원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_03_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_03_ObjectData.csv
 *
 * 정렬 퍼즐(PUZ_03) 기획 필드 테이블 60판.
 * 난이도별 판 수: D1 10판, D2 10판, D3 10판, D4 10판, D5 10판, D6 10판
 * 난이도별 블랙(미지) 건전지 총 개수: D1 0개, D2 0개, D3 0개, D4 0개, D5 165개, D6 210개
 *
 * 인코딩: `인덱스|케이스1;케이스2;...;케이스8`
 *   케이스 : '-' 비활성 / '.' 활성 빈 케이스(여분) / 그 외는 **아래에서 위로** 쌓인 건전지 색 문자열
 *   색     : R O Y G B I V P (뒤에 '?' 가 붙으면 블랙(미지) 건전지 - §7)
 *
 * 원본 CSV 는 행 A~D 가 위에서 아래 순서다. 구현 쪽 배열은 아래 -> 위 순서라 뒤집어 넣었다.
 * (A행에 블랙 건전지가 한 번도 오지 않는 것으로 A = 최상단임을 확인했다 - §7 "최상단에 위치할 수 없다")
 */
import {
	CASE_CAPACITY,
	Battery,
	BatteryCase,
	EBatteryColor,
} from 'ColorSort_Definitions';
// 타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다
import type { ColorSortFieldTableEntry } from 'ColorSort_DataTables';

/** 원본 CSV 오브젝트 테이블 한 행 */
export type ColorSortCsvObjectRow = {
	objectId: string,
	/** 01 일반 건전지 / 02 블랙(미지) 건전지 / 00 케이스·덮개 */
	category: string,
	/** 01 R ~ 08 P / 00 색 없음 */
	color: string,
	meshPath: string,
	description: string,
}

/** NPUZ_03_ObjectData.csv 전체 (18행) */
export const COLORSORT_CSV_OBJECT_ROWS: ColorSortCsvObjectRow[] = [
	{ objectId: '4200101001', category: '01', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Black.SM_NPUZ_03_Battery_Black\'', description: '건전지_R' },
	{ objectId: '4200102002', category: '01', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Orange.SM_NPUZ_03_Battery_Orange\'', description: '건전지_O' },
	{ objectId: '4200103003', category: '01', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Yellow.SM_NPUZ_03_Battery_Yellow\'', description: '건전지_Y' },
	{ objectId: '4200104004', category: '01', color: '04', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Green.SM_NPUZ_03_Battery_Green\'', description: '건전지_G' },
	{ objectId: '4200105005', category: '01', color: '05', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Blue.SM_NPUZ_03_Battery_Blue\'', description: '건전지_B' },
	{ objectId: '4200106006', category: '01', color: '06', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Indigo.SM_NPUZ_03_Battery_Indigo\'', description: '건전지_I' },
	{ objectId: '4200107007', category: '01', color: '07', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Violet.SM_NPUZ_03_Battery_Violet\'', description: '건전지_V' },
	{ objectId: '4200108008', category: '01', color: '08', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Pink.SM_NPUZ_03_Battery_Pink\'', description: '건전지_P' },
	{ objectId: '4200201009', category: '02', color: '01', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Black.SM_NPUZ_03_Battery_Black\'', description: '블랙건전지_(R)' },
	{ objectId: '4200202010', category: '02', color: '02', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Orange.SM_NPUZ_03_Battery_Orange\'', description: '블랙건전지_(O)' },
	{ objectId: '4200203011', category: '02', color: '03', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Yellow.SM_NPUZ_03_Battery_Yellow\'', description: '블랙건전지_(Y)' },
	{ objectId: '4200204012', category: '02', color: '04', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Green.SM_NPUZ_03_Battery_Green\'', description: '블랙건전지_(G)' },
	{ objectId: '4200205013', category: '02', color: '05', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Blue.SM_NPUZ_03_Battery_Blue\'', description: '블랙건전지_(B)' },
	{ objectId: '4200206014', category: '02', color: '06', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Indigo.SM_NPUZ_03_Battery_Indigo\'', description: '블랙건전지_(I)' },
	{ objectId: '4200207015', category: '02', color: '07', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Violet.SM_NPUZ_03_Battery_Violet\'', description: '블랙건전지_(V)' },
	{ objectId: '4200208016', category: '02', color: '08', meshPath: '/Script/Engine.StaticMesh\'/Game/Resources/Puzzle/Common/PuzzleSet/NPUZ_03/Meshs/SM_NPUZ_03_Battery_Pink.SM_NPUZ_03_Battery_Pink\'', description: '블랙건전지_(P)' },
	{ objectId: '4200000017', category: '00', color: '00', meshPath: 'FREE', description: '케이스' },
	{ objectId: '4200000018', category: '00', color: '00', meshPath: 'FREE', description: '케이스 덮개(활성화)' },
];

/** NPUZ_03_FieldData.csv 전체 (60행) - 위 인코딩 규칙 참조 */
const RAW_LEVELS: string[] = [
	'8000301001|OOBB;BBOO;.;.;-;-;-;-',
	'8000301002|GGYY;YYGG;.;.;-;-;-;-',
	'8000301003|IIBB;BBII;.;.;-;-;-;-',
	'8000301004|PPGG;GGPP;.;.;-;-;-;-',
	'8000301005|OROR;-;.;-;-;RORO;-;.',
	'8000301006|GYGY;-;.;-;-;YGYG;-;.',
	'8000301007|-;IBIB;-;.;BIBI;-;.;-',
	'8000301008|-;YVYV;-;.;VYVY;-;.;-',
	'8000301009|-;-;-;-;VRVR;RVRV;.;.',
	'8000301010|-;-;-;-;BGBG;GBGB;.;.',
	'8000302001|GOGR;RGRO;OROG;.;.;-;-;-',
	'8000302002|BGBY;YBYG;GYGB;.;.;-;-;-',
	'8000302003|BIBV;VBIV;IVIB;.;.;-;-;-',
	'8000302004|BPBR;RBPR;PRPB;.;.;-;-;-',
	'8000302005|BRYR;RBYB;YBRY;.;.;-;-;-',
	'8000302006|-;-;-;.;GYBY;YGBG;.;BGYB',
	'8000302007|IBIV;-;BIVB;.;-;IVBV;-;.',
	'8000302008|-;GVGR;-;-;VGRV;.;GRVR;.',
	'8000302009|RGBR;-;-;BRGB;GRBG;-;.;.',
	'8000302010|-;YIVY;IYVI;-;.;VYIV;.;-',
	'8000303001|RORO;OROR;.;-;RORO;OROR;.;-',
	'8000303002|VBBV;BVVB;BVVB;VBBV;.;.;-;-',
	'8000303003|GYGY;GGYY;GYGY;GGYY;.;.;-;-',
	'8000303004|BIBI;IIBB;BBII;IBIB;.;.;-;-',
	'8000303005|-;.;GGIG;GIGY;-;.;GYIY;YGIG',
	'8000303006|BBOB;BRBO;.;-;BRRO;RBOB;.;-',
	'8000303007|-;.;YOGR;GORY;-;.;OGYR;GYRO',
	'8000303008|BYBY;IBYG;.;-;BIGY;IGIG;.;-',
	'8000303009|IVPB;VPBI;PBIV;BIVP;.;.;-;-',
	'8000303010|VOVO;PRPR;.;-;OVOV;RPRP;.;-',
	'8000304001|YBIR;IORO;BYBR;YIBO;RYIO;.;.;-',
	'8000304002|.;.;-;GPVP;IGVP;YPVI;YGIV;YIYG',
	'8000304003|.;-;GOBO;VRBG;RBGO;VBRV;ROGV;.',
	'8000304004|-;YPIP;RPYR;GIYI;YRGR;GPIG;.;.',
	'8000304005|PGYP;OYPG;RORG;OYOP;RGRY;.;.;-',
	'8000304006|YOBO;BOBO;GVYV;.;RVBG;RVGY;RGRY;.',
	'8000304007|RBYY;YRBR;BBYR;.;BYRB;YBRY;RBYR;.',
	'8000304008|IOBO;YBBO;GYIO;.;YGIB;VGIV;VGYV;.',
	'8000304009|GVGG;BVVG;BGBV;.;VGBG;GVBV;BVBB;.',
	'8000304010|BRGR;RBGR;GGBG;.;BRBR;BGRG;RGBB;.',
	'8000305001|R?P?G?V;R?V?Y?P;R?Y?G?R;P?V?P?G;Y?G?Y?V;.;.;-',
	'8000305002|B?O?R?O;I?Y?R?O;Y?B?R?I;I?R?O?Y;Y?B?I?B;.;.;-',
	'8000305003|I?B?I?B;G?P?P?V;G?P?V?I;I?V?P?G;B?V?G?B;.;.;-',
	'8000305004|O?G?O?G;Y?Y?P?P;G?O?G?B;P?Y?P?O;B?B?Y?B;.;.;-',
	'8000305005|G?V?O?Y;V?Y?I?O;G?V?Y?I;G?Y?V?I;G?I?O?O;.;.;-',
	'8000305006|P?I?V?G;P?B?G?V;P?V?I?V;G?Y?P?I;B?G?B?Y;I?Y?B?Y;.;-',
	'8000305007|O?R?O?R;B?I?Y?I;I?G?Y?G;Y?B?R?O;G?O?B?R;G?Y?I?B;.;-',
	'8000305008|P?P?I?O;B?G?I?O;V?O?B?G;G?O?I?B;V?V?B?V;P?P?I?G;.;-',
	'8000305009|Y?Y?R?I;G?V?I?V;R?G?P?R;P?P?I?I;V?V?G?G;Y?R?Y?P;.;-',
	'8000305010|P?P?Y?R;I?I?R?G;G?Y?V?I;Y?P?G?V;R?I?R?V;G?P?V?Y;.;-',
	'8000306001|R?Y?R?R;O?G?O?O;B?V?B?B;Y?P?Y?Y;G?R?G?G;V?O?V?V;P?B?P?P;.',
	'8000306002|G?R?B?O;Y?B?R?R;V?B?Y?O;R?Y?O?I;B?I?Y?O;G?G?G?I;V?V?V?I;.',
	'8000306003|Y?P?I?Y;G?O?B?G;P?O?Y?P;O?R?G?O;I?Y?P?R;R?G?B?I;I?R?B?B;.',
	'8000306004|R?B?I?R;B?I?O?O;O?I?B?I;R?O?B?O;B?R?O?B;O?R?B?R;R?B?O?R;.',
	'8000306005|Y?Y?G?Y;Y?Y?V?G;G?G?Y?V;P?P?G?P;B?G?Y?Y;V?V?G?G;P?B?B?B;.',
	'8000306006|G?V?R?R;O?B?G?Y;V?B?G?R;B?B?V?O;V?O?G?G;G?G?Y?Y;R?O?G?Y;.',
	'8000306007|Y?R?G?Y;V?I?G?R;G?V?G?Y;I?G?V?R;G?Y?V?Y;R?Y?G?I;Y?G?Y?I;.',
	'8000306008|B?I?O?B;Y?I?B?O;I?B?I?O;G?Y?O?Y;V?P?Y?G;G?P?V?G;P?V?P?V;.',
	'8000306009|R?B?P?G;O?I?O?R;B?R?I?R;G?O?G?B;V?V?B?O;P?I?V?I;P?G?P?V;.',
	'8000306010|R?O?B?I;I?Y?G?V;V?R?O?B;B?I?Y?G;G?V?R?O;O?B?I?Y;Y?G?V?R;.',
];

/**
 * 기획 CSV 의 색 코드 -> 구현 색상 enum.
 * 기획 데이터는 R O Y G B I(인디고) V(바이올렛) P 8종을 쓰고 구현은 10종을 정의하고 있어,
 * 인디고/바이올렛을 남는 슬롯에 대응시켰다. 실제로 보이는 색은 오브젝트 테이블의 메쉬가 정한다.
 */
const COLOR_BY_LETTER: { [letter: string]: EBatteryColor } = {
	R: EBatteryColor.RED,
	O: EBatteryColor.ORANGE,
	Y: EBatteryColor.YELLOW,
	G: EBatteryColor.GREEN,
	B: EBatteryColor.BLUE,
	I: EBatteryColor.CYAN,
	V: EBatteryColor.PURPLE,
	P: EBatteryColor.PINK,
};

function decodeLevel(raw: string): ColorSortFieldTableEntry {
	const parts = raw.split('|');
	const puzzleId = parts[0];
	// 인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)
	const difficulty = parseInt(puzzleId.substring(5, 7), 10);

	const cases: BatteryCase[] = [];
	const usedColors: EBatteryColor[] = [];
	let activeCaseCount = 0;
	let batteryCount = 0;

	const tokens = parts[1].split(';');
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		const isActive = token !== '-';
		if (isActive) {
			activeCaseCount++;
		}

		const batteries: Battery[] = [];
		if (token !== '-' && token !== '.') {
			for (let position = 0; position < token.length; position++) {
				const letter = token.charAt(position);
				if (letter === '?') {
					continue;
				}
				const color = COLOR_BY_LETTER[letter];
				// 색 뒤에 '?' 가 붙어 있으면 블랙(미지) 건전지다 - §7
				const isRevealed = token.charAt(position + 1) !== '?';
				batteries.push({
					id: `B${index}_${batteries.length}`,
					color: color,
					isRevealed: isRevealed,
				});
				if (usedColors.indexOf(color) < 0) {
					usedColors.push(color);
				}
				batteryCount++;
			}
		}

		cases.push({
			id: `CASE_${index}`,
			index: index,
			capacity: CASE_CAPACITY,
			batteries: batteries,
			isActive: isActive,
		});
	}

	return {
		puzzleId: puzzleId,
		difficulty: difficulty,
		cases: cases,
		activeCaseCount: activeCaseCount,
		colorCount: usedColors.length,
		batteryCount: batteryCount,
	};
}

/** 기획 CSV 에서 뽑은 정렬 퍼즐 필드 테이블 (60판) */
export const COLORSORT_CSV_FIELD_TABLE: ColorSortFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);
