# Chess_with_multiplay_Purejs# LAN Multi Game - 통합 시스템

## 📁 프로젝트 구조

```
lan-unified/
├── index.html              # 단일 HTML (서버/클라이언트 통합)
├── common.css              # 공통 스타일
├── chess.css               # 체스 전용 스타일
├── gomoku.css              # 오목 전용 스타일
├── games/
│   ├── chess-logic.js      # 체스 게임 로직
│   └── gomoku-logic.js     # 오목 게임 로직
├── renderers/
│   ├── chess-renderer.js   # 체스 렌더러
│   └── gomoku-renderer.js  # 오목 렌더러
├── game-registry.js        # 게임 등록 시스템
└── app.js                  # 메인 앱 로직
```

## 🎮 현재 게임

- **체스**: 완전한 규칙 구현 (캐슬링, 앙파상, 폰 승급, 체크메이트)
- **오목**: 15x15 보드, 5목 승리, 6목 금지

## 🚀 사용 방법

### 1개 PC에서 테스트

1. 브라우저 탭1: `index.html` 열기 → "호스트" 선택 → 게임 선택
2. 브라우저 탭2: `index.html` 열기 → "참가자" 선택 → 연결

### 실제 LAN 환경

- PC1 (호스트): 게임 선택 후 대기
- PC2 (클라이언트): PC1의 IP 입력 후 연결

## ➕ 새 게임 추가하기

### 단계 1: 게임 로직 작성

`games/your-game-logic.js` 파일 생성:

```javascript
class YourGame {
  constructor() {
    this.board = this.getInitialBoard();
    this.currentTurn = 'player1';
    this.myColor = null;
    this.gameOver = false;
  }

  getInitialBoard() {
    // 초기 보드 상태 반환
    return [];
  }

  // 게임별 로직 구현
  isValidMove(/* params */) {}
  makeMove(/* params */) {}
  checkWin(/* params */) {}

  getGameState() {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      gameOver: this.gameOver,
    };
  }

  applyMove(moveData) {
    this.board = moveData.board;
    this.currentTurn = moveData.currentTurn;
    this.gameOver = moveData.gameOver;
  }
}
```

### 단계 2: 렌더러 작성

`renderers/your-game-renderer.js` 파일 생성:

```javascript
class YourGameRenderer {
  constructor(game, container, onMove) {
    this.game = game;
    this.container = container;
    this.onMove = onMove;
    this.boardElement = null;
    // 게임별 UI 요소 (모달, 대화상자 등)
    this.customModal = null;
  }

  initialize() {
    // 보드 DOM 생성
    this.boardElement = document.createElement('div');
    this.boardElement.className = 'your-game-board';

    // 보드 셀/칸 생성 및 이벤트 리스너 추가
    // ...

    this.container.innerHTML = '';
    this.container.appendChild(this.boardElement);

    // 게임별 UI 요소 생성 (필요한 경우)
    this.createCustomModal();

    this.render();
  }

  createCustomModal() {
    // 게임별 모달/다이얼로그 생성
    // 예: 폰 승급, 특수 이동 선택 등
    this.customModal = document.createElement('div');
    this.customModal.className = 'your-game-modal';
    // ...
    document.body.appendChild(this.customModal);
  }

  render() {
    // 보드 상태를 화면에 렌더링
    // ...
  }

  handleCellClick(row, col) {
    // 사용자 입력 처리
    // 유효성 검사 후 executeMove 호출
  }

  showCustomDialog(/* params */) {
    // 게임별 다이얼로그 표시
    // 예: 체스의 폰 승급 선택
    this.customModal.classList.add('active');
  }

  executeMove(/* params */) {
    // 이동 실행
    // 게임 오버 확인
    const moveData = this.game.getGameState();
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
    // 게임별 UI 요소 정리
    if (this.customModal) {
      this.customModal.remove();
    }
  }
}
```

**렌더러의 책임:**

- 보드 DOM 생성 및 관리
- 사용자 입력 처리
- 게임 상태 시각화
- **게임별 UI 요소 관리** (모달, 다이얼로그, 애니메이션 등)
- 리소스 정리

**예시: 체스 폰 승급**

```javascript
// ChessRenderer 내부
createPromotionModal() {
    this.promotionModal = document.createElement('div');
    this.promotionModal.className = 'chess-promotion-modal';
    // 모달 구성...
    document.body.appendChild(this.promotionModal);
}

showPromotionDialog(fromRow, fromCol, toRow, toCol) {
    // 승급 가능한 기물 표시
    this.promotionModal.classList.add('active');
}
```

