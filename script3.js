// ==========================================
// Ball Balancing Robot - Level & PID Tuning Lab (script3.js)
// ==========================================

const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const angleValueEl = document.getElementById('angleValue');
const errorValueEl = document.getElementById('errorValue');
const velocityValueEl = document.getElementById('velocityValue');
const controlModeDisplay = document.getElementById('controlModeDisplay');

const gameOverOverlay = document.getElementById('gameOverOverlay');
const restartBtn = document.getElementById('restartBtn');

// 레벨 버튼들
const level1Btn = document.getElementById('level1Btn');
const level2Btn = document.getElementById('level2Btn');
const level3Btn = document.getElementById('level3Btn');
const currentLevelBadge = document.getElementById('currentLevelBadge');
const currentLevelDesc = document.getElementById('currentLevelDesc');

// PID 메인 제어 버튼들
const togglePidBtn = document.getElementById('togglePidBtn');
const pidStatusText = document.getElementById('pidStatusText');
const nudgeBtn = document.getElementById('nudgeBtn');
const centerBallBtn = document.getElementById('centerBallBtn');

// PID 게인 입력 및 슬라이더
const pGainSlider = document.getElementById('pGainSlider');
const pGainInput = document.getElementById('pGainInput');
const iGainSlider = document.getElementById('iGainSlider');
const iGainInput = document.getElementById('iGainInput');
const dGainSlider = document.getElementById('dGainSlider');
const dGainInput = document.getElementById('dGainInput');

// PID 기여도 바 & 텍스트
const pBarFill = document.getElementById('pBarFill');
const iBarFill = document.getElementById('iBarFill');
const dBarFill = document.getElementById('dBarFill');
const pValText = document.getElementById('pValText');
const iValText = document.getElementById('iValText');
const dValText = document.getElementById('dValText');

// 프리셋 버튼들
const presetStable = document.getElementById('presetStable');
const presetPHeavy = document.getElementById('presetPHeavy');
const presetDLow = document.getElementById('presetDLow');
const presetHighSpeed = document.getElementById('presetHighSpeed');

// 물리 환경 슬라이더
const beamWidthSlider = document.getElementById('beamWidthSlider');
const beamWidthDisplay = document.getElementById('beamWidthDisplay');
const gravitySlider = document.getElementById('gravitySlider');
const gravityDisplay = document.getElementById('gravityDisplay');

// 실시간 스코프 캔버스
const scopeCanvas = document.getElementById('scopeCanvas');
const scopeCtx = scopeCanvas ? scopeCanvas.getContext('2d') : null;

// ==========================================
// 1. 물리 시뮬레이션 상태 및 설정
// ==========================================
const MAX_ANGLE = Math.PI / 6; // 30도 (최대 기울기 한계)
const MANUAL_ANGLE_SPEED = Math.PI / 3; // 수동 조작 시 초당 60도
const SERVO_SPEED = Math.PI * 3.5; // PID 서보 모터 반응 속도 (rad/s)

// 기본 레일(Beam)
const beam = {
    width: 600,
    height: 16,
    color: '#475569'
};

// 레벨별 기본 프로파일 정의
const LEVEL_CONFIGS = {
    1: {
        radius: 16,
        gravity: 981,
        color: '#38bdf8',
        gradientStart: '#bae6fd',
        gradientEnd: '#0284c7',
        name: 'LEVEL 1',
        desc: '기본 크기 (R:16) & 표준 중력 속도 (G:981)',
        badgeBg: 'rgba(56, 189, 248, 0.2)',
        badgeColor: '#38bdf8',
        defaultPID: { p: 0.0035, i: 0.0002, d: 0.0070 }
    },
    2: {
        radius: 16,
        gravity: 2200,
        color: '#f59e0b',
        gradientStart: '#fef3c7',
        gradientEnd: '#b45309',
        name: 'LEVEL 2',
        desc: '중력(공 속도) 대폭 증가 (G:2200)',
        badgeBg: 'rgba(245, 158, 11, 0.2)',
        badgeColor: '#f59e0b',
        defaultPID: { p: 0.0045, i: 0.00025, d: 0.0090 }
    },
    3: {
        radius: 9,
        gravity: 3500,
        color: '#ef4444',
        gradientStart: '#fecaca',
        gradientEnd: '#991b1b',
        name: 'LEVEL 3',
        desc: '소형 공 (R:9) & 초고속 가속 (G:3500)',
        badgeBg: 'rgba(239, 68, 68, 0.2)',
        badgeColor: '#ef4444',
        defaultPID: { p: 0.0065, i: 0.0003, d: 0.0130 }
    }
};

