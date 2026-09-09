interface BoardConfig {
  size: number; // N x N 격자 크기
  boardElementId: string;
}

class BoardGame {
  private size: number;
  private boardElement: HTMLElement;

  constructor(config: BoardConfig) {
    this.size = config.size;
    const el = document.getElementById(config.boardElementId);
    
    if (!el) {
      throw new Error(`Element with id '${config.boardElementId}' not found.`);
    }
    this.boardElement = el;
    this.initBoard();
  }

  // 보드판 초기화 및 격자 셀 생성
  private initBoard(): void {
    this.boardElement.innerHTML = '';
    // CSS Grid column/row 동적 설정
    this.boardElement.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    this.boardElement.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = row.toString();
        cell.dataset.col = col.toString();
        
        // 셀 클릭 이벤트 예시
        cell.addEventListener('click', () => this.handleCellClick(row, col));
        this.boardElement.appendChild(cell);
      }
    }
  }

  private handleCellClick(row: number, col: number): void {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = `선택된 셀: (${row}, ${col})`;
    }
  }
}

// 8x8 보드판 생성 테스트
document.addEventListener('DOMContentLoaded', () => {
  new BoardGame({
    size: 8,
    boardElementId: 'board'
  });
});