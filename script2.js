const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const angleValueEl = document.getElementById('angleValue');
const distanceValueEl = document.getElementById('distanceValue');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const restartBtn = document.getElementById('restartBtn');
const randomBtn = document.getElementById('randomBtn');
const autoBtn = document.getElementById('autoBtn');
const pidBtn = document.getElementById('pidBtn');

const rlBtn = document.getElementById('rlBtn');
const rlEpisodeDisplay = document.getElementById('rlEpisodeDisplay');
const rlSurvivalDisplay = document.getElementById('rlSurvivalDisplay');
const rlEpsilonDisplay = document.getElementById('rlEpsilonDisplay');

// Physics constants & properties
let G = 981; // Gravity (pixels per second squared) - equivalent to 9.81 m/s^2 where 100px = 1m
const MAX_ANGLE = Math.PI / 6; // 30 degrees
const ANGLE_SPEED = Math.PI / 3; // 60 degrees per second

// PID Gains (아두이노 코드 기준)
let kP = 1.0;
let kI = 0.0;
let kD = 0.0;
let integralError = 0;
let previousArduinoError = 0;
let targetServoAngle = 0;

// Q-Learning Variables
let qTable = {};
let qAlpha = 0.1;
let qGamma = 0.99;
let qEpsilon = 1.0;
let qEpisode = 0;
let qSurvivalTime = 0;
let qLastState = null;
let qLastAction = null;
let qEpsilonDecay = 0.995;
let qMinEpsilon = 0.01;

// Graph Variables
const rlGraphCanvas = document.getElementById('rlGraphCanvas');
const rlCtx = rlGraphCanvas ? rlGraphCanvas.getContext('2d') : null;
let episodeHistory = [];

function drawRLGraph() {
    if (!rlCtx) return;
    rlCtx.clearRect(0, 0, rlGraphCanvas.width, rlGraphCanvas.height);

    if (episodeHistory.length === 0) return;

    // Find max survival time for scaling
    const maxTime = Math.max(...episodeHistory, 1);

    rlCtx.beginPath();
    rlCtx.strokeStyle = '#38bdf8';
    rlCtx.lineWidth = 2;

    const stepX = rlGraphCanvas.width / Math.max(episodeHistory.length - 1, 1);

    for (let i = 0; i < episodeHistory.length; i++) {
        const x = i * stepX;
        const y = rlGraphCanvas.height - (episodeHistory[i] / maxTime) * rlGraphCanvas.height * 0.9;

        if (i === 0) {
            rlCtx.moveTo(x, y);
        } else {
            rlCtx.lineTo(x, y);
        }
    }
    rlCtx.stroke();
}

function getDiscretizedState() {
    let xBin = Math.floor(((state.x + beam.width / 2) / beam.width) * 10);
    xBin = Math.max(0, Math.min(9, xBin));

    let vBin = Math.floor(((state.v + 1000) / 2000) * 10);
    vBin = Math.max(0, Math.min(9, vBin));

    let aBin = Math.floor(((state.angle + MAX_ANGLE) / (MAX_ANGLE * 2)) * 10);
    aBin = Math.max(0, Math.min(9, aBin));

    return `${xBin}_${vBin}_${aBin}`;
}

function getQValue(stateKey, action) {
    if (!qTable[stateKey]) {
        qTable[stateKey] = { 'Left': 0, 'Right': 0, 'None': 0 };
    }
    return qTable[stateKey][action];
}

function setQValue(stateKey, action, value) {
    if (!qTable[stateKey]) {
        qTable[stateKey] = { 'Left': 0, 'Right': 0, 'None': 0 };
    }
    qTable[stateKey][action] = value;
}

function getBestAction(stateKey) {
    if (!qTable[stateKey]) {
        qTable[stateKey] = { 'Left': 0, 'Right': 0, 'None': 0 };
    }
    const actions = qTable[stateKey];
    let bestAction = 'None';
    let maxQ = actions['None'];

    if (actions['Left'] > maxQ) { maxQ = actions['Left']; bestAction = 'Left'; }
    if (actions['Right'] > maxQ) { maxQ = actions['Right']; bestAction = 'Right'; }

    return bestAction;
}

// Simulation state
let state = {
    angle: 0,
    x: 0, // position of ball relative to center of beam
    v: 0, // velocity
    isGameOver: false,
    lastTime: 0,
    lastAutoTime: 0
};