let currentLevel = 1;
let G = LEVEL_CONFIGS[1].gravity;

// 공 객체
const ball = {
    radius: LEVEL_CONFIGS[1].radius,
    color: LEVEL_CONFIGS[1].color,
    gradientStart: LEVEL_CONFIGS[1].gradientStart,
    gradientEnd: LEVEL_CONFIGS[1].gradientEnd
};

// 시뮬레이션 상태
let state = {
    angle: 0,
    x: 0,        // 중심(0) 기준 공의 위치 (-beam.width/2 ~ +beam.width/2)
    v: 0,        // 공의 속도 (px/s)
    isGameOver: false,
    lastTime: 0
};

// PID 제어 파라미터
let isPidActive = true;
let kP = 0.0035;
let kI = 0.0002;
let kD = 0.0070;

let integralError = 0;
let targetServoAngle = 0;

// 실시간 기여도 기록용
let lastPContrib = 0;
let lastIContrib = 0;
let lastDContrib = 0;

// 실시간 스코프 데이터 기록
const scopeHistory = [];
const MAX_SCOPE_SAMPLES = 150;
let lastScopeSampleTime = 0;

// 키보드 입력 핸들링 (수동 조작용)
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        keys[e.code] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        keys[e.code] = false;
    }
});

// 태블릿 / 모바일 터치 버튼 바인딩
const touchLeftBtn = document.getElementById('touchLeftBtn');
const touchRightBtn = document.getElementById('touchRightBtn');

function bindTouchTiltButton(btn, keyName) {
    if (!btn) return;

    const start = (e) => {
        if (e.cancelable) e.preventDefault();
        keys[keyName] = true;
        btn.classList.add('pressing');
        if (state.isGameOver) resetSimulation();
    };

    const stop = (e) => {
        if (e.cancelable) e.preventDefault();
        keys[keyName] = false;
        btn.classList.remove('pressing');
    };

    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop, { passive: false });
    btn.addEventListener('touchcancel', stop, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
}

bindTouchTiltButton(touchLeftBtn, 'ArrowLeft');
bindTouchTiltButton(touchRightBtn, 'ArrowRight');

// ==========================================
// 2. 레벨 전환 로직
// ==========================================
function setLevel(lvl) {
    if (!LEVEL_CONFIGS[lvl]) return;
    currentLevel = lvl;

    const conf = LEVEL_CONFIGS[lvl];
    ball.radius = conf.radius;
    ball.color = conf.color;
    ball.gradientStart = conf.gradientStart;
    ball.gradientEnd = conf.gradientEnd;
    G = conf.gravity;

    // 슬라이더 및 디스플레이 갱신
    if (gravitySlider) gravitySlider.value = G;
    if (gravityDisplay) gravityDisplay.textContent = G;

    // 배너 갱신
    currentLevelBadge.textContent = conf.name;
    currentLevelBadge.style.background = conf.badgeBg;
    currentLevelBadge.style.color = conf.badgeColor;
    currentLevelDesc.textContent = conf.desc;

    // 버튼 활성화 클래스 갱신
    [level1Btn, level2Btn, level3Btn].forEach((btn, idx) => {
        btn.classList.toggle('active', idx + 1 === lvl);
    });

    // 레벨에 맞는 추천 PID 게인으로 자동 업데이트
    updateGains(conf.defaultPID.p, conf.defaultPID.i, conf.defaultPID.d);

    // 공 리셋
    resetSimulation();
}

level1Btn.addEventListener('click', () => setLevel(1));
level2Btn.addEventListener('click', () => setLevel(2));
level3Btn.addEventListener('click', () => setLevel(3));

