// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

import App from './App.vue'
import HomeView from './views/HomeView.vue'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const pinia = createPinia()
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    // 可扩展其他路由
  ]
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
