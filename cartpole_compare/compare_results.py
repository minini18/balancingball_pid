import gymnasium as gym
import numpy as np
import matplotlib.pyplot as plt
from pid_agent import pid_controller
from rl_agent import QLearningAgent

def evaluate_pid(episodes=100):
    env = gym.make("CartPole-v1")
    scores = []
    for _ in range(episodes):
        state, _ = env.reset()
        score = 0
        done = False
        while not done:
            action = pid_controller(state)
            state, _, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            score += 1
        scores.append(score)
    env.close()
    return scores

def evaluate_rl(episodes=100):
    env = gym.make("CartPole-v1")
    agent = QLearningAgent(env.action_space)
    
    if not agent.load("q_table.pkl"):
        print("Model not found! Please run 'python rl_agent.py' first to train the model.")
        return [0] * episodes
        
    scores = []
    for _ in range(episodes):
        state, _ = env.reset()
        state = agent.discretize(state)
        score = 0
        done = False
        while not done:
            action = agent.act(state, explore=False) # 학습 완료 후 평가(Greedy)
            next_state, _, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            state = agent.discretize(next_state)
            score += 1
        scores.append(score)
    env.close()
    return scores

if __name__ == "__main__":
    test_episodes = 100
    print(f"--- 성능 평가 시작 (각 {test_episodes}회 테스트) ---")
    
    print("Evaluating PID Agent...")
    pid_scores = evaluate_pid(test_episodes)
    
    print("Evaluating RL Agent (Q-Learning)...")
    rl_scores = evaluate_rl(test_episodes)
    
    # 통계 출력
    print("\n--- 결과 요약 ---")
    print(f"PID 제어기 평균 버틴 시간: {np.mean(pid_scores):.2f} 프레임 (최고: {np.max(pid_scores)})")
    print(f"RL  제어기 평균 버틴 시간: {np.mean(rl_scores):.2f} 프레임 (최고: {np.max(rl_scores)})")
    
    # 그래프 시각화
    plt.figure(figsize=(10, 6))
    
    plt.hist(pid_scores, alpha=0.6, bins=20, label=f'PID (Avg: {np.mean(pid_scores):.1f})', color='#3b82f6')
    plt.hist(rl_scores, alpha=0.6, bins=20, label=f'RL (Avg: {np.mean(rl_scores):.1f})', color='#f97316')
    
    plt.title('Performance Comparison: PID vs Q-Learning on CartPole-v1')
    plt.xlabel('Score (Frames Survived - Max 500)')
    plt.ylabel('Frequency (out of 100 episodes)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.savefig('comparison_result.png', dpi=150)
    print("\n비교 그래프가 'comparison_result.png' 파일로 저장되었습니다.")
    # plt.show()