// ==========================================
// 3. PID 제어 토글 및 프리셋 핸들러
// ==========================================
function updatePidButtonUI() {
    togglePidBtn.classList.toggle('active', isPidActive);
    pidStatusText.textContent = isPidActive ? 'PID 제어: ON' : 'PID 제어: OFF';
    controlModeDisplay.textContent = isPidActive ? 'PID 자동' : '수동 조작 (← / →)';
    controlModeDisplay.style.color = isPidActive ? '#34d399' : '#f59e0b';
}

togglePidBtn.addEventListener('click', () => {
    isPidActive = !isPidActive;
    integralError = 0;
    updatePidButtonUI();
});

// 외란 주기 (공 튕기기)
nudgeBtn.addEventListener('click', () => {
    if (state.isGameOver) resetSimulation();
    // 무작위로 좌우 한쪽으로 공을 밀거나 위치 이동
    const sign = Math.random() < 0.5 ? -1 : 1;
    const offset = (beam.width * 0.25) + Math.random() * (beam.width * 0.15);
    state.x = sign * offset;
    state.v = -sign * (100 + Math.random() * 150); // 반대 방향으로도 속도 부여
    integralError = 0;
});

// 중앙 복귀
centerBallBtn.addEventListener('click', () => {
    state.x = 0;
    state.v = 0;
    state.angle = 0;
    integralError = 0;
    targetServoAngle = 0;
    if (state.isGameOver) resetSimulation();
});

// PID 게인 일괄 업데이트 함수
function updateGains(p, i, d) {
    kP = parseFloat(p);
    kI = parseFloat(i);
    kD = parseFloat(d);

    pGainSlider.value = kP;
    pGainInput.value = kP;

    iGainSlider.value = kI;
    iGainInput.value = kI;

    dGainSlider.value = kD;
    dGainInput.value = kD;

    integralError = 0; // 게인 변경 시 적분 누적 오차 초기화
}

// 프리셋 바인딩
presetStable.addEventListener('click', () => updateGains(0.0035, 0.0002, 0.0070));
presetPHeavy.addEventListener('click', () => updateGains(0.0120, 0.0001, 0.0030));
presetDLow.addEventListener('click', () => updateGains(0.0050, 0.0000, 0.0010));
presetHighSpeed.addEventListener('click', () => updateGains(0.0065, 0.0003, 0.0130));

// 슬라이더 <-> 인풋 양방향 바인딩 헬퍼
function bindGainControl(slider, input, callback) {
    slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        input.value = val;
        callback(val);
    });

    input.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 0;
        slider.value = val;
        callback(val);
    });
}

bindGainControl(pGainSlider, pGainInput, (val) => { kP = val; });
bindGainControl(iGainSlider, iGainInput, (val) => { kI = val; integralError = 0; });
bindGainControl(dGainSlider, dGainInput, (val) => { kD = val; });

// 기타 물리 슬라이더 바인딩
beamWidthSlider.addEventListener('input', (e) => {
    beam.width = parseFloat(e.target.value);
    beamWidthDisplay.textContent = beam.width;
});

gravitySlider.addEventListener('input', (e) => {
    G = parseFloat(e.target.value);
    gravityDisplay.textContent = G;
});

