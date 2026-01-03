<template>
  <div class="playlist-detail">
    <!-- 歌单头部信息 -->
    <header class="playlist-header">
      <div class="header-content">
        <div class="cover-area">
          <img :src="playlist.info.img" :alt="playlist.info.name" class="playlist-cover" />
          <div class="cover-overlay"></div>
        </div>
        
        <div class="info-area">
          <div class="playlist-type">歌单</div>
          <h1 class="playlist-name">{{ playlist.info.name }}</h1>
          <div class="playlist-meta">
            <span class="author">{{ playlist.info.author }}</span>
            <span class="play-count">
              <Icon icon="lucide:play" width="14" /> {{ playlist.info.play_count }}
            </span>
            <span class="song-count">{{ playlist.total }} 首</span>
          </div>
          
          <div class="playlist-desc" v-if="playlist.info.desc">
            {{ playlist.info.desc }}
          </div>
          
          <div class="action-buttons">
            <button class="play-btn">
              <Icon icon="lucide:play" width="20" /> 播放全部
            </button>
            <button class="add-btn">
              <Icon icon="lucide:plus" width="18" /> 收藏
            </button>
            <button class="more-btn">
              <Icon icon="lucide:more-vertical" width="18" />
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <!-- 歌曲列表 -->
    <main class="song-list">
      <div class="list-header">
        <div class="list-title">歌曲列表</div>
        <div class="list-info">共 {{ playlist.total }} 首歌曲</div>
      </div>
      
      <table class="song-table">
        <thead>
          <tr>
            <th class="col-index">#</th>
            <th class="col-info">歌曲</th>
            <th class="col-album">专辑</th>
            <th class="col-duration">时长</th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(song, index) in playlist.list" :key="song.songmid" class="song-item">
            <td class="col-index">{{ index + 1 }}</td>
            <td class="col-info">
              <div class="song-info">
                <img :src="song.s_img" :alt="song.name" class="song-cover" />
                <div class="song-detail">
                  <div class="song-name">{{ song.name }}</div>
                  <div class="song-singer">{{ song.singer }}</div>
                </div>
              </div>
            </td>
            <td class="col-album">{{ song.albumName }}</td>
            <td class="col-duration">{{ song.interval }}</td>
            <td class="col-action">
              <button class="play-action">
                <Icon icon="lucide:play" width="16" />
              </button>
              <button class="more-action">
                <Icon icon="lucide:more-vertical" width="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

