// Signaling UI 관리자
class SignalingUI {
  constructor() {
    this.modal = null;
    this.onOfferCreated = null;
    this.onAnswerSubmit = null;
    this.onOfferSubmit = null;
    this.onAnswerCreated = null;
  }

  // 모달 초기화
  initialize() {
    this.createModal();
  }

  // 모달 DOM 생성
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'signaling-modal';
    this.modal.innerHTML = `
      <div class="signaling-content">
        <h2 id="signalingTitle">연결 설정</h2>
        <p id="signalingDesc">설명</p>
        
        <!-- 단계 표시 -->
        <div class="signaling-steps" id="signalingSteps">
          <div class="step" data-step="1">1</div>
          <div class="step-line"></div>
          <div class="step" data-step="2">2</div>
        </div>

        <!-- Offer/Answer 표시 영역 -->
        <div class="signaling-section" id="sdpDisplaySection">
          <label id="sdpDisplayLabel">연결 코드:</label>
          <textarea id="sdpDisplay" readonly rows="6"></textarea>
          <button class="action-btn primary" id="copySdpBtn">
            📋 복사하기
          </button>
          <div class="copy-status" id="copyStatus"></div>
        </div>

        <!-- Offer/Answer 입력 영역 -->
        <div class="signaling-section" id="sdpInputSection">
          <label id="sdpInputLabel">상대방 코드 입력:</label>
          <textarea id="sdpInput" rows="6" placeholder="상대방의 연결 코드를 붙여넣으세요..."></textarea>
          <button class="action-btn primary" id="submitSdpBtn">
            ✓ 확인
          </button>
        </div>

        <!-- 상태 메시지 -->
        <div class="signaling-status" id="signalingStatus"></div>

        <!-- 닫기 버튼 -->
        <button class="action-btn secondary" id="closeSignalingBtn">
          취소
        </button>
      </div>
    `;

    document.body.appendChild(this.modal);

    // 이벤트 리스너 설정
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 복사 버튼
    document.getElementById('copySdpBtn').addEventListener('click', () => {
      this.copySdp();
    });

    // 확인 버튼
    document.getElementById('submitSdpBtn').addEventListener('click', () => {
      this.submitSdp();
    });

    // 닫기 버튼
    document.getElementById('closeSignalingBtn').addEventListener('click', () => {
      this.hide();
    });

