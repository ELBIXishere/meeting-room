<template>
  <div class="chatbot-pip-wrapper">
    <!-- 플로팅 버튼 -->
    <div
      class="floating-button"
      :class="{ 'is-open': isOpen, 'is-dragging': isDragging }"
      :style="floatingStyle"
      @mousedown="startDrag"
      @touchstart="startDrag"
      @click="handleClick"
    >
      <div class="button-content">
        <span class="bot-icon">🤖</span>
        <span class="pulse-ring" v-if="!isOpen"></span>
      </div>
      <div class="close-icon" v-if="isOpen">✕</div>
    </div>

    <!-- PIP 채팅창 -->
    <Transition name="pip-slide">
      <div
        v-if="isOpen"
        class="pip-chat-container"
        :style="pipStyle"
      >
        <div class="pip-header" @mousedown="startPipDrag" @touchstart="startPipDrag">
          <div class="pip-header-content">
            <span class="pip-icon">🤖</span>
            <div class="pip-title">
              <h3>AI 예약 비서</h3>
              <span class="pip-status">온라인</span>
            </div>
          </div>
          <div class="pip-actions">
            <button class="pip-btn" @click="clearChat" title="대화 초기화">🗑️</button>
            <button class="pip-btn" @click="isOpen = false" title="닫기">✕</button>
          </div>
        </div>

        <div class="pip-messages" ref="messagesContainer">
          <!-- 웰컴 메시지 -->
          <div class="message bot-message" v-if="messages.length === 0">
            <div class="message-bubble">
              <p>안녕하세요! 👋</p>
              <p>회의실 예약을 도와드릴게요.</p>
              <div class="quick-actions">
                <button @click="sendQuickMessage('이번 주 예약 현황 알려줘')">📅 이번 주 현황</button>
                <button @click="sendQuickMessage('가장 큰 회의실 알려줘')">🏢 큰 회의실</button>
                <button @click="sendQuickMessage('내일 오후에 10명 회의실 있어?')">👥 회의실 찾기</button>
              </div>
            </div>
          </div>

          <!-- 채팅 메시지 -->
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['message', msg.role === 'user' ? 'user-message' : 'bot-message']"
          >
            <div class="message-bubble">
              <div class="message-text" v-html="formatMessage(msg.content)"></div>
            </div>
            <span class="message-time">{{ msg.time }}</span>
          </div>

          <!-- 로딩 -->
          <div class="message bot-message" v-if="isLoading">
            <div class="message-bubble loading">
              <div class="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <form class="pip-input" @submit.prevent="sendMessage">
          <input
            v-model="inputMessage"
            type="text"
            placeholder="메시지 입력..."
            :disabled="isLoading"
            ref="inputRef"
          />
          <button type="submit" :disabled="isLoading || !inputMessage.trim()">
            <span>➤</span>
          </button>
        </form>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

// 상태
const isOpen = ref(false)
const isDragging = ref(false)
const isPipDragging = ref(false)
const messages = ref([])
const inputMessage = ref('')
const isLoading = ref(false)
const conversationHistory = ref([])
const messagesContainer = ref(null)
const inputRef = ref(null)

