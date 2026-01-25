// 체스 기물 유니코드
const PIECES = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

// 체스 렌더러
class ChessRenderer {
  constructor(game, container, onMove) {
    this.game = game;
    this.container = container;
    this.onMove = onMove;
    this.boardElement = null;
    this.promotionModal = null;
    this.pendingPromotion = null;
    this.isAnimating = false; // 애니메이션 중 여부
    this.animationDuration = 400; // 애니메이션 시간 (ms)
    this.onMoveStart = null; // 이동 시작 콜백 (타임아웃 race condition 방지용)
    this.isRotated = false; // 보드 회전 여부
    this.rotated = '';
  }

  initialize() {
    // 흑 플레이어인 경우 보드 회전
    if (this.game.myColor === 'black') {
      this.rotated = 'rotated';
      this.isRotated = true;
    }

    this.boardElement = document.createElement('div');
    this.boardElement.className = `chess-board ${this.rotated}`;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = document.createElement('div');
        square.className = 'chess-square';
        square.className += (row + col) % 2 === 0 ? ' light' : ' dark';
        square.dataset.row = row;
        square.dataset.col = col;

        square.addEventListener('click', () => this.handleSquareClick(row, col));

        this.boardElement.appendChild(square);
      }
    }

    this.container.innerHTML = '';
    this.container.appendChild(this.boardElement);

    this.createPromotionModal();
    this.render();
  }

  createPromotionModal() {
    this.promotionModal = document.createElement('div');
    this.promotionModal.className = 'chess-promotion-modal';

    const content = document.createElement('div');
    content.className = 'chess-promotion-content';

    const title = document.createElement('h2');
    title.textContent = '폰 승급';

    const description = document.createElement('p');
    description.textContent = '승급할 기물을 선택하세요:';

    const piecesContainer = document.createElement('div');
    piecesContainer.className = 'promotion-pieces';
    piecesContainer.id = 'chess-promotion-pieces';

    content.appendChild(title);
    content.appendChild(description);
    content.appendChild(piecesContainer);

    this.promotionModal.appendChild(content);
    document.body.appendChild(this.promotionModal);

    this.promotionModal.addEventListener('click', (e) => {
      if (e.target === this.promotionModal) {
        e.stopPropagation();
      }
    });
  }

  render() {
    const squares = this.boardElement.querySelectorAll('.chess-square');

    squares.forEach((square) => {
      const row = parseInt(square.dataset.row);
      const col = parseInt(square.dataset.col);
      const piece = this.game.board[row][col];

      square.innerHTML = piece ? `<span class="chess-piece ${this.rotated}">${PIECES[piece]}</span>` : '';
      square.classList.remove('selected', 'valid-move', 'valid-capture', 'in-check', 'last-move');
    });

    if (!this.game.gameOver) {
      const currentColor = this.game.currentTurn;
      if (this.game.isInCheck(currentColor)) {
        const kingPos = this.game.kingPositions[currentColor];
        const kingSquare = this.getSquareElement(kingPos[0], kingPos[1]);
        kingSquare.classList.add('in-check');
      }
    }

    if (this.game.lastMove) {
      const fromSquare = this.getSquareElement(this.game.lastMove.from[0], this.game.lastMove.from[1]);
      const toSquare = this.getSquareElement(this.game.lastMove.to[0], this.game.lastMove.to[1]);
      fromSquare.classList.add('last-move');
      toSquare.classList.add('last-move');
    }

    if (this.game.selectedSquare) {
      const [row, col] = this.game.selectedSquare;
      const square = this.getSquareElement(row, col);
      square.classList.add('selected');

      this.game.validMoves.forEach(([moveRow, moveCol]) => {
        const moveSquare = this.getSquareElement(moveRow, moveCol);
        if (this.game.board[moveRow][moveCol]) {
          moveSquare.classList.add('valid-capture');
        } else {
          moveSquare.classList.add('valid-move');
        }
      });
    }
  }

  getSquareElement(row, col) {
    return this.boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  handleSquareClick(row, col) {
    // 애니메이션 중이면 클릭 무시
    if (this.isAnimating) return;

    // 싱글플레이 모드: AI 턴이면 클릭 무시
    if (this.game.myColor && this.game.currentTurn !== this.game.myColor) {
      return;
    }

    if (this.game.currentTurn !== this.game.myColor || this.game.gameOver) {
      return;
    }

    const piece = this.game.board[row][col];

    if (!this.game.selectedSquare) {
      if (piece && this.game.getPieceColor(piece) === this.game.myColor) {
        this.game.selectedSquare = [row, col];
        this.game.validMoves = this.game.getPossibleMoves(row, col);
        this.render();
      }
      return;
    }

    const [selectedRow, selectedCol] = this.game.selectedSquare;
    const isValidMove = this.game.validMoves.some(([r, c]) => r === row && c === col);

    if (isValidMove) {
      const movingPiece = this.game.board[selectedRow][selectedCol];

      if (movingPiece.toLowerCase() === 'p' && (row === 0 || row === 7)) {
        this.showPromotionDialog(selectedRow, selectedCol, row, col);
        return;
      }

      // 애니메이션과 함께 이동 실행
      this.animateMove(selectedRow, selectedCol, row, col, null);
    } else {
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

  showPromotionDialog(fromRow, fromCol, toRow, toCol) {
    this.pendingPromotion = { fromRow, fromCol, toRow, toCol };

    const piecesContainer = document.getElementById('chess-promotion-pieces');
    piecesContainer.innerHTML = '';

    const pieces = this.game.myColor === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

    pieces.forEach((piece) => {
      const div = document.createElement('div');
      div.className = 'promotion-piece';
      div.textContent = PIECES[piece];
      div.addEventListener('click', () => {
        this.handlePromotion(piece);
        this.promotionModal.classList.remove('active');
      });
      piecesContainer.appendChild(div);
    });

    this.promotionModal.classList.add('active');
  }

  handlePromotion(piece) {
    const { fromRow, fromCol, toRow, toCol } = this.pendingPromotion;
    // 애니메이션과 함께 승급 이동 실행
    this.animateMove(fromRow, fromCol, toRow, toCol, piece);
    this.pendingPromotion = null;
  }

  /**
   * 기물 이동 애니메이션
   * @param {number} fromRow - 시작 행
   * @param {number} fromCol - 시작 열
   * @param {number} toRow - 도착 행
   * @param {number} toCol - 도착 열
   * @param {string|null} promotionPiece - 승급 기물 (선택)
   */
  animateMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    this.isAnimating = true;

    // 이동 시작 알림 (타이머 정지용)
    if (this.onMoveStart) {
      this.onMoveStart();
    }

    const fromSquare = this.getSquareElement(fromRow, fromCol);
    const toSquare = this.getSquareElement(toRow, toCol);
    const piece = this.game.board[fromRow][fromCol];
    const capturedPiece = this.game.board[toRow][toCol];

    // 시작 위치와 끝 위치 계산
    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();

    // 이동할 기물 복제
    const animatingPiece = document.createElement('span');
    animatingPiece.className = 'chess-piece piece-animating';
    animatingPiece.textContent = PIECES[piece];
    animatingPiece.style.left = fromRect.left + 'px';
    animatingPiece.style.top = fromRect.top + 'px';
    animatingPiece.style.width = fromRect.width + 'px';
    animatingPiece.style.height = fromRect.height + 'px';
    animatingPiece.style.fontSize = window.getComputedStyle(fromSquare.querySelector('.chess-piece')).fontSize;
    animatingPiece.style.display = 'flex';
    animatingPiece.style.alignItems = 'center';
    animatingPiece.style.justifyContent = 'center';
    document.body.appendChild(animatingPiece);

    // 원래 위치의 기물 숨기기
    const originalPiece = fromSquare.querySelector('.chess-piece');
    if (originalPiece) {
      originalPiece.style.visibility = 'hidden';
    }

    // 잡히는 기물 애니메이션
    if (capturedPiece) {
      const capturedElement = toSquare.querySelector('.chess-piece');
      if (capturedElement) {
        capturedElement.style.animation = `pieceCaptured ${this.animationDuration * 0.8}ms ease-out forwards`;
      }
    }

    // 이동 거리 계산
    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;

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
      this.executeMove(fromRow, fromCol, toRow, toCol, promotionPiece);

      this.isAnimating = false;
    }, this.animationDuration);
  }

  executeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    this.game.movePiece(fromRow, fromCol, toRow, toCol, promotionPiece);
    this.game.selectedSquare = null;
    this.game.validMoves = [];

    const opponentColor = this.game.currentTurn === 'white' ? 'black' : 'white';
    this.game.currentTurn = opponentColor;

    let gameOver = false;
    let winner = null;
    let reason = null;

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
      castlingRights: this.game.castlingRights,
      enPassantTarget: this.game.enPassantTarget,
      kingPositions: this.game.kingPositions,
      lastMove: this.game.lastMove,
      gameOver,
      winner,
      reason,
    };

    this.onMove(moveData);
    this.render();

    // 착지 애니메이션
    const toSquare = this.getSquareElement(toRow, toCol);
    const landedPiece = toSquare.querySelector('.chess-piece');
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

    const fromSquare = this.getSquareElement(fromRow, fromCol);
    const toSquare = this.getSquareElement(toRow, toCol);

    if (!fromSquare || !toSquare) {
      this.game.applyMove(moveData);
      this.render();
      return;
    }

    const pieceElement = fromSquare.querySelector('.chess-piece');
    if (!pieceElement) {
      this.game.applyMove(moveData);
      this.render();
      return;
    }

    this.isAnimating = true;

    const piece = this.game.board[fromRow][fromCol];
    const capturedPiece = this.game.board[toRow][toCol];

    // 시작/끝 위치 계산
    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();

    // 애니메이션 기물 생성
    const animatingPiece = document.createElement('span');
    animatingPiece.className = 'chess-piece piece-animating';
    animatingPiece.textContent = PIECES[piece];
    animatingPiece.style.left = fromRect.left + 'px';
    animatingPiece.style.top = fromRect.top + 'px';
    animatingPiece.style.width = fromRect.width + 'px';
    animatingPiece.style.height = fromRect.height + 'px';
    animatingPiece.style.fontSize = window.getComputedStyle(pieceElement).fontSize;
    animatingPiece.style.display = 'flex';
    animatingPiece.style.alignItems = 'center';
    animatingPiece.style.justifyContent = 'center';
    document.body.appendChild(animatingPiece);

    // 원래 기물 숨기기
    pieceElement.style.visibility = 'hidden';

    // 잡히는 기물 애니메이션
    if (capturedPiece) {
      const capturedElement = toSquare.querySelector('.chess-piece');
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
      const landedSquare = this.getSquareElement(toRow, toCol);
      const landedPiece = landedSquare.querySelector('.chess-piece');
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
    if (this.promotionModal) {
      this.promotionModal.remove();
    }
  }
}

