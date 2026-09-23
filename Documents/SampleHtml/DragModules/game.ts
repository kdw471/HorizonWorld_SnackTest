// 브라우저 드래그 모듈 데모 (사용자 제공, 2026-09-18). 인월드 코드가 아니다.
// DragLab_Panel 의 R12 / drop mode 는 이 파일의 세 클래스를 Custom UI 로 옮긴 것이다.
// 비교 문서: ../../생성 문서/설계/2026-09-18_브라우저_드래그_데모_대비_CustomUI_파이프라인_비교.md

interface Point {
  x: number;
  y: number;
}

// ----------------------------------------------------
// 1. FreeFormDraggable 로직
// ----------------------------------------------------
class FreeFormDraggable {
  public position: Point;
  private isDragging: boolean = false;
  private dragOffset: Point = { x: 0, y: 0 };

  constructor(initialPosition: Point) {
    this.position = { ...initialPosition };
  }

  public onPointerDown(pointerPos: Point): void {
    this.isDragging = true;
    this.dragOffset = {
      x: pointerPos.x - this.position.x,
      y: pointerPos.y - this.position.y,
    };
  }

  public onPointerMove(pointerPos: Point): Point | null {
    if (!this.isDragging) return null;
    this.position = {
      x: pointerPos.x - this.dragOffset.x,
      y: pointerPos.y - this.dragOffset.y,
    };
    return this.position;
  }

  public onPointerUp(): Point {
    this.isDragging = false;
    return this.position;
  }
}

// ----------------------------------------------------
// 2. GridSnapDraggable 로직
// ----------------------------------------------------
interface GridBoardConfig {
  cellSize: number;
  originX: number;
  originY: number;
  cols: number;
  rows: number;
}

class GridSnapDraggable {
  constructor(private config: GridBoardConfig) {}

  public getGridIndex(worldPos: Point): { col: number; row: number } {
    const col = Math.round((worldPos.x - this.config.originX) / this.config.cellSize);
    const row = Math.round((worldPos.y - this.config.originY) / this.config.cellSize);

    const clampedCol = Math.max(0, Math.min(col, this.config.cols - 1));
    const clampedRow = Math.max(0, Math.min(row, this.config.rows - 1));

    return { col: clampedCol, row: clampedRow };
  }

  public getSnappedWorldPosition(col: number, row: number): Point {
    return {
      x: this.config.originX + col * this.config.cellSize,
      y: this.config.originY + row * this.config.cellSize,
    };
  }

  public dropAt(worldPos: Point): { grid: { col: number; row: number }; snappedPos: Point } {
    const grid = this.getGridIndex(worldPos);
    const snappedPos = this.getSnappedWorldPosition(grid.col, grid.row);
    return { grid, snappedPos };
  }
}

// ----------------------------------------------------
// 3. ZoneDropManager 로직
// ----------------------------------------------------
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DropZone {
  id: string;
  bounds: Rect;
}

class ZoneDropManager {
  private originalPos: Point = { x: 0, y: 0 };

  public startDrag(currentPos: Point): void {
    this.originalPos = { ...currentPos };
  }

  private isInsideZone(point: Point, zoneBounds: Rect): boolean {
    return (
      point.x >= zoneBounds.x &&
      point.x <= zoneBounds.x + zoneBounds.width &&
      point.y >= zoneBounds.y &&
      point.y <= zoneBounds.y + zoneBounds.height
    );
  }

  public handleDrop(dropPos: Point, zones: DropZone[]): { targetZoneId: string | null; finalPos: Point } {
    const matchedZone = zones.find((zone) => this.isInsideZone(dropPos, zone.bounds));

    if (matchedZone) {
      const centerPos: Point = {
        x: matchedZone.bounds.x + matchedZone.bounds.width / 2 - 30, // 30은 오브젝트 절반 크기
        y: matchedZone.bounds.y + matchedZone.bounds.height / 2 - 30,
      };
      return { targetZoneId: matchedZone.id, finalPos: centerPos };
    }

    return { targetZoneId: null, finalPos: this.originalPos };
  }
}