// 固定歌单数据
const playlist = ref({
  "list": [
    {
      "singer": "那束花本是给她",
      "name": "David Lessenger-地球脉动的小曲We Don't Talk Anymore (纯享版) （那束花本是给她 remix）",
      "albumName": "万物",
      "albumId": 286652435,
      "source": "wy",
      "interval": "03:17",
      "songmid": 2750774430,
      "img": "https://p2.music.126.net/zT9grAc0aicJbxglDtnPXA==/109951172079101681.jpg?param=1024y1024",
      "m_img": "https://p2.music.126.net/zT9grAc0aicJbxglDtnPXA==/109951172079101681.jpg?param=512y512",
      "s_img": "https://p2.music.126.net/zT9grAc0aicJbxglDtnPXA==/109951172079101681.jpg?param=128y128",
      "types": [
        {
          "type": "standard",
          "size": "4.53MB"
        },
        {
          "type": "exhigh",
          "size": "7.55MB"
        },
        {
          "type": "lossless",
          "size": "19.43MB"
        },
        {
          "type": "sky",
          "size": "19.46MB"
        },
        {
          "type": "jyeffect",
          "size": "69.05MB"
        },
        {
          "type": "jymaster",
          "size": "118.62MB"
        }
      ]
    },
    {
      "singer": "Taylor Swift、Brendon Urie",
      "name": "ME!",
      "albumName": "Lover",
      "albumId": 80752440,
      "source": "wy",
      "interval": "03:13",
      "songmid": 1382781549,
      "img": "https://p2.music.126.net/6CB6Jsmb7k7qiJqfMY5Row==/109951164260234943.jpg?param=1024y1024",
      "m_img": "https://p2.music.126.net/6CB6Jsmb7k7qiJqfMY5Row==/109951164260234943.jpg?param=512y512",
      "s_img": "https://p2.music.126.net/6CB6Jsmb7k7qiJqfMY5Row==/109951164260234943.jpg?param=128y128",
      "types": [
        {
          "type": "standard",
          "size": "4.42MB"
        },
        {
          "type": "exhigh",
          "size": "7.37MB"
        },
        {
          "type": "lossless",
          "size": "25.86MB"
        },
        {
          "type": "sky",
          "size": "23.40MB"
        },
        {
          "type": "jyeffect",
          "size": "73.40MB"
        },
        {
          "type": "jymaster",
          "size": "127.41MB"
        }
      ]
    },
    {
      "singer": "DECO*27、初音ミク",
      "name": "ラビットホール",
      "albumName": "ラビットホール",
      "albumId": 164629017,
      "source": "wy",
      "interval": "02:39",
      "songmid": 2043178301,
      "img": "https://p2.music.126.net/20QetRSvLjUmyyGF__1ALA==/109951168575689926.jpg?param=1024y1024",
      "m_img": "https://p2.music.126.net/20QetRSvLjUmyyGF__1ALA==/109951168575689926.jpg?param=512y512",
      "s_img": "https://p2.music.126.net/20QetRSvLjUmyyGF__1ALA==/109951168575689926.jpg?param=128y128",
      "types": [
        {
          "type": "standard",
          "size": "3.64MB"
        },
        {
          "type": "exhigh",
          "size": "6.07MB"
        },
        {
          "type": "lossless",
          "size": "20.65MB"
        },
        {
          "type": "sky",
          "size": "20.15MB"
        },
        {
          "type": "jyeffect",
          "size": "64.58MB"
        },
        {
          "type": "jymaster",
          "size": "113.57MB"
        }
      ]
    },
    {
      "singer": "d0tc0mmie、GUMI",
      "name": "I Can't Wait (feat. GUMI)",
      "albumName": "I Can't Wait (feat. GUMI)",
      "albumId": 353993404,
      "source": "wy",
      "interval": "01:35",
      "songmid": 3326907142,
      "img": "https://p2.music.126.net/0GEf5ziQ8mG0HfRY8djyvg==/109951172408103691.jpg?param=1024y1024",
      "m_img": "https://p2.music.126.net/0GEf5ziQ8mG0HfRY8djyvg==/109951172408103691.jpg?param=512y512",
      "s_img": "https://p2.music.126.net/0GEf5ziQ8mG0HfRY8djyvg==/109951172408103691.jpg?param=128y128",
      "types": [
        {
          "type": "standard",
          "size": "2.19MB"
        },
        {
          "type": "exhigh",
          "size": "3.65MB"
        },
        {
          "type": "lossless",
          "size": "12.01MB"
        },
        {
          "type": "hires",
          "size": "20.59MB"
        },
        {
          "type": "sky",
          "size": "11.29MB"
        },
        {
          "type": "jyeffect",
          "size": "36.05MB"
        },
        {
          "type": "jymaster",
          "size": "65.54MB"
        }
      ]
    },
    {
      "singer": "梶浦由記",
      "name": "Sis puella magica!",
      "albumName": "魔法少女まどか☆マギカ Music Collection",
      "albumId": 2732401,
      "source": "wy",
      "interval": "02:49",
      "songmid": 28138654,
      "img": "https://p2.music.126.net/7cYVfSgSZFZeVheUFDGOIg==/109951166197931207.jpg?param=1024y1024",
      "m_img": "https://p2.music.126.net/7cYVfSgSZFZeVheUFDGOIg==/109951166197931207.jpg?param=512y512",
      "s_img": "https://p2.music.126.net/7cYVfSgSZFZeVheUFDGOIg==/109951166197931207.jpg?param=128y128",
      "types": [
        {
          "type": "standard",
          "size": "3.88MB"
        },
        {
          "type": "exhigh",
          "size": "6.47MB"
        },
        {
          "type": "lossless",
          "size": "31.72MB"
        },
        {
          "type": "sky",
          "size": "17.53MB"
        },
        {
          "type": "jyeffect",
          "size": "59.17MB"
        },
        {
          "type": "jymaster",
          "size": "100.19MB"
        }
      ]
    }
  ],
  "page": 1,
  "limit": 5,
  "total": 53,
  "source": "wy",
  "info": {
    "play_count": "51",
    "name": "我喜欢的音乐",
    "img": "https://p1.music.126.net/G3NA3TqQD3L51OkzrhNQmw==/109951172080623907.jpg",
    "desc": "",
    "author": "蓝蜻蜓017"
  }
});
</script>

