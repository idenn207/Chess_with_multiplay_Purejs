// 오목 렌더러
class GomokuRenderer {
  constructor(game, container, onMove) {
    this.game = game;
    this.container = container;
    this.onMove = onMove;
    this.boardElement = null;
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
      cell.classList.remove('has-stone', 'last-move');

      if (stone) {
        const stoneDiv = document.createElement('div');
        stoneDiv.className = `gomoku-stone ${stone}`;

        if (this.game.winningLine.some((pos) => pos.row === row && pos.col === col)) {
          stoneDiv.classList.add('winning');
        }

        cell.appendChild(stoneDiv);
        cell.classList.add('has-stone');
      }

      if (this.game.lastMove && this.game.lastMove.row === row && this.game.lastMove.col === col) {
        cell.classList.add('last-move');
      }
    });
  }

  handleCellClick(row, col) {
    if (this.game.currentTurn !== this.game.myColor || this.game.gameOver) {
      return;
    }

    if (!this.game.isValidMove(row, col)) {
      return;
    }

    this.executeMove(row, col);
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

  updateFromMove(moveData) {
    this.game.applyMove(moveData);
    this.render();
  }

  cleanup() {
    if (this.boardElement) {
      this.boardElement.remove();
    }
  }
}

