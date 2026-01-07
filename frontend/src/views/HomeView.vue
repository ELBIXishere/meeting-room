<template>
  <div class="home-page">
    <div class="container">
      <div class="page-header">
        <div class="header-content">
          <div>
            <h1 class="page-title">회의실 예약</h1>
            <p class="page-subtitle">날짜를 선택하고 원하는 시간대를 클릭하여 예약하세요</p>
          </div>
          <div class="date-picker">
            <button class="date-nav" @click="changeDate(-1)">◀</button>
            <input
              type="date"
              v-model="selectedDate"
              class="form-input date-input"
              :min="today"
            />
            <button class="date-nav" @click="changeDate(1)">▶</button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-container">
        <div class="spinner"></div>
      </div>

      <div v-else-if="rooms.length === 0" class="empty-state card">
        <div class="empty-state-icon">🏢</div>
        <h3>등록된 회의실이 없습니다</h3>
        <p>먼저 회의실을 등록해주세요</p>
        <router-link to="/rooms" class="btn btn-primary">
          회의실 등록하러 가기
        </router-link>
      </div>

      <div v-else class="schedule-section">
        <div class="schedule-header">
          <h2 class="schedule-title">{{ formatDateKorean(selectedDate) }} 예약 현황</h2>
          <div class="schedule-legend">
            <span class="legend-item"><span class="legend-dot available"></span> 예약 가능</span>
            <span class="legend-item"><span class="legend-dot reserved"></span> 예약됨</span>
            <span class="legend-item"><span class="legend-dot selected"></span> 선택됨</span>
          </div>
        </div>

        <!-- Block Table View -->
        <div class="schedule-table-wrapper">
          <table class="schedule-table">
            <thead>
              <tr>
                <th class="time-header">시간</th>
                <th v-for="room in rooms" :key="room.id" class="room-header">
                  <div class="room-header-content">
                    <span class="room-icon">🏠</span>
                    <span class="room-name">{{ room.name }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="time in timeSlots" :key="time">
                <td class="time-cell">{{ time }}</td>
                <td
                  v-for="room in rooms"
                  :key="`${room.id}-${time}`"
                  class="slot-cell"
                  :class="getSlotClass(room.id, time)"
                  @click="handleSlotClick(room.id, time)"
                >
                  <div v-if="getReservation(room.id, time)" class="reservation-info">
                    <span class="reservation-user">{{ getReservation(room.id, time).username }}</span>
                    <span class="reservation-time-range" v-if="isReservationStart(room.id, time)">
                      {{ formatTimeRange(getReservation(room.id, time)) }}
                    </span>
                  </div>
                  <div v-else-if="isSelected(room.id, time)" class="selected-indicator">
                    ✓
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Selection Summary -->
        <div v-if="selectedSlots.length > 0" class="selection-summary card">
          <div class="summary-content">
            <div class="summary-info">
              <h3>선택된 예약</h3>
              <div class="summary-details">
                <span class="summary-room">🏠 {{ getSelectedRoomName() }}</span>
                <span class="summary-time">🕐 {{ formatSelectedTime() }}</span>
              </div>
            </div>
            <div class="summary-actions">
              <button class="btn btn-secondary" @click="clearSelection">취소</button>
              <button class="btn btn-primary" @click="handleReservation" :disabled="submitting">
                {{ submitting ? '예약 중...' : '예약하기' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccessModal" class="modal-overlay" @click.self="showSuccessModal = false">
      <div class="modal success-modal">
        <div class="success-icon">✅</div>
        <h2>예약 완료!</h2>
        <p>
          <strong>{{ getSelectedRoomName() }}</strong><br>
          {{ formatDateKorean(selectedDate) }}<br>
          {{ formatSelectedTime() }}
        </p>
        <button class="btn btn-primary" @click="closeSuccessModal">확인</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '../api'

const rooms = ref([])
const reservations = ref([])
const selectedDate = ref('')
const selectedSlots = ref([]) // [{roomId, time}]
const selectedRoomId = ref(null)
const loading = ref(true)
const submitting = ref(false)
const showSuccessModal = ref(false)

const today = computed(() => {
  const d = new Date()
  return d.toISOString().split('T')[0]
})

// Generate time slots from 09:00 to 18:00 (30 min intervals)
const timeSlots = computed(() => {
  const slots = []
  for (let hour = 9; hour < 18; hour++) {
    for (let min = 0; min < 60; min += 30) {
      slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
    }
  }
  return slots
})

const fetchRooms = async () => {
  try {
    const response = await api.get('/api/rooms')
    rooms.value = response.data
  } catch (err) {
    console.error('Failed to fetch rooms:', err)
  }
}

const fetchReservations = async () => {
  if (!selectedDate.value) return
  
  loading.value = true
  try {
    const response = await api.get('/api/reservations', {
      params: { date: selectedDate.value }
    })
    reservations.value = response.data
  } catch (err) {
    console.error('Failed to fetch reservations:', err)
  } finally {
    loading.value = false
  }
}

const getReservation = (roomId, time) => {
  return reservations.value.find(r => {
    if (r.room_id !== roomId) return false
    const startTime = r.start_time.substring(0, 5)
    const endTime = r.end_time.substring(0, 5)
    return time >= startTime && time < endTime
  })
}

const isReservationStart = (roomId, time) => {
  const reservation = getReservation(roomId, time)
  if (!reservation) return false
  return reservation.start_time.substring(0, 5) === time
}

const getSlotClass = (roomId, time) => {
  const reservation = getReservation(roomId, time)
  if (reservation) {
    const isStart = isReservationStart(roomId, time)
    return {
      'reserved': true,
      'reservation-start': isStart,
      'reservation-middle': !isStart
    }
  }
  if (isSelected(roomId, time)) {
    return { 'selected': true }
  }
  return { 'available': true }
}

const isSelected = (roomId, time) => {
  return selectedSlots.value.some(s => s.roomId === roomId && s.time === time)
}

const handleSlotClick = (roomId, time) => {
  const reservation = getReservation(roomId, time)
  if (reservation) return // 이미 예약된 슬롯은 클릭 불가

  // 다른 회의실 선택 시 기존 선택 초기화
  if (selectedRoomId.value && selectedRoomId.value !== roomId) {
    selectedSlots.value = []
  }
  selectedRoomId.value = roomId

  const index = selectedSlots.value.findIndex(s => s.roomId === roomId && s.time === time)
  if (index > -1) {
    selectedSlots.value.splice(index, 1)
    if (selectedSlots.value.length === 0) {
      selectedRoomId.value = null
    }
  } else {
    selectedSlots.value.push({ roomId, time })
  }
  
  // 시간순 정렬
  selectedSlots.value.sort((a, b) => a.time.localeCompare(b.time))
}

const clearSelection = () => {
  selectedSlots.value = []
  selectedRoomId.value = null
}

const getSelectedRoomName = () => {
  if (!selectedRoomId.value) return ''
  const room = rooms.value.find(r => r.id === selectedRoomId.value)
  return room?.name || ''
}

const formatSelectedTime = () => {
  if (selectedSlots.value.length === 0) return ''
  
  const times = selectedSlots.value.map(s => s.time).sort()
  const start = times[0]
  
  const lastTime = times[times.length - 1]
  const [h, m] = lastTime.split(':').map(Number)
  const endMinutes = h * 60 + m + 30
  const endHour = Math.floor(endMinutes / 60)
  const endMin = endMinutes % 60
  const end = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
  
  return `${start} ~ ${end}`
}

const formatTimeRange = (reservation) => {
  const start = reservation.start_time.substring(0, 5)
  const end = reservation.end_time.substring(0, 5)
  return `${start}~${end}`
}

const handleReservation = async () => {
  if (selectedSlots.value.length === 0) return

  const times = selectedSlots.value.map(s => s.time).sort()
  const startTime = times[0]
  
  const lastTime = times[times.length - 1]
  const [h, m] = lastTime.split(':').map(Number)
  const endMinutes = h * 60 + m + 30
  const endHour = Math.floor(endMinutes / 60)
  const endMin = endMinutes % 60
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`

  submitting.value = true
  try {
    await api.post('/api/reservations', {
      room_id: selectedRoomId.value,
      reservation_date: selectedDate.value,
      start_time: startTime,
      end_time: endTime
    })
    showSuccessModal.value = true
  } catch (err) {
    alert(err.response?.data?.error || '예약에 실패했습니다.')
  } finally {
    submitting.value = false
  }
}

const closeSuccessModal = () => {
  showSuccessModal.value = false
  clearSelection()
  fetchReservations()
}

const changeDate = (days) => {
  const current = new Date(selectedDate.value)
  current.setDate(current.getDate() + days)
  const newDate = current.toISOString().split('T')[0]
  if (newDate >= today.value) {
    selectedDate.value = newDate
  }
}

const formatDateKorean = (dateString) => {
  const date = new Date(dateString)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`
}

watch(selectedDate, () => {
  clearSelection()
  fetchReservations()
})

onMounted(async () => {
  selectedDate.value = today.value
  await fetchRooms()
  await fetchReservations()
})
</script>

<style scoped>
.home-page {
  padding-bottom: 3rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-nav {
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.date-nav:hover {
  background: var(--bg-input);
  border-color: var(--primary);
}

.date-input {
  width: auto;
  text-align: center;
  font-weight: 500;
}

.schedule-section {
  margin-top: 1rem;
}

.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.schedule-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.schedule-legend {
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
}

.legend-dot.available {
  background: var(--bg-input);
  border: 1px solid var(--border);
}

.legend-dot.reserved {
  background: var(--primary-light);
  border: 1px solid var(--primary);
}

.legend-dot.selected {
  background: var(--success);
}

/* Schedule Table */
.schedule-table-wrapper {
  overflow-x: auto;
  border-radius: 1rem;
  border: 1px solid var(--border);
  background: var(--bg-card);
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.schedule-table th,
.schedule-table td {
  border: 1px solid var(--border);
  padding: 0;
}

.time-header {
  width: 80px;
  min-width: 80px;
  background: var(--bg-input);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-secondary);
  padding: 1rem 0.5rem;
  position: sticky;
  left: 0;
  z-index: 1;
}

.room-header {
  min-width: 140px;
  background: var(--bg-input);
  padding: 0.75rem;
}

.room-header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.room-icon {
  font-size: 1.5rem;
}

.room-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
  text-align: center;
}

.time-cell {
  background: var(--bg-input);
  font-weight: 500;
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 0.5rem;
  position: sticky;
  left: 0;
  z-index: 1;
}

.slot-cell {
  height: 48px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  vertical-align: top;
}

.slot-cell.available {
  background: var(--bg-card);
}

.slot-cell.available:hover {
  background: var(--primary-light);
}

.slot-cell.reserved {
  background: var(--primary-light);
  cursor: default;
}

.slot-cell.reservation-start {
  border-top: 2px solid var(--primary);
}

.slot-cell.selected {
  background: var(--success);
}

.reservation-info {
  padding: 0.25rem 0.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.reservation-user {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reservation-time-range {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.selected-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
  font-weight: bold;
  font-size: 1.2rem;
}

/* Selection Summary */
.selection-summary {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 3rem);
  max-width: 600px;
  z-index: 100;
  box-shadow: var(--shadow-lg);
  border: 2px solid var(--primary);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.summary-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.summary-info h3 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.summary-details {
  display: flex;
  gap: 1.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.summary-room, .summary-time {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-actions {
  display: flex;
  gap: 0.75rem;
}

/* Success Modal */
.success-modal {
  text-align: center;
  padding: 3rem 2rem;
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.success-modal h2 {
  margin-bottom: 1rem;
  color: var(--success);
}

.success-modal p {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  line-height: 1.8;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-state h3 {
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.empty-state p {
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .schedule-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .summary-content {
    flex-direction: column;
    text-align: center;
  }
  
  .summary-details {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