// ==========================================
// 4. 물리 엔진 & PID 로직 연산
// ==========================================
function updatePhysics(dt) {
    if (state.isGameOver) return;

    if (isPidActive) {
        // --- PID 제어 연산 ---
        // 목표 위치(SetPoint): 0 (중심)
        // 오차: positionError = state.x (양수면 오른쪽, 음수면 왼쪽)
        const posError = state.x;

        // P항 (비례)
        lastPContrib = kP * posError;

        // I항 (적분) - 오차 누적 및 안티 와인드업
        integralError += posError * dt;
        const INTEGRAL_LIMIT = 3000;
        integralError = Math.max(-INTEGRAL_LIMIT, Math.min(INTEGRAL_LIMIT, integralError));
        lastIContrib = kI * integralError;

        // D항 (미분) - 속도 v = dx/dt 를 직접 사용하여 미분 잡음 제거
        lastDContrib = kD * state.v;

        // 목표 각도 계산 (공이 오른쪽에 있으면 왼쪽으로 굴려야 하므로 각도는 음수)
        targetServoAngle = -(lastPContrib + lastIContrib + lastDContrib);

        // 태블릿 터치 버튼 / 키보드 수동 개입 (PID 동작 중 외란 인가)
        if (keys.ArrowLeft) {
            targetServoAngle -= 0.18; // 좌측으로 강제 기울임
        }
        if (keys.ArrowRight) {
            targetServoAngle += 0.18; // 우측으로 강제 기울임
        }

        // 각도 제한
        targetServoAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, targetServoAngle));

        // 서보 모터 각도 추종 (실제 서보 속도 한계 시뮬레이션)
        const angleDiff = targetServoAngle - state.angle;
        const maxStep = SERVO_SPEED * dt;
        if (Math.abs(angleDiff) <= maxStep) {
            state.angle = targetServoAngle;
        } else {
            state.angle += Math.sign(angleDiff) * maxStep;
        }
    } else {
        // 수동 키보드 조작
        if (keys.ArrowLeft) {
            state.angle -= MANUAL_ANGLE_SPEED * dt;
        }
        if (keys.ArrowRight) {
            state.angle += MANUAL_ANGLE_SPEED * dt;
        }
        state.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, state.angle));

        lastPContrib = 0;
        lastIContrib = 0;
        lastDContrib = 0;
    }

    // 공의 물리 연산
    // 가속도 a = g * sin(theta)
    const a = G * Math.sin(state.angle);
    state.v += a * dt;
    state.x += state.v * dt;

    // 게임 오버 체크 (레일 양 끝 이탈)
    const halfBeam = beam.width / 2;
    if (state.x > halfBeam || state.x < -halfBeam) {
        state.isGameOver = true;
        gameOverOverlay.classList.remove('hidden');
    }
}

