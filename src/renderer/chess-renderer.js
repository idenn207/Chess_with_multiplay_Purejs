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
  }

  initialize() {
    this.boardElement = document.createElement('div');
    this.boardElement.className = 'chess-board';

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

      square.innerHTML = piece ? `<span class="chess-piece">${PIECES[piece]}</span>` : '';
      square.classList.remove('selected', 'valid-move', 'valid-capture', 'in-check');
    });

    if (!this.game.gameOver) {
      const currentColor = this.game.currentTurn;
      if (this.game.isInCheck(currentColor)) {
        const kingPos = this.game.kingPositions[currentColor];
        const kingSquare = this.getSquareElement(kingPos[0], kingPos[1]);
        kingSquare.classList.add('in-check');
      }
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

      this.executeMove(selectedRow, selectedCol, row, col);
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
    this.executeMove(fromRow, fromCol, toRow, toCol, piece);
    this.pendingPromotion = null;
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
      gameOver,
      winner,
      reason,
    };

    this.onMove(moveData);
    this.render();
  }

  updateFromMove(moveData) {
    this.game.applyMove(moveData);
    this.render();
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

