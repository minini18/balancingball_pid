#include <Servo.h>

// 핀 설정
const int servoPin = 2; //9;
const int trigPin = 9;  //10;
const int echoPin = 10; //11;
const int switchPin = 3;

// 객체 생성
Servo myServo;

// PID 제어 변수 (초기값 설정)
float Kp = 0.4;
float Ki = 0.02;
float Kd = 0.25;
float centerAngle = 90.0; // 서보 모터의 정확한 수평 각도 (기본 90도)

const float setPoint = 13.5; // 목표 위치 12cm
float integral = 0.0;
float previousError = 0.0;
unsigned long previousTime = 0;

// 필터 적용을 위한 이전 거리 저장 변수
float previousDistance = setPoint;

void setup() {
  Serial.begin(9600);
  
  // 핀 모드 설정
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(switchPin, INPUT_PULLUP); // 내부 풀업 저항 사용
  
  // 서보 모터 초기화
  myServo.attach(servoPin);
  myServo.write(centerAngle); // 수평 초기화
  
  Serial.println("Ball Balancing Robot Initialized.");
  Serial.println("Waiting for switch to be pressed (LOW) to start PID control.");
  Serial.println("Commands when OFF: P[val], I[val], D[val], T[val] (Trim level), V (view PID), C (check distance)");
}

// 초음파 센서로 거리를 측정하는 함수
float measureDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms 타임아웃 (약 5m)
  if (duration == 0) return -1.0; // 센서 에러 혹은 범위를 벗어남
  
  float distance = duration * 0.034 / 2.0;
  return distance;
}

// 필터 기능 제거: 원본 거리를 그대로 반환하는 함수
float getFilteredDistance() {
  float rawDistance = measureDistance();
  
  // 센서 에러이거나 측정 범위를 크게 벗어난 경우(Outlier)만 예외 처리
  if (rawDistance < 2.0 || rawDistance > 40.0) {
    return previousDistance;
  }
  
  // 필터링 없이 원본 측정값을 그대로 사용
  previousDistance = rawDistance;
  return rawDistance;
}

// 스위치가 눌리지 않았을 때 시리얼 입력을 처리하는 함수
void processSerialCommand() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.length() > 0) {
      char cmd = input.charAt(0);
      cmd = toupper(cmd); // 소문자 입력시 대문자로 변환
      String valStr = input.substring(1);
      float val = valStr.toFloat();
      
      if (cmd == 'P') {
        Kp = val;
        Serial.print("Kp updated to: "); Serial.println(Kp);
      }
      else if (cmd == 'I') {
        Ki = val;
        Serial.print("Ki updated to: "); Serial.println(Ki);
      }
      else if (cmd == 'D') {
        Kd = val;
        Serial.print("Kd updated to: "); Serial.println(Kd);
      }
      else if (cmd == 'V' || cmd == '?') {
        Serial.print("Current PID -> Kp: "); Serial.print(Kp);
        Serial.print(" | Ki: "); Serial.print(Ki);
        Serial.print(" | Kd: "); Serial.print(Kd);
        Serial.print(" | Trim(centerAngle): "); Serial.println(centerAngle);
      }
      else if (cmd == 'T') {
        centerAngle = val;
        Serial.print("Center Angle updated to: "); Serial.println(centerAngle);
        myServo.write(centerAngle); // 변경된 수평 각도 즉시 적용
      }
      else if (cmd == 'C' || cmd == 'M') {
        float dist = getFilteredDistance();
        Serial.print("Current Distance (Filtered): ");
        if (dist > 0) {
          Serial.print(dist); Serial.println(" cm");
        } else {
          Serial.println("Error reading sensor or out of range.");
        }
      }
      else {
        Serial.println("Unknown command. Use P[val], I[val], D[val], T[val], V, C");
      }
    }
  }
}

// 토글 버튼 상태 저장을 위한 변수
bool systemActive = false;
int lastButtonState = HIGH;
int buttonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

void loop() {
  int reading = digitalRead(switchPin);
  
  // 1. 버튼 디바운싱 (기계적 스위치 떨림 방지)
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  
  if ((millis() - lastDebounceTime) > debounceDelay) {
    // 상태가 안정화되었을 때 확인
    if (reading != buttonState) {
      buttonState = reading;
      
      // 버튼이 눌렸을 때 (HIGH -> LOW)
      if (buttonState == LOW) {
        systemActive = !systemActive; // 상태 반전 (토글)
        if (systemActive) {
          Serial.println("System ON: PID Started");
          previousTime = millis(); // 시작 시간 리셋
        } else {
          Serial.println("System OFF: PID Stopped");
        }
      }
    }
  }
  lastButtonState = reading; // 다음 루프를 위해 상태 저장
  
  // 2. 시스템 상태(systemActive)에 따른 동작 수행
  if (!systemActive) {
    // [OFF 상태]
    myServo.write(centerAngle); // 설정된 수평 각도 유지
    
    // PID 제어 관련 변수 초기화
    integral = 0;
    previousError = 0;
    previousTime = millis(); // 타이머가 계속 갱신되게 유지
    
    // 시리얼 통신 처리
    processSerialCommand();
  }
  else {
    // [ON 상태]
    unsigned long currentTime = millis();
    float dt = (currentTime - previousTime) / 1000.0; // dt를 초 단위로 계산
    
    // 20ms 이상의 주기로 PID 루프 실행 (약 50Hz)
    if (dt >= 0.02) { 
      float distance = getFilteredDistance();
      
      // 유효한 측정값이고 허용 범위(5cm ~ 25cm 사이) 내에 있을 때만 처리
      if (distance >= 4.0 && distance <= 22.0) { 
        // 오차 계산
        float error = setPoint - distance;
        
        // PID 계산
        float proportional = Kp * error;
        integral = integral + error * dt;
        float derivative = (error - previousError) / dt;
        
        float output = proportional + (Ki * integral) + (Kd * derivative);
        
        // 서보 모터 각도로 매핑
        int angle = centerAngle - output; 
        
        // 안전 범위 제한 (80도 ~ 100도)
        angle = constrain(angle, 80, 100);
        
        // 서보 모터 동작
        myServo.write(angle);
        
        // 현재 상태 출력 (거리 및 각도)
        Serial.print("Dist: ");
        Serial.print(distance);
        Serial.print(" cm | Angle: ");
        Serial.println(angle);
        
        // 상태 저장
        previousError = error;
      }
      previousTime = currentTime;
    }
  }
}