// ==========================================
// 5. 렌더링 (Canvas 그리기)
// ==========================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);

    // 1. 회전 중심축 받침대 (Fulcrum / Pivot)
    ctx.beginPath();
    ctx.moveTo(0, beam.height / 2);
    ctx.lineTo(-20, beam.height / 2 + 40);
    ctx.lineTo(20, beam.height / 2 + 40);
    ctx.closePath();
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. 중심 축 홀로그램 가이드선 (중앙 목표점)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, -120);
    ctx.lineTo(0, 50);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]); // 대시 리셋

    // 3. 빔 회전 적용
    ctx.rotate(state.angle);

    // 4. 레일(Beam) 그리기
    ctx.fillStyle = beam.color;
    ctx.beginPath();
    ctx.roundRect(-beam.width / 2, -beam.height / 2, beam.width, beam.height, 8);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 빔 상단 눈금자 (Tick marks)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let mark = -beam.width / 2; mark <= beam.width / 2; mark += 50) {
        const h = (mark === 0) ? 10 : 5;
        ctx.fillRect(mark - 0.5, -beam.height / 2, 1, h);
    }

    // 5. 공 그림자 그리기
    ctx.beginPath();
    ctx.ellipse(state.x, -beam.height / 2, ball.radius * 0.85, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // 6. 공 본체 그리기
    const ballY = -beam.height / 2 - ball.radius;

    ctx.beginPath();
    ctx.arc(state.x, ballY, ball.radius, 0, Math.PI * 2);

    const grad = ctx.createRadialGradient(
        state.x - ball.radius * 0.35,
        ballY - ball.radius * 0.35,
        ball.radius * 0.1,
        state.x,
        ballY,
        ball.radius
    );
    grad.addColorStop(0, ball.gradientStart);
    grad.addColorStop(0.5, ball.color);
    grad.addColorStop(1, ball.gradientEnd);
    ctx.fillStyle = grad;
    ctx.fill();

    // 공 테두리 글로우
    ctx.strokeStyle = ball.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 7. 공 굴러감 회전 표시선 (Rolling indicator)
    ctx.save();
    ctx.translate(state.x, ballY);
    const rotationAngle = state.x / ball.radius;
    ctx.rotate(rotationAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ball.radius * 0.9, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
}

// ==========================================
// 6. 실시간 스코프 그래프 (Real-time Scope)
// ==========================================
function updateScopeGraph(timestamp) {
    if (!scopeCtx) return;

    // 50ms마다 1샘플 기록
    if (timestamp - lastScopeSampleTime > 50) {
        scopeHistory.push(state.x);
        if (scopeHistory.length > MAX_SCOPE_SAMPLES) {
            scopeHistory.shift();
        }
        lastScopeSampleTime = timestamp;
    }

    const w = scopeCanvas.width;
    const h = scopeCanvas.height;
    const midY = h / 2;

    scopeCtx.clearRect(0, 0, w, h);

    // 배경 그리드선
    scopeCtx.strokeStyle = '#1e293b';
    scopeCtx.lineWidth = 1;

    // 중앙 목표선 (0px)
    scopeCtx.beginPath();
    scopeCtx.setLineDash([2, 2]);
    scopeCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    scopeCtx.moveTo(0, midY);
    scopeCtx.lineTo(w, midY);
    scopeCtx.stroke();
    scopeCtx.setLineDash([]);

    if (scopeHistory.length < 2) return;

    // 궤적 그리기
    scopeCtx.beginPath();
    scopeCtx.strokeStyle = ball.color;
    scopeCtx.lineWidth = 2;

    const stepX = w / (MAX_SCOPE_SAMPLES - 1);
    const maxExtent = beam.width / 2;

    for (let i = 0; i < scopeHistory.length; i++) {
        const x = i * stepX;
        // -maxExtent ~ +maxExtent 를 midY 기준으로 매핑
        const normalized = scopeHistory[i] / maxExtent;
        const y = midY + normalized * (midY * 0.85);

        if (i === 0) {
            scopeCtx.moveTo(x, y);
        } else {
            scopeCtx.lineTo(x, y);
        }
    }
    scopeCtx.stroke();
}

// ==========================================
// 7. UI 및 메트릭 업데이트
// ==========================================
function updateUI() {
    // 각도 표시
    const degrees = (state.angle * (180 / Math.PI)).toFixed(1);
    angleValueEl.textContent = `${degrees}°`;

    // 오차 (중심 기준 거리)
    errorValueEl.textContent = `${state.x >= 0 ? '+' : ''}${state.x.toFixed(1)} px`;
    if (Math.abs(state.x) < 5) {
        errorValueEl.style.color = '#34d399'; // 거의 완벽한 중앙이면 녹색
    } else {
        errorValueEl.style.color = '#38bdf8';
    }

    // 속도 표시
    velocityValueEl.textContent = `${state.v.toFixed(0)} px/s`;

    // PID 기여도 바 업데이트
    const scale = 0.5; // rad 기준 0.5 rad(= 약 28도)를 100%로 시각화
    const pWidth = Math.min(100, (Math.abs(lastPContrib) / scale) * 100);
    const iWidth = Math.min(100, (Math.abs(lastIContrib) / scale) * 100);
    const dWidth = Math.min(100, (Math.abs(lastDContrib) / scale) * 100);

    pBarFill.style.width = `${pWidth}%`;
    iBarFill.style.width = `${iWidth}%`;
    dBarFill.style.width = `${dWidth}%`;

    pValText.textContent = (lastPContrib * (180 / Math.PI)).toFixed(1) + '°';
    iValText.textContent = (lastIContrib * (180 / Math.PI)).toFixed(1) + '°';
    dValText.textContent = (lastDContrib * (180 / Math.PI)).toFixed(1) + '°';
}

// ==========================================
// 8. 게임 루프 & 초기화
// ==========================================
function resetSimulation() {
    state.angle = 0;
    state.x = 0;
    state.v = 0;
    state.isGameOver = false;
    state.lastTime = performance.now();
    integralError = 0;
    targetServoAngle = 0;
    lastPContrib = 0;
    lastIContrib = 0;
    lastDContrib = 0;
    gameOverOverlay.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

restartBtn.addEventListener('click', resetSimulation);

function gameLoop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = (timestamp - state.lastTime) / 1000;
    state.lastTime = timestamp;

    const cappedDt = Math.min(dt, 0.05); // 안정적 물리 연산을 위해 캡 적용

    updatePhysics(cappedDt);
    draw();
    updateScopeGraph(timestamp);
    updateUI();

    if (!state.isGameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// 초기 레벨 1 세팅 및 시뮬레이션 시작
setLevel(1);
updatePidButtonUI();