// ====================================================
// 탭별 컨트롤러 바인딩 및 실행
// ====================================================

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------
  // TAB 1: 자유 드래그 적용
  // --------------------------------------------------
  const freeEl = document.getElementById('free-obj') as HTMLElement;
  const freeDraggable = new FreeFormDraggable({ x: 100, y: 150 });

  freeEl.style.left = `${freeDraggable.position.x}px`;
  freeEl.style.top = `${freeDraggable.position.y}px`;

  freeEl.addEventListener('pointerdown', (e) => {
    freeDraggable.onPointerDown({ x: e.clientX, y: e.clientY });
    freeEl.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      const pos = freeDraggable.onPointerMove({ x: me.clientX, y: me.clientY });
      if (pos) {
        freeEl.style.left = `${pos.x}px`;
        freeEl.style.top = `${pos.y}px`;
        (document.getElementById('info1') as HTMLElement).textContent =
          `위치: (${Math.round(pos.x)}, ${Math.round(pos.y)})`;
      }
    };

    const onUp = (ue: PointerEvent) => {
      freeDraggable.onPointerUp();
      freeEl.releasePointerCapture(ue.pointerId);
      freeEl.removeEventListener('pointermove', onMove);
      freeEl.removeEventListener('pointerup', onUp);
    };

    freeEl.addEventListener('pointermove', onMove);
    freeEl.addEventListener('pointerup', onUp);
  });

  // --------------------------------------------------
  // TAB 2: 격자 스냅 적용
  // --------------------------------------------------
  const gridBoardEl = document.getElementById('grid-board') as HTMLElement;
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    gridBoardEl.appendChild(cell);
  }

  const gridConfig: GridBoardConfig = {
    cellSize: 64, // 60px cell + 4px gap
    originX: 24,
    originY: 54,
    cols: 5,
    rows: 5,
  };

  const gridSnap = new GridSnapDraggable(gridConfig);
  const gridEl = document.getElementById('grid-obj') as HTMLElement;
  const gridFree = new FreeFormDraggable({ x: gridConfig.originX, y: gridConfig.originY });

  gridEl.style.left = `${gridFree.position.x}px`;
  gridEl.style.top = `${gridFree.position.y}px`;

  gridEl.addEventListener('pointerdown', (e) => {
    gridFree.onPointerDown({ x: e.clientX, y: e.clientY });
    gridEl.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      const pos = gridFree.onPointerMove({ x: me.clientX, y: me.clientY });
      if (pos) {
        gridEl.style.left = `${pos.x}px`;
        gridEl.style.top = `${pos.y}px`;
      }
    };

    const onUp = (ue: PointerEvent) => {
      const currentPos = gridFree.onPointerUp();
      const dropResult = gridSnap.dropAt(currentPos);

      // 스냅 위치로 고정
      gridFree.position = dropResult.snappedPos;
      gridEl.style.left = `${dropResult.snappedPos.x}px`;
      gridEl.style.top = `${dropResult.snappedPos.y}px`;

      (document.getElementById('info2') as HTMLElement).textContent =
        `스냅된 격자: [열 ${dropResult.grid.col}, 행 ${dropResult.grid.row}]`;

      gridEl.releasePointerCapture(ue.pointerId);
      gridEl.removeEventListener('pointermove', onMove);
      gridEl.removeEventListener('pointerup', onUp);
    };

    gridEl.addEventListener('pointermove', onMove);
    gridEl.addEventListener('pointerup', onUp);
  });

  // --------------------------------------------------
  // TAB 3: 존 드롭 적용
  // --------------------------------------------------
  const zoneEl = document.getElementById('zone-obj') as HTMLElement;
  const zoneFree = new FreeFormDraggable({ x: 150, y: 300 });
  const zoneManager = new ZoneDropManager();

  const zones: DropZone[] = [
    { id: 'Zone A', bounds: { x: 30, y: 60, width: 120, height: 120 } },
    { id: 'Zone B', bounds: { x: window.innerWidth - 150, y: 60, width: 120, height: 120 } },
  ];

  zoneEl.addEventListener('pointerdown', (e) => {
    zoneManager.startDrag(zoneFree.position);
    zoneFree.onPointerDown({ x: e.clientX, y: e.clientY });
    zoneEl.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      const pos = zoneFree.onPointerMove({ x: me.clientX, y: me.clientY });
      if (pos) {
        zoneEl.style.left = `${pos.x}px`;
        zoneEl.style.top = `${pos.y}px`;
      }
    };

    const onUp = (ue: PointerEvent) => {
      const dropPos = zoneFree.onPointerUp();
      // 오브젝트의 중심점 기준으로 drop 판단
      const centerPoint = { x: dropPos.x + 30, y: dropPos.y + 30 };
      const result = zoneManager.handleDrop(centerPoint, zones);

      // 애니메이션 효과와 함께 위치 적용
      zoneEl.style.transition = 'all 0.2s ease-out';
      zoneFree.position = result.finalPos;
      zoneEl.style.left = `${result.finalPos.x}px`;
      zoneEl.style.top = `${result.finalPos.y}px`;

      setTimeout(() => (zoneEl.style.transition = ''), 200);

      const infoText = result.targetZoneId
        ? `성공: ${result.targetZoneId}에 안착함!`
        : `실패: 영역 밖입니다. 원위치로 복귀합니다.`;
      (document.getElementById('info3') as HTMLElement).textContent = infoText;

      zoneEl.releasePointerCapture(ue.pointerId);
      zoneEl.removeEventListener('pointermove', onMove);
      zoneEl.removeEventListener('pointerup', onUp);
    };

    zoneEl.addEventListener('pointermove', onMove);
    zoneEl.addEventListener('pointerup', onUp);
  });
});
