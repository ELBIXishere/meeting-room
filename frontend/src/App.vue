<template>
  <div class="app">
    <nav class="nav" v-if="authStore.isAuthenticated">
      <div class="container nav-content">
        <router-link to="/" class="nav-brand">
          📅 회의실 예약
        </router-link>
        <div class="nav-links">
          <router-link to="/" class="nav-link" active-class="active" :class="{ active: $route.path === '/' }">예약하기</router-link>
          <router-link to="/rooms" class="nav-link" active-class="active">회의실 관리</router-link>
          <router-link to="/my-reservations" class="nav-link" active-class="active">내 예약</router-link>
        </div>
        <div class="nav-user">
          <button class="theme-toggle" @click="themeStore.toggleTheme" :title="themeStore.isDark ? '라이트 모드' : '다크 모드'">
            {{ themeStore.isDark ? '☀️' : '🌙' }}
          </button>
          <span class="nav-username">{{ authStore.user?.username }}님</span>
          <button class="btn btn-secondary btn-sm" @click="handleLogout">로그아웃</button>
        </div>
      </div>
    </nav>
    <main>
      <router-view />
    </main>
    
    <!-- 플로팅 AI 챗봇 -->
    <ChatbotPIP v-if="authStore.isAuthenticated" />
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { useRouter } from 'vue-router'
import ChatbotPIP from './components/ChatbotPIP.vue'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const router = useRouter()

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.app {
  min-height: 100vh;
}
</style>
