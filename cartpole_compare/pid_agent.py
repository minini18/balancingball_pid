import gymnasium as gym

def pid_controller(state):
    """
    state: [cart_position, cart_velocity, pole_angle, pole_angular_velocity]
    """
    # PID Constants (튜닝된 값)
    Kp = 10.0
    Ki = 0.0
    Kd = 1.0

    cart_pos, cart_vel, pole_angle, pole_vel = state

    # 메인 목표는 막대의 각도(pole_angle)를 0으로 유지하는 것
    error = pole_angle
    derivative = pole_vel
    
    # 제어량 계산 (P + D)
    output = (Kp * error) + (Kd * derivative)
    
    # 행동(Action) 공간이 0(왼쪽으로 힘 가함), 1(오른쪽으로 힘 가함) 뿐이므로 임계값 적용
    return 1 if output > 0 else 0

def run_pid(render=True, episodes=1):
    env_mode = "human" if render else None
    env = gym.make("CartPole-v1", render_mode=env_mode)
    
    scores = []
    
    for ep in range(episodes):
        state, _ = env.reset()
        score = 0
        terminated = False
        truncated = False
        
        while not (terminated or truncated):
            action = pid_controller(state)
            state, reward, terminated, truncated, _ = env.step(action)
            score += reward
            
        scores.append(score)
        print(f"PID Episode {ep+1}: Score = {score}")
        
    env.close()
    return scores

if __name__ == "__main__":
    print("Running PID Agent on CartPole...")
    # 렌더링 화면을 보여주며 3에피소드 진행
    run_pid(render=True, episodes=3)
