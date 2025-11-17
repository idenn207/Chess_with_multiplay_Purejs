// 멀티게임 클라이언트
class MultiGameClient {
  constructor() {
    this.selectedGame = null;
    this.chessGame = null;
    this.gomokuGame = null;
    this.connected = false;
    this.channelName = null;
    this.messageCheck = null;

    this.chessBoardElement = document.getElementById('chessBoard');
    this.gomokuBoardElement = document.getElementById('gomokuBoard');
    this.statusElement = document.getElementById('status');
    this.pendingPromotion = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connectToServer();
    });

    document.getElementById('resignBtn').addEventListener('click', () => {
      if (confirm('정말 기권하시겠습니까?')) {
        this.sendMessage({ type: 'resign' });
        let winner;
        if (this.selectedGame === 'chess') {
          winner = 'white';
        } else {
          winner = this.gomokuGame.myColor === 'black' ? 'white' : 'black';
        }
        this.handleGameOver(winner, 'resignation');
      }
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
      this.cleanup();
      location.reload();
    });
  }

  connectToServer() {
    const serverIP = document.getElementById('serverIP').value.trim();
    if (!serverIP) {
      alert('서버 IP 주소를 입력하세요');
      return;
    }

    this.channelName = localStorage.getItem('multigame_server_channel');

    if (!this.channelName) {
      alert('같은 브라우저에서 서버를 먼저 시작해주세요 (테스트 모드)');
      return;
    }

    // 서버가 선택한 게임 확인
    this.selectedGame = localStorage.getItem(this.channelName + '_game');

    if (!this.selectedGame) {
      alert('서버에서 게임을 선택하지 않았습니다');
      return;
    }

    // 게임 초기화
    if (this.selectedGame === 'chess') {
      this.chessGame = new ChessGame();
      this.chessGame.myColor = 'black';
      this.initializeChessBoard();
      document.getElementById('myColor').textContent = '흑 (후공)';
      document.getElementById('gameName').textContent = '체스';
      this.chessBoardElement.style.display = 'grid';
      this.gomokuBoardElement.style.display = 'none';
    } else if (this.selectedGame === 'gomoku') {
      this.gomokuGame = new GomokuGame();
      this.gomokuGame.myColor = 'white';
      this.initializeGomokuBoard();
      document.getElementById('myColor').textContent = '백 (후공)';
      document.getElementById('gameName').textContent = '오목';
      this.chessBoardElement.style.display = 'none';
      this.gomokuBoardElement.style.display = 'grid';
    }

    // 클라이언트 연결 알림
    localStorage.setItem(this.channelName + '_client', 'connected');
    this.connected = true;

    document.getElementById('connection-section').style.display = 'none';
    document.getElementById('game-section').classList.add('active');
    document.getElementById('resignBtn').disabled = false;

    this.updateStatus('상대방 차례입니다', '');
    this.updateCurrentTurn();
    this.startMessageListener();
  }

  startMessageListener() {
    this.messageCheck = setInterval(() => {
      const message = localStorage.getItem(this.channelName + '_server_msg');
      if (message) {
        localStorage.removeItem(this.channelName + '_server_msg');
        const data = JSON.parse(message);
        this.handleMessage(data);
      }
    }, 100);
  }

  sendMessage(message) {
    if (this.connected) {
      localStorage.setItem(this.channelName + '_client_msg', JSON.stringify(message));
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
        this.handleGameOver('black', 'resignation');
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

  cleanup() {
    if (this.messageCheck) clearInterval(this.messageCheck);
    if (this.channelName) {
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

    if (!this.connected) {
      this.updateStatus('먼저 서버에 연결하세요', 'error');
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

    const pieces = ['q', 'r', 'b', 'n'];

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

    if (!this.connected) {
      this.updateStatus('먼저 서버에 연결하세요', 'error');
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
      if (reason === 'board_full') message += ' (판이 가득 찼습니다)';
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

// 클라이언트 초기화
const multiGameClient = new MultiGameClient();