<style scoped lang="scss">
.playlist-detail {
  min-height: 100%;
  
  .playlist-header {
    background: var(--header-bg);
    padding: 40px 20px;
    color: var(--text-primary);
    
    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      gap: 30px;
      align-items: flex-end;
      
      .cover-area {
        position: relative;
        
        .playlist-cover {
          width: 200px;
          height: 200px;
          object-fit: cover;
          border-radius: 12px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
        }
        
        .cover-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
          border-radius: 12px;
        }
      }
      
      .info-area {
        flex: 1;
        padding-bottom: 20px;
        
        .playlist-type {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 8px;
        }
        
        .playlist-name {
          font-size: 36px;
          font-weight: 800;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }
        
        .playlist-meta {
          display: flex;
          gap: 20px;
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 20px;
          
          .author {
            font-weight: 500;
          }
          
          .play-count {
            display: flex;
            align-items: center;
            gap: 6px;
          }
        }
        
        .playlist-desc {
          font-size: 14px;
          line-height: 1.6;
          opacity: 0.9;
          margin-bottom: 24px;
          max-width: 600px;
        }
        
        .action-buttons {
          display: flex;
          gap: 12px;
          
          button {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            border: none;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            
            &.play-btn {
              background: #6366f1;
              color: white;
              padding: 12px 24px;
              
              &:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
              }
            }
            
            &.add-btn {
              background: var(--bg-secondary);
              color: var(--text-primary);
              border: 1px solid var(--border-color);
              
              &:hover {
                background: var(--bg-tertiary);
                border-color: var(--text-secondary);
              }
            }
            
            &.more-btn {
              background: var(--bg-secondary);
              color: var(--text-primary);
              border: 1px solid var(--border-color);
              width: 40px;
              height: 40px;
              padding: 0;
              justify-content: center;
              border-radius: 50%;
              
              &:hover {
                background: var(--bg-tertiary);
                border-color: var(--text-secondary);
              }
            }
          }
        }
      }
    }
  }
  
  .song-list {
    max-width: 1400px;
    margin: 0 auto;
    padding: 30px 20px;
    
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      
      .list-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--text-primary);
      }
      
      .list-info {
        font-size: 14px;
        color: var(--text-secondary);
      }
    }
    
    .song-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-primary);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
      
      th, td {
        padding: 16px 20px;
        text-align: left;
        border-bottom: 1px solid var(--border-light);
      }
      
      th {
        background: var(--bg-secondary);
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .col-index {
        width: 60px;
        font-size: 14px;
        color: var(--text-secondary);
      }
      
      .col-info {
        flex: 1;
      }
      
      .col-album {
        width: 250px;
        font-size: 14px;
        color: var(--text-secondary);
      }
      
      .col-duration {
        width: 100px;
        font-size: 14px;
        color: var(--text-secondary);
      }
      
      .col-action {
        width: 80px;
      }
      
      .song-item {
        transition: background-color 0.2s ease;
        
        &:hover {
          background: var(--bg-secondary);
        }
        
        .song-info {
          display: flex;
          align-items: center;
          gap: 12px;
          
          .song-cover {
            width: 44px;
            height: 44px;
            object-fit: cover;
            border-radius: 6px;
          }
          
          .song-detail {
            .song-name {
              font-size: 14px;
              font-weight: 500;
              color: var(--text-primary);
              margin-bottom: 4px;
            }
            
            .song-singer {
              font-size: 13px;
              color: var(--text-secondary);
            }
          }
        }
        
        button {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          transition: all 0.2s ease;
          
          &:hover {
            background: var(--nav-item-hover);
            color: var(--text-primary);
          }
          
          &.play-action:hover {
            color: #6366f1;
          }
        }
      }
    }
  }
}
</style>