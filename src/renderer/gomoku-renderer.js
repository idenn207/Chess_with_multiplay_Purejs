// 오목 렌더러
class GomokuRenderer {
  constructor(game, container, onMove) {
    this.game = game;
    this.container = container;
    this.onMove = onMove;
    this.boardElement = null;
    this.isAnimating = false;
    this.animationDuration = 300; // 돌 놓기 애니메이션 시간 (ms)
    this.onMoveStart = null; // 이동 시작 콜백 (타임아웃 race condition 방지용)
  }

  initialize() {
    this.boardElement = document.createElement('div');
    this.boardElement.className = 'gomoku-board';

    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        const cell = document.createElement('div');
        cell.className = 'gomoku-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        cell.addEventListener('click', () => this.handleCellClick(row, col));

        this.boardElement.appendChild(cell);
      }
    }

    this.container.innerHTML = '';
    this.container.appendChild(this.boardElement);
    this.render();
  }

  render() {
    const cells = this.boardElement.querySelectorAll('.gomoku-cell');

    cells.forEach((cell) => {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const stone = this.game.board[row][col];

      cell.innerHTML = '';
      cell.classList.remove('has-stone', 'last-move', 'forbidden');

      if (stone) {
        const stoneDiv = document.createElement('div');
        stoneDiv.className = `gomoku-stone ${stone}`;

        if (this.game.winningLine.some((pos) => pos.row === row && pos.col === col)) {
          stoneDiv.classList.add('winning');
        }

        cell.appendChild(stoneDiv);
        cell.classList.add('has-stone');
      } else if (!this.game.gameOver && this.game.currentTurn === 'black' && this.game.myColor === 'black') {
        // 흑의 턴이고, 내가 흑인 경우 금지 위치 표시
        if (this.isForbiddenPosition(row, col)) {
          const forbiddenMark = document.createElement('div');
          forbiddenMark.className = 'forbidden-mark';
          forbiddenMark.textContent = '✕';
          cell.appendChild(forbiddenMark);
          cell.classList.add('forbidden');
        }
      }

      if (this.game.lastMove && this.game.lastMove.row === row && this.game.lastMove.col === col) {
        cell.classList.add('last-move');
      }
    });
  }

  /**
   * 금지 위치 확인 (삼삼 또는 장육)
   */
  isForbiddenPosition(row, col) {
    if (this.game.board[row][col] !== null) return false;

    // 삼삼 체크
    if (this.game.isDoubleThree(row, col, 'black')) {
      return true;
    }

    // 장육 체크
    if (this.game.isOverline(row, col, 'black')) {
      return true;
    }

    return false;
  }

  handleCellClick(row, col) {
    // 애니메이션 중이면 클릭 무시
    if (this.isAnimating) return;

    if (this.game.currentTurn !== this.game.myColor || this.game.gameOver) {
      return;
    }

    if (!this.game.isValidMove(row, col)) {
      return;
    }

    // 애니메이션과 함께 돌 놓기
    this.animatePlaceStone(row, col);
  }

  /**
   * 돌 놓기 애니메이션
   * @param {number} row - 행
   * @param {number} col - 열
   */
  animatePlaceStone(row, col) {
    this.isAnimating = true;

    // 이동 시작 알림 (타이머 정지용)
    if (this.onMoveStart) {
      this.onMoveStart();
    }

    const cell = this.getCellElement(row, col);
    const color = this.game.myColor;

    // 돌 생성 (애니메이션용)
    const stoneDiv = document.createElement('div');
    stoneDiv.className = `gomoku-stone ${color} placing`;
    cell.appendChild(stoneDiv);
    cell.classList.add('has-stone');

    // 애니메이션 완료 후 실제 이동 처리
    setTimeout(() => {
      stoneDiv.classList.remove('placing');
      stoneDiv.classList.add('placed');

      this.executeMove(row, col);
      this.isAnimating = false;
    }, this.animationDuration);
  }

  getCellElement(row, col) {
    return this.boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  executeMove(row, col) {
    const color = this.game.myColor;
    this.game.placeStone(row, col, color);

    let gameOver = false;
    let winner = null;
    let reason = null;

    if (this.game.checkWin(row, col, color)) {
      gameOver = true;
      winner = color;
      reason = 'five_in_a_row';
      this.game.gameOver = true;
    } else if (this.game.isBoardFull()) {
      gameOver = true;
      winner = 'draw';
      reason = 'board_full';
      this.game.gameOver = true;
    }

    this.game.currentTurn = color === 'black' ? 'white' : 'black';

    const moveData = {
      board: this.game.board,
      currentTurn: this.game.currentTurn,
      gameOver,
      winner,
      reason,
      winningLine: this.game.winningLine,
      lastMove: this.game.lastMove,
    };

    this.onMove(moveData);
    this.render();
  }

  /**
   * 상대방 이동 반영 (애니메이션 포함)
   */
  updateFromMove(moveData) {
    // 마지막 이동 정보가 있으면 애니메이션 실행
    if (moveData.lastMove) {
      const { row, col } = moveData.lastMove;

      // 현재 보드에 돌이 없으면 상대방이 놓은 것
      if (!this.game.board[row][col]) {
        this.animateOpponentStone(row, col, moveData);
        return;
      }
    }

    this.game.applyMove(moveData);
    this.render();
  }

  /**
   * 상대방 돌 놓기 애니메이션
   */
  animateOpponentStone(row, col, moveData) {
    this.isAnimating = true;

    const cell = this.getCellElement(row, col);
    const opponentColor = this.game.myColor === 'black' ? 'white' : 'black';

    // 돌 생성 (애니메이션용)
    const stoneDiv = document.createElement('div');
    stoneDiv.className = `gomoku-stone ${opponentColor} placing`;
    cell.appendChild(stoneDiv);
    cell.classList.add('has-stone');

    // 애니메이션 완료 후 처리
    setTimeout(() => {
      stoneDiv.classList.remove('placing');
      stoneDiv.classList.add('placed');

      this.game.applyMove(moveData);
      this.render();
      this.isAnimating = false;
    }, this.animationDuration);
  }

  cleanup() {
    if (this.boardElement) {
      this.boardElement.remove();
    }
  }
}