    // 배경 클릭 시 닫기 방지
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        e.stopPropagation();
      }
    });
  }

  // 호스트 모드: Offer 표시 → Answer 입력 대기
  showHostMode(offerSdp) {
    document.getElementById('signalingTitle').textContent = '방 만들기';
    document.getElementById('signalingDesc').textContent = '아래 코드를 상대방에게 전달하세요.';

    // 단계 1 활성화
    this.setStep(1);

    // Offer 표시
    document.getElementById('sdpDisplaySection').style.display = 'block';
    document.getElementById('sdpDisplayLabel').textContent = '내 연결 코드 (Offer):';
    document.getElementById('sdpDisplay').value = this.compressSdp(offerSdp);

    // Answer 입력 숨김 (복사 후 표시)
    document.getElementById('sdpInputSection').style.display = 'none';
    document.getElementById('sdpInputLabel').textContent = '상대방 응답 코드 (Answer):';

    this.setStatus('코드를 복사한 후 상대방에게 전달하세요.', 'info');
    this.show();
  }

  // 호스트: Answer 입력 단계로 전환
  showAnswerInput() {
    this.setStep(2);
    document.getElementById('signalingDesc').textContent = '상대방의 응답 코드를 입력하세요.';
    document.getElementById('sdpInputSection').style.display = 'block';
    document.getElementById('sdpInput').value = '';
    document.getElementById('sdpInput').placeholder = '상대방의 응답 코드를 붙여넣으세요...';
    this.setStatus('상대방이 보낸 응답 코드를 입력하세요.', 'info');
  }

  // 클라이언트 모드: Offer 입력 → Answer 표시
  showClientMode() {
    document.getElementById('signalingTitle').textContent = '방 참가';
    document.getElementById('signalingDesc').textContent = '호스트의 연결 코드를 입력하세요.';

    // 단계 1 활성화
    this.setStep(1);

    // Offer 입력 표시
    document.getElementById('sdpInputSection').style.display = 'block';
    document.getElementById('sdpInputLabel').textContent = '호스트 연결 코드 (Offer):';
    document.getElementById('sdpInput').value = '';
    document.getElementById('sdpInput').placeholder = '호스트의 연결 코드를 붙여넣으세요...';

    // Answer 표시 숨김
    document.getElementById('sdpDisplaySection').style.display = 'none';

    this.setStatus('호스트가 보낸 연결 코드를 입력하세요.', 'info');
    this.show();
  }

  // 클라이언트: Answer 표시 단계
  showAnswerDisplay(answerSdp) {
    this.setStep(2);
    document.getElementById('signalingDesc').textContent = '아래 응답 코드를 호스트에게 전달하세요.';

    // Answer 표시
    document.getElementById('sdpDisplaySection').style.display = 'block';
    document.getElementById('sdpDisplayLabel').textContent = '내 응답 코드 (Answer):';
    document.getElementById('sdpDisplay').value = this.compressSdp(answerSdp);

    // 입력 숨김
    document.getElementById('sdpInputSection').style.display = 'none';

    this.setStatus('응답 코드를 복사해서 호스트에게 전달하세요.', 'info');
  }

  // 단계 표시 업데이트
  setStep(step) {
    document.querySelectorAll('.signaling-steps .step').forEach((el) => {
      el.classList.remove('active', 'completed');
      const stepNum = parseInt(el.dataset.step);
      if (stepNum < step) {
        el.classList.add('completed');
      } else if (stepNum === step) {
        el.classList.add('active');
      }
    });
  }

  // 복사 기능
  async copySdp() {
    const sdpText = document.getElementById('sdpDisplay').value;

    try {
      await navigator.clipboard.writeText(sdpText);
      this.setStatus('✓ 복사되었습니다!', 'success');

      // 호스트인 경우 Answer 입력 단계로 전환
      const title = document.getElementById('signalingTitle').textContent;
      if (title === '방 만들기') {
        setTimeout(() => {
          this.showAnswerInput();
        }, 1000);
      }
    } catch (e) {
      // Clipboard API 실패 시 수동 선택
      document.getElementById('sdpDisplay').select();
      this.setStatus('Ctrl+C로 복사하세요.', 'warning');
    }
  }

  // SDP 제출
  submitSdp() {
    const sdpText = document.getElementById('sdpInput').value.trim();

    if (!sdpText) {
      this.setStatus('코드를 입력하세요.', 'error');
      return;
    }

    const decompressed = this.decompressSdp(sdpText);

    if (!this.validateSdp(decompressed)) {
      this.setStatus('유효하지 않은 코드입니다.', 'error');
      return;
    }

    // 콜백 호출
    const title = document.getElementById('signalingTitle').textContent;
    if (title === '방 만들기') {
      // 호스트가 Answer 받음
      if (this.onAnswerSubmit) this.onAnswerSubmit(decompressed);
    } else {
      // 클라이언트가 Offer 받음
      if (this.onOfferSubmit) this.onOfferSubmit(decompressed);
    }
  }

  // SDP 압축 (Base64 인코딩으로 짧게)
  compressSdp(sdp) {
    try {
      // 간단한 압축: 불필요한 줄 제거 후 Base64
      const compressed = btoa(unescape(encodeURIComponent(sdp)));
      return compressed;
    } catch (e) {
      return sdp;
    }
  }

  // SDP 압축 해제
  decompressSdp(compressed) {
    try {
      // Base64 디코딩
      const sdp = decodeURIComponent(escape(atob(compressed)));
      return sdp;
    } catch (e) {
      // 압축되지 않은 원본일 수 있음
      return compressed;
    }
  }

  // SDP 유효성 검사
  validateSdp(sdp) {
    return sdp && (sdp.includes('v=0') || sdp.includes('a=ice'));
  }

  // 상태 메시지 설정
  setStatus(message, type = 'info') {
    const statusEl = document.getElementById('signalingStatus');
    statusEl.textContent = message;
    statusEl.className = `signaling-status ${type}`;
  }

  // 연결 성공 표시
  showConnected() {
    this.setStatus('✓ 연결되었습니다!', 'success');
    setTimeout(() => {
      this.hide();
    }, 1000);
  }

  // 연결 실패 표시
  showError(message) {
    this.setStatus(`✗ ${message}`, 'error');
  }

  // 모달 표시
  show() {
    this.modal.classList.add('active');
  }

  // 모달 숨김
  hide() {
    this.modal.classList.remove('active');
  }

  // 정리
  cleanup() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
