// 멀티게임 서버
class MultiGameServer {
  constructor() {
    this.selectedGame = null;
    this.chessGame = null;
    this.gomokuGame = null;
    this.client = null;
    this.channelName = null;
    this.checkForClient = null;
    this.messageCheck = null;

    this.chessBoardElement = document.getElementById('chessBoard');
    this.gomokuBoardElement = document.getElementById('gomokuBoard');
    this.statusElement = document.getElementById('status');
    this.pendingPromotion = null;

    this.setupGameSelection();
    this.setupEventListeners();
  }

  setupGameSelection() {
    const gameButtons = document.querySelectorAll('.game-btn');

    gameButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gameType = btn.dataset.game;
        this.selectGame(gameType);
      });
    });
  }

  selectGame(gameType) {
    this.selectedGame = gameType;

    // 버튼 활성화 표시
    document.querySelectorAll('.game-btn').forEach((btn) => {
      btn.classList.remove('selected');
    });
    document.querySelector(`[data-game="${gameType}"]`).classList.add('selected');

    // 게임 초기화
    if (gameType === 'chess') {
      this.chessGame = new ChessGame();
      this.chessGame.myColor = 'white';
      this.initializeChessBoard();
      document.getElementById('myColor').textContent = '백 (선공)';
      this.chessBoardElement.style.display = 'grid';
      this.gomokuBoardElement.style.display = 'none';
    } else if (gameType === 'gomoku') {
      this.gomokuGame = new GomokuGame();
      this.gomokuGame.myColor = 'black';
      this.initializeGomokuBoard();
      document.getElementById('myColor').textContent = '흑 (선공)';
      this.chessBoardElement.style.display = 'none';
      this.gomokuBoardElement.style.display = 'grid';
    }

    // UI 업데이트
    document.getElementById('selectedGame').textContent = gameType === 'chess' ? '체스' : '오목';
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('serverInfo').classList.add('active');
    document.getElementById('gameArea').classList.add('active');

    this.updateStatus('상대방이 연결될 때까지 기다려주세요...', '');
    this.startServer();
  }

  startServer() {
    this.channelName = 'multigame_' + Date.now();
    localStorage.setItem('multigame_server_channel', this.channelName);
    localStorage.setItem(this.channelName + '_game', this.selectedGame);
    localStorage.setItem(this.channelName + '_status', 'waiting');

    console.log('서버 시작됨. 채널:', this.channelName, '게임:', this.selectedGame);

    const serverStatus = document.getElementById('serverStatus');
    const statusIndicator = document.querySelector('.status-indicator');

    this.checkForClient = setInterval(() => {
      const clientConnected = localStorage.getItem(this.channelName + '_client');
      if (clientConnected && !this.client) {
        this.client = true;
        clearInterval(this.checkForClient);

        serverStatus.textContent = '상대방 연결됨!';
        statusIndicator.classList.remove('status-waiting');
        statusIndicator.classList.add('status-ready');

        if (this.selectedGame === 'chess') {
          this.updateStatus('게임 시작! 내 차례입니다 (백)', 'turn');
        } else {
          this.updateStatus('게임 시작! 내 차례입니다 (흑)', 'turn');
        }

        document.getElementById('resignBtn').disabled = false;
        this.updateCurrentTurn();
        this.startMessageListener();
      }
    }, 500);
  }

  startMessageListener() {
    this.messageCheck = setInterval(() => {
      const message = localStorage.getItem(this.channelName + '_client_msg');
      if (message) {
        localStorage.removeItem(this.channelName + '_client_msg');
        const data = JSON.parse(message);
        this.handleMessage(data);
      }
    }, 100);
  }

  sendMessage(message) {
    if (this.client) {
      localStorage.setItem(this.channelName + '_server_msg', JSON.stringify(message));
    }
  }

  handleMessage(message) {
    const { type, data } = message;

    if (this.selectedGame === 'chess') {
      this.handleChessMessage(type, data);
    } else if (this.selectedGame === 'gomoku') {
      this.handleGomokuMessage(type, data);
    }
  }

  handleChessMessage(type, data) {
    switch (type) {
      case 'move':
        this.chessGame.applyMove(data);
        this.renderChessBoard();
        this.updateCurrentTurn();

        if (data.gameOver) {
          this.handleGameOver(data.winner, data.reason);
        } else {
          this.updateStatus('내 차례입니다', 'turn');
        }
        break;

      case 'resign':
        this.handleGameOver('white', 'resignation');
        break;
    }
  }

  handleGomokuMessage(type, data) {
    switch (type) {
      case 'move':
        this.gomokuGame.applyMove(data);
        this.renderGomokuBoard();
        this.updateCurrentTurn();

        if (data.gameOver) {
          this.handleGameOver(data.winner, data.reason);
        } else {
          this.updateStatus('내 차례입니다', 'turn');
        }
        break;

      case 'resign':
        this.handleGameOver(this.gomokuGame.myColor, 'resignation');
        break;
    }
  }

  setupEventListeners() {
    document.getElementById('resignBtn').addEventListener('click', () => {
      if (confirm('정말 기권하시겠습니까?')) {
        this.sendMessage({ type: 'resign' });
        const winner = this.selectedGame === 'chess' ? 'black' : 'white';
        this.handleGameOver(winner, 'resignation');
      }
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
      this.cleanup();
      location.reload();
    });
  }

  cleanup() {
    if (this.messageCheck) clearInterval(this.messageCheck);
    if (this.checkForClient) clearInterval(this.checkForClient);
    if (this.channelName) {
      localStorage.removeItem('multigame_server_channel');
      localStorage.removeItem(this.channelName + '_game');
      localStorage.removeItem(this.channelName + '_status');
      localStorage.removeItem(this.channelName + '_client');
      localStorage.removeItem(this.channelName + '_server_msg');
      localStorage.removeItem(this.channelName + '_client_msg');
    }
  }

  // 체스 보드 초기화 및 렌더링
  initializeChessBoard() {
    this.chessBoardElement.innerHTML = '';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = document.createElement('div');
        square.className = 'chess-square';
        square.className += (row + col) % 2 === 0 ? ' light' : ' dark';
        square.dataset.row = row;
        square.dataset.col = col;

        square.addEventListener('click', () => this.handleChessSquareClick(row, col));

        this.chessBoardElement.appendChild(square);
      }
    }

    this.renderChessBoard();
  }

  renderChessBoard() {
    const squares = this.chessBoardElement.querySelectorAll('.chess-square');

    squares.forEach((square) => {
      const row = parseInt(square.dataset.row);
      const col = parseInt(square.dataset.col);
      const piece = this.chessGame.board[row][col];

      square.innerHTML = piece ? `<span class="piece">${PIECES[piece]}</span>` : '';
      square.classList.remove('selected', 'valid-move', 'valid-capture', 'in-check');
    });

    if (!this.chessGame.gameOver) {
      const currentColor = this.chessGame.currentTurn;
      if (this.chessGame.isInCheck(currentColor)) {
        const kingPos = this.chessGame.kingPositions[currentColor];
        const kingSquare = this.getChessSquareElement(kingPos[0], kingPos[1]);
        kingSquare.classList.add('in-check');
      }
    }

    if (this.chessGame.selectedSquare) {
      const [row, col] = this.chessGame.selectedSquare;
      const square = this.getChessSquareElement(row, col);
      square.classList.add('selected');

      this.chessGame.validMoves.forEach(([moveRow, moveCol]) => {
        const moveSquare = this.getChessSquareElement(moveRow, moveCol);
        if (this.chessGame.board[moveRow][moveCol]) {
          moveSquare.classList.add('valid-capture');
        } else {
          moveSquare.classList.add('valid-move');
        }
      });
    }
  }

  getChessSquareElement(row, col) {
    return this.chessBoardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  handleChessSquareClick(row, col) {
    if (this.chessGame.gameOver) return;

    if (!this.client) {
      this.updateStatus('상대방이 연결될 때까지 기다려주세요...', '');
      return;
    }

    if (this.chessGame.currentTurn !== this.chessGame.myColor) {
      this.updateStatus('상대방 차례입니다', '');
      return;
    }

    const piece = this.chessGame.board[row][col];

    if (!this.chessGame.selectedSquare) {
      if (piece && this.chessGame.getPieceColor(piece) === this.chessGame.myColor) {
        this.chessGame.selectedSquare = [row, col];
        this.chessGame.validMoves = this.chessGame.getPossibleMoves(row, col);
        this.renderChessBoard();
      }
      return;
    }

    const [selectedRow, selectedCol] = this.chessGame.selectedSquare;
    const isValidMove = this.chessGame.validMoves.some(([r, c]) => r === row && c === col);

    if (isValidMove) {
      const movingPiece = this.chessGame.board[selectedRow][selectedCol];

      if (movingPiece.toLowerCase() === 'p' && (row === 0 || row === 7)) {
        this.showPromotionDialog(selectedRow, selectedCol, row, col);
        return;
      }

      this.executeChessMove(selectedRow, selectedCol, row, col);
    } else {
      if (piece && this.chessGame.getPieceColor(piece) === this.chessGame.myColor) {
        this.chessGame.selectedSquare = [row, col];
        this.chessGame.validMoves = this.chessGame.getPossibleMoves(row, col);
        this.renderChessBoard();
      } else {
        this.chessGame.selectedSquare = null;
        this.chessGame.validMoves = [];
        this.renderChessBoard();
      }
    }
  }

  showPromotionDialog(fromRow, fromCol, toRow, toCol) {
    this.pendingPromotion = { fromRow, fromCol, toRow, toCol };

    const modal = document.getElementById('promotion-modal');
    const piecesContainer = document.getElementById('promotionPieces');
    piecesContainer.innerHTML = '';

    const pieces = ['Q', 'R', 'B', 'N'];

    pieces.forEach((piece) => {
      const div = document.createElement('div');
      div.className = 'promotion-piece';
      div.textContent = PIECES[piece];
      div.addEventListener('click', () => {
        this.handlePromotion(piece);
        modal.style.display = 'none';
      });
      piecesContainer.appendChild(div);
    });

    modal.style.display = 'flex';
  }

  handlePromotion(piece) {
    const { fromRow, fromCol, toRow, toCol } = this.pendingPromotion;
    this.executeChessMove(fromRow, fromCol, toRow, toCol, piece);
    this.pendingPromotion = null;
  }

  executeChessMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    this.chessGame.movePiece(fromRow, fromCol, toRow, toCol, promotionPiece);
    this.chessGame.selectedSquare = null;
    this.chessGame.validMoves = [];

    const opponentColor = this.chessGame.currentTurn === 'white' ? 'black' : 'white';
    this.chessGame.currentTurn = opponentColor;

    let gameOver = false;
    let winner = null;
    let reason = null;

    if (this.chessGame.isCheckmate(opponentColor)) {
      gameOver = true;
      winner = this.chessGame.myColor;
      reason = 'checkmate';
    } else if (this.chessGame.isStalemate(opponentColor)) {
      gameOver = true;
      winner = 'draw';
      reason = 'stalemate';
    }

    const moveData = {
      board: this.chessGame.board,
      currentTurn: this.chessGame.currentTurn,
      castlingRights: this.chessGame.castlingRights,
      enPassantTarget: this.chessGame.enPassantTarget,
      kingPositions: this.chessGame.kingPositions,
      gameOver,
      winner,
      reason,
    };

    this.sendMessage({ type: 'move', data: moveData });
    this.renderChessBoard();
    this.updateCurrentTurn();

    if (gameOver) {
      this.handleGameOver(winner, reason);
    } else {
      this.updateStatus('상대방 차례입니다', '');
    }
  }

  // 오목 보드 초기화 및 렌더링
  initializeGomokuBoard() {
    this.gomokuBoardElement.innerHTML = '';

    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        const cell = document.createElement('div');
        cell.className = 'gomoku-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        cell.addEventListener('click', () => this.handleGomokuCellClick(row, col));

        this.gomokuBoardElement.appendChild(cell);
      }
    }

    this.renderGomokuBoard();
  }

  renderGomokuBoard() {
    const cells = this.gomokuBoardElement.querySelectorAll('.gomoku-cell');

    cells.forEach((cell) => {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const stone = this.gomokuGame.board[row][col];

      cell.innerHTML = '';
      cell.classList.remove('has-stone');

      if (stone) {
        const stoneDiv = document.createElement('div');
        stoneDiv.className = `stone ${stone}`;

        // 승리한 돌 표시
        if (this.gomokuGame.winningLine.some((pos) => pos.row === row && pos.col === col)) {
          stoneDiv.classList.add('winning');
        }

        cell.appendChild(stoneDiv);
        cell.classList.add('has-stone');
      }
    });
  }

  handleGomokuCellClick(row, col) {
    if (this.gomokuGame.gameOver) return;

    if (!this.client) {
      this.updateStatus('상대방이 연결될 때까지 기다려주세요...', '');
      return;
    }

    if (this.gomokuGame.currentTurn !== this.gomokuGame.myColor) {
      this.updateStatus('상대방 차례입니다', '');
      return;
    }

    if (!this.gomokuGame.isValidMove(row, col)) {
      return;
    }

    this.executeGomokuMove(row, col);
  }

  executeGomokuMove(row, col) {
    const color = this.gomokuGame.myColor;
    this.gomokuGame.placeStone(row, col, color);

    let gameOver = false;
    let winner = null;
    let reason = null;

    if (this.gomokuGame.checkWin(row, col, color)) {
      gameOver = true;
      winner = color;
      reason = 'five_in_a_row';
      this.gomokuGame.gameOver = true;
    } else if (this.gomokuGame.isBoardFull()) {
      gameOver = true;
      winner = 'draw';
      reason = 'board_full';
      this.gomokuGame.gameOver = true;
    }

    this.gomokuGame.currentTurn = color === 'black' ? 'white' : 'black';

    const moveData = {
      board: this.gomokuGame.board,
      currentTurn: this.gomokuGame.currentTurn,
      gameOver,
      winner,
      reason,
      winningLine: this.gomokuGame.winningLine,
    };

    this.sendMessage({ type: 'move', data: moveData });
    this.renderGomokuBoard();
    this.updateCurrentTurn();

    if (gameOver) {
      this.handleGameOver(winner, reason);
    } else {
      this.updateStatus('상대방 차례입니다', '');
    }
  }

  handleGameOver(winner, reason) {
    if (this.selectedGame === 'chess') {
      this.chessGame.gameOver = true;
    } else {
      this.gomokuGame.gameOver = true;
    }

    document.getElementById('resignBtn').disabled = true;

    let message = '';
    const myColor = this.selectedGame === 'chess' ? this.chessGame.myColor : this.gomokuGame.myColor;

    if (winner === 'draw') {
      message = '무승부';
      if (reason === 'stalemate') message += ' (스테일메이트)';
      if (reason === 'board_full') message += ' (판이 가득 참)';
    } else if (winner === myColor) {
      message = '승리했습니다! 🎉';
    } else {
      message = '패배했습니다';
    }

    if (reason === 'checkmate') message += ' (체크메이트)';
    if (reason === 'resignation') message += ' (기권)';
    if (reason === 'five_in_a_row') message += ' (오목 완성)';

    this.updateStatus(message, 'gameover');
  }

  updateStatus(message, type = '') {
    this.statusElement.textContent = message;
    this.statusElement.className = type ? `status-${type}` : '';
  }

  updateCurrentTurn() {
    let turnText = '';
    if (this.selectedGame === 'chess') {
      turnText = this.chessGame.currentTurn === 'white' ? '백' : '흑';
    } else {
      turnText = this.gomokuGame.currentTurn === 'black' ? '흑' : '백';
    }
    document.getElementById('currentTurn').textContent = turnText;
  }
}

// 서버 초기화
const multiGameServer = new MultiGameServer();
