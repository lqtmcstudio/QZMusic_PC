// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

import App from './App.vue'
import HomeView from './views/HomeView.vue'
import PlaylistDetailView from './views/PlaylistDetailView.vue'

import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'

const pinia = createPinia()
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/playlist/:id', component: PlaylistDetailView },
    // 可扩展其他路由
  ]
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(TDesign)
app.mount('#app')
