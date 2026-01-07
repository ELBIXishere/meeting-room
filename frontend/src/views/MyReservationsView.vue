<template>
  <div class="my-reservations-page">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">내 예약</h1>
        <p class="page-subtitle">예약한 회의실 목록을 확인하고 관리하세요</p>
      </div>

      <div v-if="loading" class="loading-container">
        <div class="spinner"></div>
      </div>

      <div v-else-if="reservations.length === 0" class="empty-state card">
        <div class="empty-state-icon">📭</div>
        <h3>예약 내역이 없습니다</h3>
        <p>새로운 회의실을 예약해보세요</p>
        <router-link to="/" class="btn btn-primary">
          예약하러 가기
        </router-link>
      </div>

      <div v-else>
        <div class="tabs">
          <button
            class="tab"
            :class="{ active: activeTab === 'upcoming' }"
            @click="activeTab = 'upcoming'"
          >
            예정된 예약 ({{ upcomingReservations.length }})
          </button>
          <button
            class="tab"
            :class="{ active: activeTab === 'past' }"
            @click="activeTab = 'past'"
          >
            지난 예약 ({{ pastReservations.length }})
          </button>
        </div>

        <div class="reservations-list">
          <div
            v-for="reservation in displayedReservations"
            :key="reservation.id"
            class="reservation-card card"
            :class="{ 'past': isPast(reservation) }"
          >
            <div class="reservation-main">
              <div class="reservation-icon">🏢</div>
              <div class="reservation-info">
                <h3 class="reservation-room">{{ reservation.room_name }}</h3>
                <div class="reservation-datetime">
                  <span class="reservation-date">{{ formatDate(reservation.reservation_date) }}</span>
                  <span class="reservation-time">{{ formatTime(reservation.start_time) }} ~ {{ formatTime(reservation.end_time) }}</span>
                </div>
              </div>
              <div class="reservation-badge" :class="isPast(reservation) ? 'past' : 'upcoming'">
                {{ isPast(reservation) ? '완료' : getDaysUntil(reservation.reservation_date) }}
              </div>
            </div>
            <div class="reservation-actions" v-if="!isPast(reservation)">
              <button class="btn btn-danger btn-sm" @click="confirmCancel(reservation)">
                예약 취소
              </button>
            </div>
          </div>
        </div>

        <div v-if="displayedReservations.length === 0" class="empty-tab card">
          {{ activeTab === 'upcoming' ? '예정된 예약이 없습니다' : '지난 예약이 없습니다' }}
        </div>
      </div>
    </div>

    <!-- Cancel Confirmation Modal -->
    <div v-if="showCancelModal" class="modal-overlay" @click.self="showCancelModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">예약 취소</h2>
          <button class="modal-close" @click="showCancelModal = false">&times;</button>
        </div>
        <p class="cancel-message">
          <strong>{{ reservationToCancel?.room_name }}</strong><br>
          {{ formatDate(reservationToCancel?.reservation_date) }}<br>
          {{ formatTime(reservationToCancel?.start_time) }} ~ {{ formatTime(reservationToCancel?.end_time) }}
          <br><br>
          이 예약을 취소하시겠습니까?
        </p>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCancelModal = false">돌아가기</button>
          <button class="btn btn-danger" @click="handleCancel" :disabled="cancelling">
            {{ cancelling ? '취소 중...' : '예약 취소' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const reservations = ref([])
const loading = ref(true)
const activeTab = ref('upcoming')
const showCancelModal = ref(false)
const reservationToCancel = ref(null)
const cancelling = ref(false)

const today = new Date()
today.setHours(0, 0, 0, 0)

const upcomingReservations = computed(() => {
  return reservations.value.filter(r => !isPast(r))
})

const pastReservations = computed(() => {
  return reservations.value.filter(r => isPast(r))
})

const displayedReservations = computed(() => {
  return activeTab.value === 'upcoming' ? upcomingReservations.value : pastReservations.value
})

const isPast = (reservation) => {
  const reservationDate = new Date(reservation.reservation_date)
  reservationDate.setHours(0, 0, 0, 0)
  return reservationDate < today
}

const fetchReservations = async () => {
  try {
    const response = await api.get('/api/reservations', {
      params: { user_id: authStore.user.id }
    })
    reservations.value = response.data.sort((a, b) => {
      const dateA = new Date(a.reservation_date)
      const dateB = new Date(b.reservation_date)
      return dateB - dateA
    })
  } catch (err) {
    console.error('Failed to fetch reservations:', err)
  } finally {
    loading.value = false
  }
}

const confirmCancel = (reservation) => {
  reservationToCancel.value = reservation
  showCancelModal.value = true
}

const handleCancel = async () => {
  cancelling.value = true
  try {
    await api.delete(`/api/reservations/${reservationToCancel.value.id}`)
    showCancelModal.value = false
    reservationToCancel.value = null
    fetchReservations()
  } catch (err) {
    alert(err.response?.data?.error || '취소에 실패했습니다.')
  } finally {
    cancelling.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`
}

const formatTime = (timeString) => {
  if (!timeString) return ''
  return timeString.substring(0, 5)
}

const getDaysUntil = (dateString) => {
  const reservationDate = new Date(dateString)
  reservationDate.setHours(0, 0, 0, 0)
  const diffTime = reservationDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '내일'
  return `D-${diffDays}`
}

onMounted(fetchReservations)
</script>

<style scoped>
.my-reservations-page {
  padding-bottom: 3rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  background: var(--bg-card);
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
}

.tab {
  flex: 1;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.tab:hover {
  color: var(--text-primary);
  background: var(--bg-input);
}

.tab.active {
  background: var(--primary);
  color: white;
}

.reservations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reservation-card {
  transition: transform 0.2s;
}

.reservation-card:hover {
  transform: translateX(4px);
}

.reservation-card.past {
  opacity: 0.7;
}

.reservation-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.reservation-icon {
  font-size: 2rem;
  background: var(--bg-input);
  padding: 0.75rem;
  border-radius: 0.75rem;
}

.reservation-info {
  flex: 1;
}

.reservation-room {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.reservation-datetime {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.reservation-date::after {
  content: '|';
  margin-left: 1rem;
  opacity: 0.3;
}

.reservation-badge {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.reservation-badge.upcoming {
  background: var(--primary-light);
  color: var(--primary);
}

.reservation-badge.past {
  background: var(--bg-input);
  color: var(--text-muted);
}

.reservation-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.empty-tab {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.cancel-message {
  color: var(--text-secondary);
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

@media (max-width: 640px) {
  .reservation-main {
    flex-wrap: wrap;
  }
  
  .reservation-badge {
    width: 100%;
    text-align: center;
    margin-top: 0.5rem;
  }
  
  .reservation-date::after {
    display: none;
  }
}
</style>
