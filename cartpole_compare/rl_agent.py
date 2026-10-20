import gymnasium as gym
import numpy as np
import pickle
import os
import math

class QLearningAgent:
    def __init__(self, action_space, bins=(1, 1, 6, 12)):
        self.action_space = action_space
        self.bins = bins
        # 연속적인 상태 공간을 구간(bin)으로 나누어 이산화합니다.
        # [카트 위치, 카트 속도, 막대 각도, 막대 각속도]
        
        # CartPole-v1의 물리적 한계치 설정
        self.upper_bounds = [4.8, 0.5, 0.418, math.radians(50)]
        self.lower_bounds = [-4.8, -0.5, -0.418, -math.radians(50)]
        
        self.q_table = np.zeros(self.bins + (self.action_space.n,))
        
        # 하이퍼파라미터
        self.learning_rate = 0.1
        self.gamma = 0.99
        self.epsilon = 1.0 # 탐험 확률
        self.epsilon_min = 0.01
        self.epsilon_decay = 0.995

    def discretize(self, state):
        ratios = [(state[i] + abs(self.lower_bounds[i])) / (self.upper_bounds[i] - self.lower_bounds[i]) for i in range(len(state))]
        new_state = [int(round((self.bins[i] - 1) * ratios[i])) for i in range(len(state))]
        new_state = [min(self.bins[i] - 1, max(0, new_state[i])) for i in range(len(state))]
        return tuple(new_state)

    def act(self, state, explore=True):
        # epsilon-greedy 정책
        if explore and np.random.rand() <= self.epsilon:
            return self.action_space.sample()
        return np.argmax(self.q_table[state])

    def learn(self, state, action, reward, next_state, done):
        best_next_action = np.argmax(self.q_table[next_state])
        td_target = reward + self.gamma * self.q_table[next_state][best_next_action] * (not done)
        td_error = td_target - self.q_table[state][action]
        
        # Q-value 갱신
        self.q_table[state][action] += self.learning_rate * td_error
        
        if done and self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

    def save(self, filepath):
        with open(filepath, 'wb') as f:
            pickle.dump(self.q_table, f)
            
    def load(self, filepath):
        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                self.q_table = pickle.load(f)
            self.epsilon = self.epsilon_min # 평가 모드를 위해 탐험 최소화
            return True
        return False

def train_rl(episodes=1000):
    env = gym.make("CartPole-v1")
    agent = QLearningAgent(env.action_space)
    
    print("Training Q-Learning Agent...")
    for ep in range(episodes):
        state, _ = env.reset()
        state = agent.discretize(state)
        score = 0
        done = False
        
        while not done:
            action = agent.act(state)
            next_state_raw, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            next_state = agent.discretize(next_state_raw)
            
            # 막대가 넘어지면 패널티 부여 (학습 가속화)
            if done and score < 499: 
                reward = -10
                
            agent.learn(state, action, reward, next_state, done)
            state = next_state
            score += 1
            
        if (ep + 1) % 100 == 0:
            print(f"Episode {ep+1}/{episodes} - Score: {score} - Epsilon: {agent.epsilon:.3f}")
            
    agent.save("q_table.pkl")
    print("Training finished and model saved to q_table.pkl")
    env.close()

if __name__ == "__main__":
    # rl_agent.py를 직접 실행하면 학습을 시작합니다.
    train_rl(episodes=1500)