let t = -1; // -1: 꺼짐, 0: 랜덤, 1: 오토(위치), 2: PID

// Beam properties
const beam = {
    width: 600,
    height: 16,
    color: '#475569'
};

// Ball properties
const ball = {
    radius: 16,
    color: '#38bdf8'
};

// Input handling
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
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

restartBtn.addEventListener('click', resetSimulation);

function setMode(mode) {
    if (t === mode) {
        t = -1; // 이미 켜진 모드를 누르면 끕니다.
    } else {
        t = mode;
    }

    randomBtn.classList.toggle('active', t === 0);
    autoBtn.classList.toggle('active', t === 1);
    pidBtn.classList.toggle('active', t === 2);
    rlBtn.classList.toggle('active', t === 3);

    randomBtn.textContent = t === 0 ? 'Random: ON' : 'Random: OFF';
    autoBtn.textContent = t === 1 ? 'Auto: ON' : 'Auto: OFF';
    pidBtn.textContent = t === 2 ? 'Arduino PID: ON' : 'Arduino PID: OFF';
    rlBtn.textContent = t === 3 ? 'RL: ON' : 'RL: OFF';

    // 모드가 변경되면 눌려있던 키를 초기화합니다.
    keys.ArrowLeft = false;
    keys.ArrowRight = false;

    if (t === 3) {
        qSurvivalTime = 0;
        qLastState = null;
        qLastAction = null;
    }
}

randomBtn.addEventListener('click', () => setMode(0));
autoBtn.addEventListener('click', () => setMode(1));
pidBtn.addEventListener('click', () => setMode(2));
rlBtn.addEventListener('click', () => setMode(3));