// 플로팅 버튼 위치
const buttonPosition = ref({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
const pipPosition = ref({ x: window.innerWidth - 420, y: window.innerHeight - 580 })

// 드래그 관련
const dragOffset = ref({ x: 0, y: 0 })
const hasMoved = ref(false)

const floatingStyle = computed(() => ({
  left: `${buttonPosition.value.x}px`,
  top: `${buttonPosition.value.y}px`,
}))

const pipStyle = computed(() => ({
  left: `${pipPosition.value.x}px`,
  top: `${pipPosition.value.y}px`,
}))

// 플로팅 버튼 드래그
const startDrag = (e) => {
  if (isOpen.value) return
  
  isDragging.value = true
  hasMoved.value = false
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  dragOffset.value = {
    x: clientX - buttonPosition.value.x,
    y: clientY - buttonPosition.value.y,
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag)
  document.addEventListener('touchend', stopDrag)
}

const onDrag = (e) => {
  if (!isDragging.value) return
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  const newX = clientX - dragOffset.value.x
  const newY = clientY - dragOffset.value.y
  
  if (Math.abs(newX - buttonPosition.value.x) > 5 || Math.abs(newY - buttonPosition.value.y) > 5) {
    hasMoved.value = true
  }
  
  buttonPosition.value = {
    x: Math.max(0, Math.min(window.innerWidth - 60, newX)),
    y: Math.max(0, Math.min(window.innerHeight - 60, newY)),
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
}

// PIP 창 드래그
const startPipDrag = (e) => {
  isPipDragging.value = true
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  dragOffset.value = {
    x: clientX - pipPosition.value.x,
    y: clientY - pipPosition.value.y,
  }
  
  document.addEventListener('mousemove', onPipDrag)
  document.addEventListener('mouseup', stopPipDrag)
  document.addEventListener('touchmove', onPipDrag)
  document.addEventListener('touchend', stopPipDrag)
}

const onPipDrag = (e) => {
  if (!isPipDragging.value) return
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  pipPosition.value = {
    x: Math.max(0, Math.min(window.innerWidth - 380, clientX - dragOffset.value.x)),
    y: Math.max(0, Math.min(window.innerHeight - 500, clientY - dragOffset.value.y)),
  }
}

const stopPipDrag = () => {
  isPipDragging.value = false
  document.removeEventListener('mousemove', onPipDrag)
  document.removeEventListener('mouseup', stopPipDrag)
  document.removeEventListener('touchmove', onPipDrag)
  document.removeEventListener('touchend', stopPipDrag)
}

// 클릭 핸들러
const handleClick = () => {
  if (!hasMoved.value) {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
      nextTick(() => {
        inputRef.value?.focus()
        scrollToBottom()
      })
    }
  }
}

// 메시지 포맷팅
const formatMessage = (text) => {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/- (.*?)(?=<br>|$)/g, '• $1')
}

// 시간 포맷
const getCurrentTime = () => {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

// 스크롤
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

  messages.value.push({
    role: 'user',
    content: userMessage,
    time: getCurrentTime()
  })

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

    messages.value.push({
      role: 'assistant',
      content: botReply,
      time: getCurrentTime()
    })

    conversationHistory.value.push({
      role: 'assistant',
      content: botReply
    })
  } catch (error) {
    console.error('Chatbot error:', error)
    messages.value.push({
      role: 'assistant',
      content: '죄송합니다. 오류가 발생했습니다. ' + (error.response?.data?.error || '다시 시도해주세요.'),
      time: getCurrentTime()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

// 빠른 메시지
const sendQuickMessage = (message) => {
  inputMessage.value = message
  sendMessage()
}

// 대화 초기화
const clearChat = () => {
  messages.value = []
  conversationHistory.value = []
}

// 윈도우 리사이즈 대응
const handleResize = () => {
  buttonPosition.value = {
    x: Math.min(buttonPosition.value.x, window.innerWidth - 60),
    y: Math.min(buttonPosition.value.y, window.innerHeight - 60),
  }
  pipPosition.value = {
    x: Math.min(pipPosition.value.x, window.innerWidth - 380),
    y: Math.min(pipPosition.value.y, window.innerHeight - 500),
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.chatbot-pip-wrapper {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
}

/* 플로팅 버튼 */
.floating-button {
  position: fixed;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.5);
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  user-select: none;
  touch-action: none;
}

.floating-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 30px rgba(99, 102, 241, 0.6);
}

.floating-button.is-dragging {
  cursor: grabbing;
  transform: scale(1.15);
}

.floating-button.is-open {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5);
}

.button-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bot-icon {
  font-size: 1.8rem;
  animation: float 3s ease-in-out infinite;
}

.is-open .bot-icon {
  display: none;
}

.close-icon {
  font-size: 1.5rem;
  color: white;
  font-weight: bold;
}

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(99, 102, 241, 0.5);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.8); opacity: 0; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* PIP 채팅창 */
.pip-chat-container {
  position: fixed;
  width: 380px;
  height: 500px;
  background: rgba(15, 23, 42, 0.98);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
  backdrop-filter: blur(20px);
}

.pip-header {
  padding: 1rem;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
}

.pip-header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pip-icon {
  font-size: 1.8rem;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  width: 45px;
  height: 45px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pip-title h3 {
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.pip-status {
  font-size: 0.75rem;
  color: #4ade80;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.pip-status::before {
  content: '';
  width: 6px;
  height: 6px;
  background: #4ade80;
  border-radius: 50%;
  animation: blink 2s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.pip-actions {
  display: flex;
  gap: 0.5rem;
}

.pip-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.pip-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* 메시지 영역 */
.pip-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pip-messages::-webkit-scrollbar {
  width: 4px;
}

.pip-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  animation: messageIn 0.3s ease;
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-message {
  align-self: flex-end;
}

.bot-message {
  align-self: flex-start;
}

.message-bubble {
  padding: 0.75rem 1rem;
  border-radius: 16px;
  font-size: 0.9rem;
  line-height: 1.5;
}

.user-message .message-bubble {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  color: #fff;
  border-radius: 16px 16px 4px 16px;
}

.bot-message .message-bubble {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 16px 16px 16px 4px;
}

.message-time {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.25rem;
  padding: 0 0.5rem;
}

.user-message .message-time {
  text-align: right;
}

/* 빠른 액션 버튼 */
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.quick-actions button {
  background: rgba(99, 102, 241, 0.3);
  border: 1px solid rgba(99, 102, 241, 0.4);
  color: #fff;
  padding: 0.5rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-actions button:hover {
  background: rgba(99, 102, 241, 0.5);
  transform: translateY(-1px);
}

/* 로딩 */
.typing-dots {
  display: flex;
  gap: 4px;
  padding: 0.25rem 0;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* 입력 영역 */
.pip-input {
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 0.5rem;
}

.pip-input input {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  padding: 0.75rem 1rem;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s;
}

.pip-input input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.pip-input input:focus {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(255, 255, 255, 0.15);
}

.pip-input button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.pip-input button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
}

.pip-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 트랜지션 */
.pip-slide-enter-active,
.pip-slide-leave-active {
  transition: all 0.3s ease;
}

.pip-slide-enter-from,
.pip-slide-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

/* 반응형 */
@media (max-width: 480px) {
  .pip-chat-container {
    width: calc(100vw - 20px);
    height: calc(100vh - 100px);
    left: 10px !important;
    top: 10px !important;
  }
}
</style>


