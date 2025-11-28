import gameRegistry from './game-registry.js';

// 메인 앱
class MultiGameApp {
  constructor() {
    this.role = null; // 'server' or 'client'
    this.gameId = null;
    this.game = null;
    this.renderer = null;
    this.connected = false;
    this.channelName = null;
    this.checkForClient = null;
    this.messageCheck = null;

    this.elements = {
      roleSelection: document.getElementById('roleSelection'),
      gameSelection: document.getElementById('gameSelection'),
      connectionPanel: document.getElementById('connectionPanel'),
      serverInfo: document.getElementById('serverInfo'),
      gameArea: document.getElementById('gameArea'),
      boardContainer: document.getElementById('boardContainer'),
      status: document.getElementById('status'),
      pageTitle: document.getElementById('pageTitle'),
    };

    this.init();
  }

  init() {
    this.showRoleSelection();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 역할 선택
    document.querySelectorAll('.role-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectRole(btn.dataset.role);
      });
    });

    // 서버 연결
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connectToServer();
    });

    // 게임 컨트롤
    document.getElementById('resignBtn').addEventListener('click', () => {
      this.resign();
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
      this.newGame();
    });
  }

  showRoleSelection() {
    this.elements.roleSelection.classList.add('active');
    this.elements.gameSelection.classList.remove('active');
    this.elements.connectionPanel.classList.remove('active');
    this.elements.serverInfo.classList.remove('active');
    this.elements.gameArea.classList.remove('active');
  }

  selectRole(role) {
    this.role = role;
    this.elements.roleSelection.classList.remove('active');

    if (role === 'server') {
      this.setupServer();
    } else {
      this.setupClient();
    }
  }

  setupServer() {
    this.elements.pageTitle.textContent = '🎮 LAN Multi Game (Host)';
    this.renderGameSelection();
    this.elements.gameSelection.classList.add('active');
  }

  renderGameSelection() {
    const container = document.getElementById('gameButtons');
    container.innerHTML = '';

    gameRegistry.getAll().forEach((config) => {
      const btn = document.createElement('button');
      btn.className = 'game-btn';
      btn.dataset.gameId = config.id;
      btn.innerHTML = `
                <span class="icon">${config.icon}</span>
                <span>${config.name}</span>
            `;
      btn.addEventListener('click', () => this.selectGame(config.id));
      container.appendChild(btn);
    });
  }

  selectGame(gameId) {
    this.gameId = gameId;
    const config = gameRegistry.get(gameId);

    // 버튼 활성화
    document.querySelectorAll('.game-btn').forEach((btn) => {
      btn.classList.remove('selected');
    });
    document.querySelector(`[data-game-id="${gameId}"]`).classList.add('selected');

    // 게임 초기화
    this.game = gameRegistry.createGame(gameId, 'server');
    this.renderer = gameRegistry.createRenderer(gameId, this.game, this.elements.boardContainer, (moveData) => this.handleLocalMove(moveData));
    this.renderer.initialize();

    // UI 업데이트
    document.getElementById('selectedGameName').textContent = config.name;
    document.getElementById('currentGameName').textContent = config.name;
    document.getElementById('myColor').textContent = config.serverLabel;

    this.elements.gameSelection.classList.remove('active');
    this.elements.serverInfo.classList.add('active');
    this.elements.gameArea.classList.add('active');

    this.updateStatus('상대방이 연결될 때까지 기다려주세요...', '');
    this.startServer();
  }

  startServer() {
    this.channelName = 'multigame_' + Date.now();
    localStorage.setItem('multigame_server_channel', this.channelName);
    localStorage.setItem(this.channelName + '_game', this.gameId);
    localStorage.setItem(this.channelName + '_status', 'waiting');

    console.log('서버 시작. 채널:', this.channelName, '게임:', this.gameId);

    const statusIndicator = document.getElementById('statusIndicator');
    const serverStatus = document.getElementById('serverStatus');
    statusIndicator.classList.add('waiting');

    this.checkForClient = setInterval(() => {
      const clientConnected = localStorage.getItem(this.channelName + '_client');
      if (clientConnected && !this.connected) {
        this.connected = true;
        clearInterval(this.checkForClient);

        serverStatus.textContent = '상대방 연결됨!';
        statusIndicator.classList.remove('waiting');
        statusIndicator.classList.add('ready');

        const config = gameRegistry.get(this.gameId);
        this.updateStatus(`게임 시작! 내 차례입니다 (${config.serverLabel})`, 'turn');
        document.getElementById('resignBtn').disabled = false;
        this.updateCurrentTurn();
        this.startMessageListener();
      }
    }, 500);
  }

  setupClient() {
    this.elements.pageTitle.textContent = '🎮 LAN Multi Game (Client)';
    this.elements.connectionPanel.classList.add('active');
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

    this.gameId = localStorage.getItem(this.channelName + '_game');

    if (!this.gameId) {
      alert('서버에서 게임을 선택하지 않았습니다');
      return;
    }

    const config = gameRegistry.get(this.gameId);

    // 게임 초기화
    this.game = gameRegistry.createGame(this.gameId, 'client');
    this.renderer = gameRegistry.createRenderer(this.gameId, this.game, this.elements.boardContainer, (moveData) => this.handleLocalMove(moveData));
    this.renderer.initialize();

    // 클라이언트 연결 알림
    localStorage.setItem(this.channelName + '_client', 'connected');
    this.connected = true;

    // UI 업데이트
    document.getElementById('currentGameName').textContent = config.name;
    document.getElementById('myColor').textContent = config.clientLabel;

    this.elements.connectionPanel.classList.remove('active');
    this.elements.gameArea.classList.add('active');
    document.getElementById('resignBtn').disabled = false;

    this.updateStatus('상대방 차례입니다', '');
    this.updateCurrentTurn();
    this.startMessageListener();
  }

  startMessageListener() {
    const msgKey = this.role === 'server' ? '_client_msg' : '_server_msg';

    this.messageCheck = setInterval(() => {
      const message = localStorage.getItem(this.channelName + msgKey);
      if (message) {
        localStorage.removeItem(this.channelName + msgKey);
        const data = JSON.parse(message);
        this.handleMessage(data);
      }
    }, 100);
  }

  sendMessage(message) {
    if (this.connected) {
      const msgKey = this.role === 'server' ? '_server_msg' : '_client_msg';
      localStorage.setItem(this.channelName + msgKey, JSON.stringify(message));
    }
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'move':
        this.renderer.updateFromMove(data);
        this.updateCurrentTurn();

        if (data.gameOver) {
          this.handleGameOver(data.winner, data.reason);
        } else {
          this.updateStatus('내 차례입니다', 'turn');
        }
        break;

      case 'resign':
        const winner = this.game.myColor;
        this.handleGameOver(winner, 'resignation');
        break;
    }
  }

  handleLocalMove(moveData) {
    this.sendMessage({ type: 'move', data: moveData });
    this.updateCurrentTurn();

    if (moveData.gameOver) {
      this.handleGameOver(moveData.winner, moveData.reason);
    } else {
      this.updateStatus('상대방 차례입니다', '');
    }
  }

  resign() {
    if (!confirm('정말 기권하시겠습니까?')) return;

    this.sendMessage({ type: 'resign' });

    const config = gameRegistry.get(this.gameId);
    const opponentColor = this.game.myColor === config.serverColor ? config.clientColor : config.serverColor;

    this.handleGameOver(opponentColor, 'resignation');
  }

  handleGameOver(winner, reason) {
    this.game.gameOver = true;
    document.getElementById('resignBtn').disabled = true;

    let message = '';

    if (winner === 'draw') {
      message = '무승부';
      if (reason === 'stalemate') message += ' (스테일메이트)';
      if (reason === 'board_full') message += ' (판이 가득 참)';
    } else if (winner === this.game.myColor) {
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
    this.elements.status.textContent = message;
    this.elements.status.className = type;
  }

  updateCurrentTurn() {
    const config = gameRegistry.get(this.gameId);
    const turnText = config.getTurnLabel(this.game.currentTurn);
    document.getElementById('currentTurn').textContent = turnText;
  }

  newGame() {
    this.cleanup();
    location.reload();
  }

  cleanup() {
    if (this.messageCheck) clearInterval(this.messageCheck);
    if (this.checkForClient) clearInterval(this.checkForClient);
    if (this.renderer) this.renderer.cleanup();

    if (this.channelName) {
      if (this.role === 'server') {
        localStorage.removeItem('multigame_server_channel');
        localStorage.removeItem(this.channelName + '_game');
        localStorage.removeItem(this.channelName + '_status');
      }
      localStorage.removeItem(this.channelName + '_client');
      localStorage.removeItem(this.channelName + '_server_msg');
      localStorage.removeItem(this.channelName + '_client_msg');
    }
  }
}

// 앱 초기화
const app = new MultiGameApp();