function resetSimulation() {
    state = {
        angle: 0,
        x: 0,
        v: 0,
        isGameOver: false,
        lastTime: performance.now(),
        lastAutoTime: performance.now()
    };
    integralError = 0;
    previousArduinoError = 0;
    targetServoAngle = 0;
    gameOverOverlay.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

// 사용자가 직접 코딩할 자동 밸런싱 로직
function runAutoLogic() {
    if (t === -1 || state.isGameOver) return;

    let currentDistance = (beam.width / 2) + state.x;
    let currentAngle = state.angle;
    let currentVelocity = state.v;

    // 1. 매번 실행될 때마다 양쪽 키를 모두 뗀(false) 상태로 초기화
    keys.ArrowLeft = false;
    keys.ArrowRight = false;

    if (t === 0) {
        // t = 0: 랜덤하게 좌우 누르기
        if (Math.random() < 0.5) {
            keys.ArrowLeft = true;
        } else {
            keys.ArrowRight = true;
        }
    } else if (t === 1) {
        // t = 1: 위치에 따라 버튼만 누르기 (현재 - 살짝 치기)
        if (state.x > 0) {
            keys.ArrowLeft = true;
        } else if (state.x < 0) {
            keys.ArrowRight = true;
        }
    } else if (t === 2) {
        // t = 2: 아두이노 PID 코드 시뮬레이션
        let dt = 0.1; // runAutoLogic은 100ms마다 호출됨
        
        // 1. 픽셀을 cm 단위로 변환 (10px = 1cm로 가정)
        let distance_cm = currentDistance / 10.0;
        let setPoint_cm = (beam.width / 2) / 10.0;
        
        // 2. 오차 계산 (에러 = 목표위치 - 현재위치)
        let error = setPoint_cm - distance_cm;

        // 3. PID 계산
        let proportional = kP * error;
        integralError += error * dt;
        let derivative = (error - previousArduinoError) / dt;

        let output = proportional + (kI * integralError) + (kD * derivative);

        // 4. 서보 모터 제어 신호로 매핑 (아두이노 코드와 동일)
        let angleDeg = 90 + output;

        // 5. 안전 범위 제한 (80도 ~ 100도)
        angleDeg = Math.max(80, Math.min(100, angleDeg));

        // 6. 시뮬레이션 상의 물리적 각도(라디안)로 변환
        targetServoAngle = (angleDeg - 90) * (Math.PI / 180);

        // 7. 다음 루프를 위해 상태 저장
        previousArduinoError = error;
    } else if (t === 3) {
        // t = 3: RL (Q-Learning) Mode
        const currentState = getDiscretizedState();

        // Reward previous action
        if (qLastState !== null && qLastAction !== null) {
            // Survived 0.1s step
            const reward = 1;
            const maxNextQ = getQValue(currentState, getBestAction(currentState));
            const oldQ = getQValue(qLastState, qLastAction);
            const newQ = oldQ + qAlpha * (reward + qGamma * maxNextQ - oldQ);
            setQValue(qLastState, qLastAction, newQ);
        }

        // Choose new action
        let action = 'None';
        if (Math.random() < qEpsilon) {
            const actions = ['Left', 'Right', 'None'];
            action = actions[Math.floor(Math.random() * actions.length)];
        } else {
            action = getBestAction(currentState);
        }

        // Apply action
        if (action === 'Left') keys.ArrowLeft = true;
        else if (action === 'Right') keys.ArrowRight = true;

        // Save for next step
        qLastState = currentState;
        qLastAction = action;
        qSurvivalTime += 0.1;

        if (rlSurvivalDisplay) rlSurvivalDisplay.textContent = qSurvivalTime.toFixed(1) + 's';
    }
}

function updatePhysics(dt) {
    if (state.isGameOver) return;

    // 1. Update Beam Angle based on input
    if (t === 2) {
        // 아두이노 모드: 서보 모터 이동 시뮬레이션 (물리적인 속도 제한)
        const SERVO_SPEED = Math.PI * 2; // 초당 한 바퀴 정도의 빠른 속도로 가정
        if (state.angle < targetServoAngle) {
            state.angle += Math.min(SERVO_SPEED * dt, targetServoAngle - state.angle);
        } else if (state.angle > targetServoAngle) {
            state.angle -= Math.min(SERVO_SPEED * dt, state.angle - targetServoAngle);
        }
    } else if (keys.ArrowLeft || keys.ArrowRight) {
        // 모터의 불안정함을 모사하기 위한 노이즈(Jitter) 추가
        const jitter = (Math.random() - 0.5) * 0.015;

        if (keys.ArrowLeft) {
            state.angle -= (ANGLE_SPEED * dt) + jitter;
        }
        if (keys.ArrowRight) {
            state.angle += (ANGLE_SPEED * dt) + jitter;
        }
    }

    // Clamp angle
    state.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, state.angle));

    // 2. Physics of the ball
    // Acceleration a = g * sin(theta)
    // Note: To make it feel a bit more like a rolling solid sphere, 
    // we could multiply by 5/7, but direct a = g * sin(theta) is fine for simulation.
    const a = G * Math.sin(state.angle);

    state.v += a * dt;
    state.x += state.v * dt;

    // 3. Check Game Over (Ball falls off edge)
    if (state.x > beam.width / 2 || state.x < -beam.width / 2) {
        state.isGameOver = true;

        if (t === 3) {
            // RL Penalty & Auto Reset
            if (qLastState !== null && qLastAction !== null) {
                const reward = -100; // Big penalty for falling off
                const oldQ = getQValue(qLastState, qLastAction);
                const newQ = oldQ + qAlpha * (reward + qGamma * 0 - oldQ); // terminal state Q is 0
                setQValue(qLastState, qLastAction, newQ);
            }

            qEpisode++;
            if (rlEpisodeDisplay) rlEpisodeDisplay.textContent = qEpisode;
            qEpsilon = Math.max(qMinEpsilon, qEpsilon * qEpsilonDecay);
            if (rlEpsilonDisplay) rlEpsilonDisplay.textContent = qEpsilon.toFixed(3);

            // Record history and draw graph
            episodeHistory.push(qSurvivalTime);
            if (episodeHistory.length > 200) episodeHistory.shift();
            drawRLGraph();

            qSurvivalTime = 0;
            qLastState = null;
            qLastAction = null;

            // Auto Reset without showing overlay
            setTimeout(resetSimulation, 50);
        } else {
            gameOverOverlay.classList.remove('hidden');
        }
    }
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Save context state
    ctx.save();

    // Translate to center for rotation
    ctx.translate(centerX, centerY);

    // Draw fulcrum (pivot)
    ctx.beginPath();
    ctx.moveTo(0, beam.height / 2);
    ctx.lineTo(-15, beam.height / 2 + 30);
    ctx.lineTo(15, beam.height / 2 + 30);
    ctx.closePath();
    ctx.fillStyle = '#64748b';
    ctx.fill();

    // Rotate context by beam angle
    ctx.rotate(state.angle);

    // Draw beam
    ctx.fillStyle = beam.color;
    ctx.beginPath();
    ctx.roundRect(-beam.width / 2, -beam.height / 2, beam.width, beam.height, 8);
    ctx.fill();

    // Draw ball
    // Ball sits on top of the beam
    const ballY = -beam.height / 2 - ball.radius;

    // Add simple shadow
    ctx.beginPath();
    ctx.ellipse(state.x, -beam.height / 2, ball.radius * 0.8, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Draw the ball itself
    ctx.beginPath();
    ctx.arc(state.x, ballY, ball.radius, 0, Math.PI * 2);

    // Gradient for the ball to look 3D
    const gradient = ctx.createRadialGradient(state.x - ball.radius * 0.3, ballY - ball.radius * 0.3, ball.radius * 0.1, state.x, ballY, ball.radius);
    gradient.addColorStop(0, '#bae6fd');
    gradient.addColorStop(0.5, ball.color);
    gradient.addColorStop(1, '#0284c7');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw a line on the ball to show rotation
    ctx.save();
    ctx.translate(state.x, ballY);
    // rotation angle = distance / radius
    const rotationAngle = state.x / ball.radius;
    ctx.rotate(rotationAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ball.radius, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Restore context state
    ctx.restore();
}

function updateUI() {
    // Convert angle from radians to degrees for display
    const degrees = (state.angle * (180 / Math.PI)).toFixed(1);
    angleValueEl.textContent = `${degrees}°`;

    // Distance from the left edge of the beam
    let distance = (beam.width / 2) + state.x;
    // Clamp distance between 0 and beam width for display
    distance = Math.max(0, Math.min(beam.width, distance));

    // Format distance (we can pretend 1px = 1mm, so 600px = 600mm)
    distanceValueEl.textContent = `${distance.toFixed(0)}px`;
}

function gameLoop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    if (!state.lastAutoTime) state.lastAutoTime = timestamp;

    const dt = (timestamp - state.lastTime) / 1000; // in seconds
    state.lastTime = timestamp;

    // Cap dt to prevent huge jumps if tab is inactive
    const cappedDt = Math.min(dt, 0.1);

    // 0.1초(100ms)마다 사용자 코딩 부분 실행
    if (timestamp - state.lastAutoTime >= 100) {
        runAutoLogic();
        state.lastAutoTime = timestamp;
    }

    updatePhysics(cappedDt);
    draw();
    updateUI();

    if (!state.isGameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// Start the simulation
resetSimulation();

// Settings UI Bindings
const beamWidthSlider = document.getElementById('beamWidthSlider');
const beamWidthDisplay = document.getElementById('beamWidthDisplay');
const gravitySlider = document.getElementById('gravitySlider');
const gravityDisplay = document.getElementById('gravityDisplay');

const pGainSlider = document.getElementById('pGainSlider');
const pGainDisplay = document.getElementById('pGainDisplay');
const iGainSlider = document.getElementById('iGainSlider');
const iGainDisplay = document.getElementById('iGainDisplay');
const dGainSlider = document.getElementById('dGainSlider');
const dGainDisplay = document.getElementById('dGainDisplay');
const randomPosBtn = document.getElementById('randomPosBtn');

function bindSlider(slider, display, callback) {
    slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        display.textContent = val;
        callback(val);
    });
}

bindSlider(beamWidthSlider, beamWidthDisplay, (val) => { beam.width = val; });
bindSlider(gravitySlider, gravityDisplay, (val) => { G = val; });
bindSlider(pGainSlider, pGainDisplay, (val) => { kP = val; });
bindSlider(iGainSlider, iGainDisplay, (val) => { kI = val; integralError = 0; });
bindSlider(dGainSlider, dGainDisplay, (val) => { kD = val; });

randomPosBtn.addEventListener('click', () => {
    // Random position between -40% and 40% of beam width to avoid instant death
    const maxExtent = (beam.width / 2) * 0.8;
    state.x = (Math.random() * 2 - 1) * maxExtent;
    state.v = 0;
    state.angle = 0;
    integralError = 0;
});
