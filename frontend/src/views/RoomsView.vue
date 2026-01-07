<template>
  <div class="rooms-page">
    <div class="container">
      <div class="page-header">
        <div class="header-content">
          <div>
            <h1 class="page-title">회의실 관리</h1>
            <p class="page-subtitle">회의실을 등록하고 관리하세요</p>
          </div>
          <button class="btn btn-primary" @click="showAddModal = true">
            + 회의실 추가
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-container">
        <div class="spinner"></div>
      </div>

      <div v-else-if="rooms.length === 0" class="empty-state card">
        <div class="empty-state-icon">🏢</div>
        <h3>등록된 회의실이 없습니다</h3>
        <p>새로운 회의실을 추가해보세요</p>
        <button class="btn btn-primary" @click="showAddModal = true">
          + 첫 회의실 추가하기
        </button>
      </div>

      <div v-else class="rooms-grid grid grid-3">
        <div v-for="room in rooms" :key="room.id" class="room-card card">
          <div class="room-header">
            <div class="room-icon">🏠</div>
            <div class="room-info">
              <h3 class="room-name">{{ room.name }}</h3>
              <p class="room-date">{{ formatDate(room.created_at) }} 등록</p>
            </div>
          </div>
          <p class="room-description" v-if="room.description">{{ room.description }}</p>
          <p class="room-description room-no-desc" v-else>설명이 없습니다</p>
          <div class="room-actions">
            <button class="btn btn-secondary btn-sm" @click="editRoom(room)">수정</button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete(room)">삭제</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ showEditModal ? '회의실 수정' : '회의실 추가' }}</h2>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <form @submit.prevent="showEditModal ? handleUpdate() : handleAdd()">
          <div v-if="error" class="alert alert-error">{{ error }}</div>
          
          <div class="form-group">
            <label class="form-label">회의실 이름 *</label>
            <input
              type="text"
              v-model="formData.name"
              class="form-input"
              placeholder="예: 대회의실 A"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">설명 (선택)</label>
            <textarea
              v-model="formData.description"
              class="form-input"
              rows="3"
              placeholder="회의실에 대한 설명을 입력하세요"
            ></textarea>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">취소</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              {{ submitting ? '저장 중...' : (showEditModal ? '수정' : '추가') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">회의실 삭제</h2>
          <button class="modal-close" @click="showDeleteModal = false">&times;</button>
        </div>
        <p class="delete-message">
          <strong>{{ roomToDelete?.name }}</strong> 회의실을 삭제하시겠습니까?<br>
          <span class="delete-warning">이 회의실의 모든 예약도 함께 삭제됩니다.</span>
        </p>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDeleteModal = false">취소</button>
          <button class="btn btn-danger" @click="handleDelete" :disabled="submitting">
            {{ submitting ? '삭제 중...' : '삭제' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const rooms = ref([])
const loading = ref(true)
const submitting = ref(false)
const error = ref('')

const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const roomToDelete = ref(null)
const roomToEdit = ref(null)

const formData = ref({
  name: '',
  description: ''
})

const fetchRooms = async () => {
  try {
    const response = await api.get('/api/rooms')
    rooms.value = response.data
  } catch (err) {
    console.error('Failed to fetch rooms:', err)
  } finally {
    loading.value = false
  }
}

const handleAdd = async () => {
  error.value = ''
  submitting.value = true

  try {
    await api.post('/api/rooms', formData.value)
    closeModal()
    fetchRooms()
  } catch (err) {
    error.value = err.response?.data?.error || '회의실 추가에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}

const editRoom = (room) => {
  roomToEdit.value = room
  formData.value = {
    name: room.name,
    description: room.description || ''
  }
  showEditModal.value = true
}

const handleUpdate = async () => {
  error.value = ''
  submitting.value = true

  try {
    await api.put(`/api/rooms/${roomToEdit.value.id}`, formData.value)
    closeModal()
    fetchRooms()
  } catch (err) {
    error.value = err.response?.data?.error || '회의실 수정에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}

const confirmDelete = (room) => {
  roomToDelete.value = room
  showDeleteModal.value = true
}

const handleDelete = async () => {
  submitting.value = true

  try {
    await api.delete(`/api/rooms/${roomToDelete.value.id}`)
    showDeleteModal.value = false
    roomToDelete.value = null
    fetchRooms()
  } catch (err) {
    alert(err.response?.data?.error || '삭제에 실패했습니다.')
  } finally {
    submitting.value = false
  }
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  roomToEdit.value = null
  formData.value = { name: '', description: '' }
  error.value = ''
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(fetchRooms)
</script>

<style scoped>
.rooms-page {
  padding-bottom: 3rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.rooms-grid {
  margin-top: 1rem;
}

.room-card {
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.room-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.room-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.room-icon {
  font-size: 2.5rem;
  background: var(--bg-input);
  padding: 0.75rem;
  border-radius: 0.75rem;
}

.room-info {
  flex: 1;
}

.room-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.room-date {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.room-description {
  flex: 1;
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.room-no-desc {
  color: var(--text-muted);
  font-style: italic;
}

.room-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.delete-message {
  color: var(--text-secondary);
  line-height: 1.6;
}

.delete-warning {
  color: var(--danger);
  font-size: 0.9rem;
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

textarea.form-input {
  resize: vertical;
  min-height: 80px;
}
</style>
