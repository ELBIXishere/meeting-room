<template>
  <div class="auth-page">
    <button class="theme-toggle floating-theme" @click="themeStore.toggleTheme" :title="themeStore.isDark ? '라이트 모드' : '다크 모드'">
      {{ themeStore.isDark ? '☀️' : '🌙' }}
    </button>
    
    <div class="auth-container">
      <div class="auth-card card">
        <div class="auth-header">
          <div class="auth-icon">📅</div>
          <h1 class="auth-title">회원가입</h1>
          <p class="auth-subtitle">새 계정을 만들어 시작하세요</p>
        </div>

        <form @submit.prevent="handleRegister" class="auth-form">
          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <div v-if="success" class="alert alert-success">{{ success }}</div>

          <div class="form-group">
            <label class="form-label">아이디</label>
            <input
              type="text"
              v-model="username"
              class="form-input"
              placeholder="3자 이상 입력하세요"
              required
              autofocus
            />
          </div>

          <div class="form-group">
            <label class="form-label">비밀번호</label>
            <input
              type="password"
              v-model="password"
              class="form-input"
              placeholder="4자 이상 입력하세요"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">비밀번호 확인</label>
            <input
              type="password"
              v-model="confirmPassword"
              class="form-input"
              placeholder="비밀번호를 다시 입력하세요"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
            <span v-if="loading" class="btn-loading"></span>
            {{ loading ? '가입 중...' : '회원가입' }}
          </button>
        </form>

        <div class="auth-footer">
          <span>이미 계정이 있으신가요?</span>
          <router-link to="/login">로그인</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import api from '../api'

const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const handleRegister = async () => {
  error.value = ''
  success.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = '비밀번호가 일치하지 않습니다.'
    return
  }

  loading.value = true

  try {
    const response = await api.post('/api/auth/register', {
      username: username.value,
      password: password.value
    })

    authStore.setAuth(response.data.user, response.data.token)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || '회원가입에 실패했습니다.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
}

.floating-theme {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
}

.auth-container {
  width: 100%;
  max-width: 420px;
}

.auth-card {
  padding: 2.5rem;
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: var(--gradient-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.auth-subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.auth-form {
  margin-bottom: 1.5rem;
}

.btn-full {
  width: 100%;
  padding: 1rem;
  font-size: 1rem;
}

.btn-loading {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-footer {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.auth-footer a {
  margin-left: 0.5rem;
  font-weight: 500;
}
</style>
