// 장기 기물 한자
const JANGGI_PIECES = {
  // 초(빨강) - 대문자
  K: '楚', // 초나라 궁
  A: '士',
  R: '車',
  C: '包', // 초의 포
  N: '馬',
  E: '象',
  P: '兵',
  // 한(파랑) - 소문자
  k: '漢', // 한나라 궁
  a: '士',
  r: '車',
  c: '砲', // 한의 포
  n: '馬',
  e: '象',
  p: '卒',
};

// 장기 렌더러
class JanggiRenderer {
  constructor(game, container, onMove) {
    this.game = game;
    this.container = container;
    this.onMove = onMove;
    this.boardElement = null;
    this.isAnimating = false;
    this.animationDuration = 400; // 애니메이션 시간 (ms)
  }

  initialize() {
    this.boardElement = document.createElement('div');
    this.boardElement.className = 'janggi-board';

    // 9x10 보드 생성
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = document.createElement('div');
        cell.className = 'janggi-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        // 궁성 표시
        if (this.isInPalace(row, col)) {
          cell.classList.add('palace');
        }

        cell.addEventListener('click', () => this.handleCellClick(row, col));

        this.boardElement.appendChild(cell);
      }
    }

    // 초 궁성 대각선 요소 추가 (CSS에서 스타일링)
    const palaceLines = document.createElement('div');
    palaceLines.className = 'palace-lines';
    this.boardElement.appendChild(palaceLines);

    this.container.innerHTML = '';
    this.container.appendChild(this.boardElement);
    this.render();
  }

  isInPalace(row, col) {
    // 한 궁성 (위쪽)
    if (row >= 0 && row <= 2 && col >= 3 && col <= 5) return true;
    // 초 궁성 (아래쪽)
    if (row >= 7 && row <= 9 && col >= 3 && col <= 5) return true;
    return false;
  }

  render() {
    const cells = this.boardElement.querySelectorAll('.janggi-cell');

    cells.forEach((cell) => {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const piece = this.game.board[row][col];

      // 기존 내용 초기화
      cell.innerHTML = '';
      cell.classList.remove('selected', 'valid-move', 'valid-capture', 'in-check', 'last-move');

      if (piece) {
        const pieceDiv = document.createElement('div');
        const isChoPiece = piece === piece.toUpperCase();
        pieceDiv.className = `janggi-piece ${isChoPiece ? 'cho' : 'han'}`;

        // 궁은 특별 스타일
        if (piece.toLowerCase() === 'k') {
          pieceDiv.classList.add('king');
        }

        pieceDiv.textContent = JANGGI_PIECES[piece];
        cell.appendChild(pieceDiv);
      }

      // 마지막 이동 표시
      if (this.game.lastMove) {
        const { from, to } = this.game.lastMove;
        if ((row === from[0] && col === from[1]) || (row === to[0] && col === to[1])) {
          cell.classList.add('last-move');
        }
      }
    });

    // 체크 상태 표시
    if (!this.game.gameOver) {
      const currentColor = this.game.currentTurn;
      if (this.game.isInCheck(currentColor)) {
        const kingPos = this.game.findKing(currentColor);
        if (kingPos) {
          const kingCell = this.getCellElement(kingPos[0], kingPos[1]);
          kingCell.classList.add('in-check');
        }
      }
    }

    // 선택된 기물 및 이동 가능 위치 표시
    if (this.game.selectedSquare) {
      const [row, col] = this.game.selectedSquare;
      const selectedCell = this.getCellElement(row, col);
      selectedCell.classList.add('selected');

      this.game.validMoves.forEach(([moveRow, moveCol]) => {
        const moveCell = this.getCellElement(moveRow, moveCol);
        if (this.game.board[moveRow][moveCol]) {
          moveCell.classList.add('valid-capture');
        } else {
          moveCell.classList.add('valid-move');
        }
      });
    }
  }

  getCellElement(row, col) {
    return this.boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  handleCellClick(row, col) {
    // 애니메이션 중이면 클릭 무시
    if (this.isAnimating) return;

    // 내 차례가 아니거나 게임 종료 시 무시
    if (this.game.currentTurn !== this.game.myColor || this.game.gameOver) {
      return;
    }

    const piece = this.game.board[row][col];

    // 선택된 기물이 없는 경우
    if (!this.game.selectedSquare) {
      if (piece && this.game.getPieceColor(piece) === this.game.myColor) {
        this.game.selectedSquare = [row, col];
        this.game.validMoves = this.game.getPossibleMoves(row, col);
        this.render();
      }
      return;
    }

    // 선택된 기물이 있는 경우
    const [selectedRow, selectedCol] = this.game.selectedSquare;
    const isValidMove = this.game.validMoves.some(([r, c]) => r === row && c === col);

    if (isValidMove) {
      // 애니메이션과 함께 이동 실행
      this.animateMove(selectedRow, selectedCol, row, col);
    } else {
      // 다른 내 기물 선택 또는 선택 해제
      if (piece && this.game.getPieceColor(piece) === this.game.myColor) {
        this.game.selectedSquare = [row, col];
        this.game.validMoves = this.game.getPossibleMoves(row, col);
        this.render();
      } else {
        this.game.selectedSquare = null;
        this.game.validMoves = [];
        this.render();
      }
    }
  }

  /**
   * 기물 이동 애니메이션
   * @param {number} fromRow - 시작 행
   * @param {number} fromCol - 시작 열
   * @param {number} toRow - 도착 행
   * @param {number} toCol - 도착 열
   */
  animateMove(fromRow, fromCol, toRow, toCol) {
    this.isAnimating = true;

    const fromCell = this.getCellElement(fromRow, fromCol);
    const toCell = this.getCellElement(toRow, toCol);
    const piece = this.game.board[fromRow][fromCol];
    const capturedPiece = this.game.board[toRow][toCol];

    // 시작 위치와 끝 위치 계산
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();

    // 이동할 기물 요소 가져오기
    const pieceElement = fromCell.querySelector('.janggi-piece');
    if (!pieceElement) {
      this.executeMove(fromRow, fromCol, toRow, toCol);
      this.isAnimating = false;
      return;
    }

    // 기물 복제하여 애니메이션
    const animatingPiece = pieceElement.cloneNode(true);
    animatingPiece.classList.add('piece-animating');
    animatingPiece.style.left = fromRect.left + 'px';
    animatingPiece.style.top = fromRect.top + 'px';
    animatingPiece.style.width = fromRect.width + 'px';
    animatingPiece.style.height = fromRect.height + 'px';
    document.body.appendChild(animatingPiece);

    // 원래 위치의 기물 숨기기
    pieceElement.style.visibility = 'hidden';

    // 잡히는 기물 애니메이션
    if (capturedPiece) {
      const capturedElement = toCell.querySelector('.janggi-piece');
      if (capturedElement) {
        capturedElement.style.animation = `pieceCaptured ${this.animationDuration * 0.8}ms ease-out forwards`;
      }
    }

    // 애니메이션 적용
    requestAnimationFrame(() => {
      animatingPiece.style.transition = `all ${this.animationDuration}ms ease-in-out`;
      animatingPiece.style.left = toRect.left + 'px';
      animatingPiece.style.top = toRect.top + 'px';
      animatingPiece.style.animation = `pieceMove ${this.animationDuration}ms ease-in-out`;
    });

    // 애니메이션 완료 후 처리
    setTimeout(() => {
      // 애니메이션 요소 제거
      animatingPiece.remove();

      // 실제 이동 실행
      this.executeMove(fromRow, fromCol, toRow, toCol);

      this.isAnimating = false;
    }, this.animationDuration);
  }

  executeMove(fromRow, fromCol, toRow, toCol) {
    this.game.movePiece(fromRow, fromCol, toRow, toCol);
    this.game.selectedSquare = null;
    this.game.validMoves = [];

    // 턴 변경
    const opponentColor = this.game.currentTurn === 'cho' ? 'han' : 'cho';
    this.game.currentTurn = opponentColor;

    let gameOver = false;
    let winner = null;
    let reason = null;

    // 체크메이트/스테일메이트 확인
    if (this.game.isCheckmate(opponentColor)) {
      gameOver = true;
      winner = this.game.myColor;
      reason = 'checkmate';
    } else if (this.game.isStalemate(opponentColor)) {
      gameOver = true;
      winner = 'draw';
      reason = 'stalemate';
    }

    const moveData = {
      board: this.game.board,
      currentTurn: this.game.currentTurn,
      lastMove: this.game.lastMove,
      gameOver,
      winner,
      reason,
    };

    this.onMove(moveData);
    this.render();

    // 착지 애니메이션
    const toCell = this.getCellElement(toRow, toCol);
    const landedPiece = toCell.querySelector('.janggi-piece');
    if (landedPiece) {
      landedPiece.style.animation = `pieceLand 200ms ease-out`;
      setTimeout(() => {
        landedPiece.style.animation = '';
      }, 200);
    }
  }

  /**
   * 상대방 이동 반영 (애니메이션 포함)
   */
  updateFromMove(moveData) {
    // 마지막 이동 정보가 있으면 애니메이션 실행
    if (moveData.lastMove && this.game.lastMove) {
      const prevLastMove = this.game.lastMove;
      const newLastMove = moveData.lastMove;

      // 이전 lastMove와 다르면 상대방이 이동한 것
      if (
        prevLastMove.from[0] !== newLastMove.from[0] ||
        prevLastMove.from[1] !== newLastMove.from[1] ||
        prevLastMove.to[0] !== newLastMove.to[0] ||
        prevLastMove.to[1] !== newLastMove.to[1]
      ) {
        this.animateOpponentMove(moveData);
        return;
      }
    } else if (moveData.lastMove && !this.game.lastMove) {
      // 첫 번째 이동
      this.animateOpponentMove(moveData);
      return;
    }

    this.game.applyMove(moveData);
    this.render();
  }

  /**
   * 상대방 기물 이동 애니메이션
   */
  animateOpponentMove(moveData) {
    const { from, to } = moveData.lastMove;
    const fromRow = from[0];
    const fromCol = from[1];
    const toRow = to[0];
    const toCol = to[1];

    const fromCell = this.getCellElement(fromRow, fromCol);
    const toCell = this.getCellElement(toRow, toCol);

    if (!fromCell || !toCell) {
      this.game.applyMove(moveData);
      this.render();
      return;
    }

    const pieceElement = fromCell.querySelector('.janggi-piece');
    if (!pieceElement) {
      this.game.applyMove(moveData);
      this.render();
      return;
    }

    this.isAnimating = true;

    const piece = this.game.board[fromRow][fromCol];
    const capturedPiece = this.game.board[toRow][toCol];

    // 시작/끝 위치 계산
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();

    // 애니메이션 기물 생성
    const animatingPiece = pieceElement.cloneNode(true);
    animatingPiece.classList.add('piece-animating');
    animatingPiece.style.left = fromRect.left + 'px';
    animatingPiece.style.top = fromRect.top + 'px';
    animatingPiece.style.width = fromRect.width + 'px';
    animatingPiece.style.height = fromRect.height + 'px';
    document.body.appendChild(animatingPiece);

    // 원래 기물 숨기기
    pieceElement.style.visibility = 'hidden';

    // 잡히는 기물 애니메이션
    if (capturedPiece) {
      const capturedElement = toCell.querySelector('.janggi-piece');
      if (capturedElement) {
        capturedElement.style.animation = `pieceCaptured ${this.animationDuration * 0.8}ms ease-out forwards`;
      }
    }

    // 애니메이션 적용
    requestAnimationFrame(() => {
      animatingPiece.style.transition = `all ${this.animationDuration}ms ease-in-out`;
      animatingPiece.style.left = toRect.left + 'px';
      animatingPiece.style.top = toRect.top + 'px';
      animatingPiece.style.animation = `pieceMove ${this.animationDuration}ms ease-in-out`;
    });

    // 완료 후 처리
    setTimeout(() => {
      animatingPiece.remove();
      this.game.applyMove(moveData);
      this.render();

      // 착지 애니메이션
      const landedCell = this.getCellElement(toRow, toCol);
      const landedPiece = landedCell.querySelector('.janggi-piece');
      if (landedPiece) {
        landedPiece.style.animation = `pieceLand 200ms ease-out`;
        setTimeout(() => {
          landedPiece.style.animation = '';
        }, 200);
      }

      this.isAnimating = false;
    }, this.animationDuration);
  }

  cleanup() {
    if (this.boardElement) {
      this.boardElement.remove();
    }
  }
}
