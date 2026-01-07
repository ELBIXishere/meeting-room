<template>
  <div class="chatbot-page">
    <div class="chat-container">
      <header class="chat-header">
        <div class="header-content">
          <div class="bot-avatar">🤖</div>
          <div class="header-text">
            <h1>회의실 예약 AI 비서</h1>
            <p class="subtitle">자연어로 회의실을 검색하고 예약하세요</p>
          </div>
        </div>
        <div class="quick-info" v-if="quickInfo">
          <span class="info-badge">📅 {{ quickInfo.weekInfo?.today }}</span>
          <span class="info-badge">🏢 {{ quickInfo.rooms?.length }}개 회의실</span>
        </div>
      </header>

      <div class="messages-container" ref="messagesContainer">
        <div class="message bot-message welcome" v-if="messages.length === 0">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <p>안녕하세요! 회의실 예약을 도와드리는 AI 비서입니다.</p>
            <p>아래와 같이 말씀해 주세요:</p>
            <ul class="suggestions">
              <li @click="sendQuickMessage('이번 주에 20명이 사용할 수 있는 회의실 알려줘')">
                "이번 주에 20명이 사용할 수 있는 회의실 알려줘"
              </li>
              <li @click="sendQuickMessage('내일 오후 2시부터 4시까지 회의실 예약하고 싶어')">
                "내일 오후 2시부터 4시까지 회의실 예약하고 싶어"
              </li>
              <li @click="sendQuickMessage('이번 주 전체 예약 현황 보여줘')">
                "이번 주 전체 예약 현황 보여줘"
              </li>
              <li @click="sendQuickMessage('가장 큰 회의실은 어디야?')">
                "가장 큰 회의실은 어디야?"
              </li>
            </ul>
          </div>
        </div>

        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          :class="['message', msg.role === 'user' ? 'user-message' : 'bot-message']"
        >
          <div class="message-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
          <div class="message-content">
            <div class="message-text" v-html="formatMessage(msg.content)"></div>
            <div class="message-time">{{ msg.time }}</div>
          </div>
        </div>

        <div class="message bot-message loading" v-if="isLoading">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <form class="input-container" @submit.prevent="sendMessage">
        <input
          v-model="inputMessage"
          type="text"
          placeholder="메시지를 입력하세요... (예: 이번 주 금요일에 10명 회의실 예약해줘)"
          :disabled="isLoading"
          class="chat-input"
        />
        <button type="submit" class="send-button" :disabled="isLoading || !inputMessage.trim()">
          <span v-if="!isLoading">전송</span>
          <span v-else>...</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const messages = ref([])
const inputMessage = ref('')
const isLoading = ref(false)
const messagesContainer = ref(null)
const quickInfo = ref(null)
const conversationHistory = ref([])

// 빠른 정보 로드
const loadQuickInfo = async () => {
  try {
    api.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`
    const response = await api.get('/api/chatbot/quick-info')
    quickInfo.value = response.data
  } catch (error) {
    console.error('Quick info load error:', error)
  }
}

// 메시지 포맷팅 (마크다운 기본 변환)
const formatMessage = (text) => {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/- (.*?)(?=<br>|$)/g, '• $1')
}

// 현재 시간 포맷
const getCurrentTime = () => {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

// 스크롤 최하단으로
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 메시지 전송
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return

  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''

  // 사용자 메시지 추가
  messages.value.push({
    role: 'user',
    content: userMessage,
    time: getCurrentTime()
  })

  // 대화 히스토리에 추가
  conversationHistory.value.push({
    role: 'user',
    content: userMessage
  })

  scrollToBottom()
  isLoading.value = true

  try {
    api.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`
    const response = await api.post('/api/chatbot', {
      message: userMessage,
      conversationHistory: conversationHistory.value
    })

    const botReply = response.data.reply

    // 봇 응답 추가
    messages.value.push({
      role: 'assistant',
      content: botReply,
      time: getCurrentTime()
    })

    // 대화 히스토리에 추가
    conversationHistory.value.push({
      role: 'assistant',
      content: botReply
    })

    // 예약이 생성된 경우 빠른 정보 새로고침
    if (response.data.functionCalled === 'create_reservation' && response.data.functionResult?.success) {
      loadQuickInfo()
    }

  } catch (error) {
    console.error('Chatbot error:', error)
    messages.value.push({
      role: 'assistant',
      content: '죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요. ' + 
        (error.response?.data?.error || ''),
      time: getCurrentTime()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

// 빠른 메시지 전송
const sendQuickMessage = (message) => {
  inputMessage.value = message
  sendMessage()
}

onMounted(() => {
  loadQuickInfo()
})
</script>

<style scoped>
.chatbot-page {
  min-height: calc(100vh - 60px);
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.chat-container {
  width: 100%;
  max-width: 900px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.chat-header {
  padding: 1.5rem 2rem;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bot-avatar {
  font-size: 2.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.5);
}

.header-text h1 {
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
}

.subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin: 0.25rem 0 0 0;
}

.quick-info {
  display: flex;
  gap: 0.5rem;
}

.info-badge {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.message {
  display: flex;
  gap: 0.75rem;
  max-width: 85%;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.bot-message {
  align-self: flex-start;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.user-message .message-avatar {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
}

.bot-message .message-avatar {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
}

.message-content {
  background: rgba(255, 255, 255, 0.08);
  padding: 1rem 1.25rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.user-message .message-content {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 18px 18px 4px 18px;
}

.bot-message .message-content {
  border-radius: 18px 18px 18px 4px;
}

.message-text {
  color: #fff;
  font-size: 0.95rem;
  line-height: 1.6;
}

.message-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.75rem;
  margin-top: 0.5rem;
  text-align: right;
}

.welcome .message-content {
  max-width: 100%;
}

.welcome p {
  margin: 0.5rem 0;
  color: #fff;
}

.suggestions {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.suggestions li {
  background: rgba(99, 102, 241, 0.3);
  padding: 0.75rem 1rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
}

.suggestions li:hover {
  background: rgba(99, 102, 241, 0.5);
  border-color: rgba(99, 102, 241, 0.6);
  transform: translateX(5px);
}

.typing-indicator {
  display: flex;
  gap: 0.3rem;
  padding: 0.5rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1.2); opacity: 1; }
}

.input-container {
  padding: 1.25rem 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 0.75rem;
}

.chat-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  padding: 1rem 1.25rem;
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.chat-input:focus {
  border-color: rgba(99, 102, 241, 0.6);
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
}

.send-button {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  border: none;
  border-radius: 16px;
  padding: 1rem 2rem;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.send-button:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 0 25px rgba(99, 102, 241, 0.5);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .chatbot-page {
    padding: 0.5rem;
  }

  .chat-container {
    border-radius: 16px;
    height: calc(100vh - 80px);
  }

  .chat-header {
    padding: 1rem;
    flex-direction: column;
    align-items: flex-start;
  }

  .bot-avatar {
    width: 45px;
    height: 45px;
    font-size: 1.5rem;
  }

  .header-text h1 {
    font-size: 1.2rem;
  }

  .message {
    max-width: 90%;
  }

  .suggestions li {
    font-size: 0.85rem;
  }

  .input-container {
    padding: 1rem;
  }

  .send-button {
    padding: 1rem 1.25rem;
    min-width: auto;
  }
}
</style>