### 단계 3: CSS 스타일 작성

`your-game.css` 파일 생성:

```css
.your-game-board {
  display: grid;
  grid-template-columns: repeat(/* cols */, /* size */);
  grid-template-rows: repeat(/* rows */, /* size */);
  /* 기타 스타일 */
}

.your-game-cell {
  /* 셀 스타일 */
}
```

### 단계 4: 게임 등록

`game-registry.js`에 게임 추가:

```javascript
gameRegistry.register({
  id: 'your-game', // 고유 ID
  name: '게임 이름', // 표시 이름
  icon: '🎲', // 아이콘
  gameClass: YourGame, // 게임 클래스
  rendererClass: YourGameRenderer, // 렌더러 클래스
  serverColor: 'red', // 서버(호스트) 색상
  clientColor: 'blue', // 클라이언트 색상
  serverLabel: '빨강 (선공)', // 서버 레이블
  clientLabel: '파랑 (후공)', // 클라이언트 레이블
  getTurnLabel: (color) => (color === 'red' ? '빨강' : '파랑'),
});
```

### 단계 5: HTML에 파일 추가

`index.html`의 `<head>`에 CSS 추가:

```html
<link rel="stylesheet" href="your-game.css" />
```

`index.html`의 스크립트 섹션에 JS 추가:

```html
<script src="games/your-game-logic.js"></script>
<script src="renderers/your-game-renderer.js"></script>
```

### 완료!

새로고침하면 게임 선택 화면에 자동으로 추가됩니다.

## 🎯 게임 로직 인터페이스

모든 게임 클래스는 다음 메서드를 구현해야 합니다:

- `constructor()`: 초기화
- `getGameState()`: 현재 상태 반환 (네트워크 전송용)
- `applyMove(moveData)`: 상대방 이동 적용

## 🖼️ 렌더러 인터페이스

모든 렌더러 클래스는 다음 메서드를 구현해야 합니다:

- `constructor(game, container, onMove)`: 초기화
- `initialize()`: 보드 DOM 생성 및 게임별 UI 요소 생성
- `render()`: 화면 업데이트
- `updateFromMove(moveData)`: 상대방 이동 반영
- `cleanup()`: 보드 및 모든 UI 요소 정리

### 게임별 렌더링 기능

각 렌더러는 게임에 필요한 모든 UI 요소를 자체적으로 관리합니다:

**체스 렌더러 예시:**

- 폰 승급 모달 (`chess-promotion-modal`)
- 체크 상태 애니메이션
- 이동 가능 경로 표시

**오목 렌더러 예시:**

- 승리 돌 애니메이션
- 마지막 수 표시 (구현 가능)

**새 게임의 렌더러에서 추가할 수 있는 것들:**

- 특수 이동 선택 다이얼로그
- 게임 규칙 도움말 모달
- 점수판 표시
- 타이머 UI
- 이동 히스토리
- 애니메이션 효과

**중요:** 모든 UI 요소는 렌더러의 `cleanup()` 메서드에서 제거되어야 합니다.

## 📋 체크리스트

새 게임 추가 시:

- [ ] 게임 로직 작성 (`games/`)
- [ ] 렌더러 작성 (`renderers/`)
- [ ] CSS 스타일 작성
- [ ] `game-registry.js`에 등록
- [ ] `index.html`에 파일 추가
- [ ] 테스트 (1개 PC, 2개 탭)

## 🔧 확장 가능한 구조

이 시스템의 장점:

- **모듈화**: 각 게임이 독립적
- **확장성**: 새 게임 추가 쉬움
- **재사용**: 공통 로직(통신, UI) 공유
- **유지보수**: 게임별로 파일 분리

## 💡 예시 게임 아이디어

- **체커 (Checkers)**: 8x8 보드, 대각선 이동
- **커넥트4 (Connect Four)**: 7x6 그리드, 4개 연속
- **틱택토 (Tic-Tac-Toe)**: 3x3 보드
- **리버시 (Reversi/Othello)**: 8x8 보드, 돌 뒤집기
- **바둑 (Go)**: 19x19 보드 (간단한 규칙만)

## 🚨 주의사항

- 게임 ID는 고유해야 함
- 클래스 이름은 전역 스코프에 노출됨
- CSS 클래스명 충돌 방지 (게임별 접두사 사용)
- `getGameState()`와 `applyMove()`는 필수
