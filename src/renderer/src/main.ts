// src/renderer/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

import App from './App.vue'
import 'element-plus/dist/index.css'

const pinia = createPinia()
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('./views/Home.vue')
    },
    {
      path: '/local',
      name: 'Local',
      component: () => import('./views/LocalMusic.vue')
    },
    {
      path: '/liked',
      name: 'Liked',
      component: () => import('./views/Playlist.vue')
    },
    {
      path: '/favorite-playlists',
      name: 'FavoritePlaylists',
      component: () => import('./views/FavoritePlaylists.vue')
    },
    {
      path: '/recent',
      name: 'Recent',
      component: () => import('./views/Playlist.vue')
    },
    {
      path: '/together',
      name: 'ListenTogether',
      component: () => import('./views/ListenTogether.vue')
    },
    {
      path: '/listen-stats',
      name: 'ListenStats',
      component: () => import('./views/ListenStats.vue')
    },
    {
      path: '/listen-rank',
      name: 'ListenRank',
      component: () => import('./views/ListenRank.vue')
    },
    {
      path: '/playlist-square',
      name: 'PlaylistSquare',
      component: () => import('./views/PlaylistSquare.vue')
    },
    {
      path: '/user/:id',
      name: 'UserProfile',
      component: () => import('./views/UserProfile.vue')
    },
    {
      path: '/user/:id/liked',
      name: 'UserLikedPlaylist',
      component: () => import('./views/Playlist.vue')
    },
    {
      path: '/playlist/:scope/:id',
      name: 'PlaylistDetail',
      component: () => import('./views/Playlist.vue')
    },
    {
      path: '/plugin/:pluginId/:kind/:id',
      name: 'PluginCollection',
      component: () => import('./views/Playlist.vue')
    },
    {
      path: '/search',
      name: 'Search',
      component: () => import('./views/Search.vue')
    }
  ]
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
