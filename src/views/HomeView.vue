<template>
  <div class="home-view">
    <section class="section-container">
      <div class="section-header">
        <h2 class="section-title">推荐歌单</h2>
        <div class="more">查看全部 <Icon icon="lucide:chevron-right" /></div>
      </div>

      <div class="playlist-grid">
        <div
          v-for="item in playlistData"
          :key="item.id"
          class="playlist-card"
          @click="handlePlayListClick(item)"
        >
          <div class="cover-wrapper">
            <img :src="item.img" :alt="item.name" loading="lazy" />

            <div class="play-count">
              <Icon icon="lucide:play" width="12" />
              <span>{{ item.play_count }}</span>
            </div>
          </div>

          <div class="playlist-info">
            <div class="playlist-name">{{ item.name }}</div>
            <div class="playlist-author">{{ item.author }}</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

// 注入你提供的 JSON 数据
const playlistData = ref([

  {

    "play_count": "4.7万",

    "id": "17387580241",

    "author": "张大佛爷张大佛爷",

    "name": "巴西Funk：来首精神氮泵助力燃脂",

    "time": "2025-11-02",

    "img": "http://p2.music.126.net/YkpQqGGlHR4DD8BjGTQe8Q==/109951172228935288.jpg",

    "total": 30,

    "desc": "巴西放克（Funk brasileiro)，通常在巴西被称为\"Funk\"，是一种受嘻哈音乐（Hip Hop）影响的音乐风 格，起源于里约热内卢的贫民区（也称为贫民窟）。里约放克(Funk carioca）最初源自电音放克（Electro）和迈阿密贝 斯（Miami Bass)，之后逐渐发展出独特的风格，并成为巴西低收入青少年中最受欢迎的音乐类型之一。\n\n听说巴西Funk和健身很搭噢！",

    "source": "wy"

  },

  {

    "play_count": "3.6万",

    "id": "14435495551",

    "author": "凌晨一点的莱茵猫",

    "name": "ACG治愈 | 回忆复刻 重温动漫里的温情时刻",

    "time": "2025-10-18",

    "img": "http://p2.music.126.net/uPWibcRbc7u3vDD44gXA0A==/109951172205320822.jpg",

    "total": 99,

    "desc": "不是所有治愈都需要大段对白\n一段旋律就够了\n\n可以是主角低谷时的背景音\n也可以是圆满结局的收尾曲\n\n每一段都裹着当时的情绪\n现在听依旧能暖到心里最软的地方",

    "source": "wy"

  },

  {

    "play_count": "3万",

    "id": "17438630520",

    "author": "露露在发呆",

    "name": "跑步 •鬼灭之刃超燃和风主题歌",

    "time": "2025-11-15",

    "img": "http://p2.music.126.net/DuKyLyYhKd2YhWsRYkd9DQ==/109951172287476927.jpg",

    "total": 26,

    "desc": "鬼灭之刃即将迎来无限城终极大决战，精选历代TV番、剧场版主题曲与超人气配乐插曲，与动画同样出彩的是其独特美妙的日式和风电子流行曲风，给你今日份的运动计划注入来自鬼灭之刃的二次元能量吧，适配有氧、无氧运动 全适配，高能KPOP祝你今天也能量满满燃爆卡路里！",

    "source": "wy"

  },

  {

    "play_count": "1.7万",

    "id": "17430413151",

    "author": "心语馆",

    "name": "【高质量轻音】享受宁静 沉浸自然",

    "time": "2025-11-13",

    "img": "http://p2.music.126.net/El8lldCevbObAYAcBz0kvg==/109951172275960287.jpg",

    "total": 72,

    "desc": "当城市喧嚣渐远\n让音符化作自然的信使\n\n钢琴的澄澈如林间晨露\n弦乐的温柔似晚风拂叶\n\n虫鸣与流水声悄然交织\n每一段旋律都在勾勒远山\n\n晴空与旷野的轮廓\n无需刻意追寻\n\n只需闭上眼\n便能在旋律里触摸自然 的呼吸\n\n让身心沉潜于这份不被打扰的宁静\n重拾内心的松弛与澄澈……",

    "source": "wy"

  },

  {

    "play_count": "4681",

    "id": "17440686473",

    "author": "與鯨島",

    "name": "刘宇｜我生如刀锋 自当斩荆棘",

    "time": "2025-11-15",

    "img": "http://p2.music.126.net/l6q13AT-n47NICqDGf90lw==/109951172291475298.jpg",

    "total": 50,

    "desc": "他说：\n“我接受来自四面八方的欢呼鼓舞，也接受不明缘由的流言与我接受来自四面八方的欢呼鼓舞，也 接受不明缘由的流言与误解。我低谷过，但没人能熄灭我跳动的火焰。眼前不变的是光明和希望，再尖锐的噪音也无法打 断已经响起的旋律，仍在舞蹈，就是我的态度。”\n\n“我很早之前就说过，恶评它其实不会伤害到我，哪怕我说的一句话 ，它没有错误，有些人都可以在TA的立场上找出这句话的错误，我觉得这个不太需要去考虑的，因为你做什么事情问心无 愧最重要。”\n\n“我觉得你们也在发光，是因为你们的光汇聚在一起，我才能这么明亮。”\n\n“天赋固然重要，但我想要 才更重要。”\n\n“愿你我皆被温柔以待，身处泥泞也嗅得大地芳香。”\n\n“我想告诉你们的是，是你们的光唤醒了我心中 的那颗种子，我知道有一天，这颗种子，可以成为为你们遮挡伤害的那棵大树，请相信我。”\n\n“谢谢您曾对我说，要去 做那个扇风的人，要让全世界知道这把扇子扇出来的风，叫中国风。”\n\n“国风推广这条路，其实我的初心一直不变，依 旧在前行，也理解我作为公众人物应该负担起更多的责误解。我低谷过，但没人能熄灭我跳动的火焰。眼前不变的是光明 和希望，再尖锐的噪音也无法打断已经响起的旋律，仍在舞蹈，就是我的态度。”\n\n“我很早之前就说过，恶评它其实不 会伤害到我，哪怕我说的一句话，它没有错误，有些人都可以在TA的立场上找出这句话的错误，我觉得这个不太需要去考 虑的，因为你做什么事情问心无愧最重要。”\n\n“我觉得你们也在发光，是因为你们的光汇聚在一起，我才能这么明亮。”\n\n“天赋固然重要，但我想要才更重要。”\n\n“愿你我皆被温柔以待，身处泥泞也嗅得大地芳香。”\n\n“我想告诉你们的是，是你们的光唤醒了我心中的那颗种子，我知道有一天，这颗种子，可以成为为你们遮挡伤害的那棵大树，请相信我。”\n\n“谢谢您曾对我说，要去做那个扇风的人，要让全世界知道这把扇子扇出来的风，叫中国风。”\n\n“国风推广这条路，其实我的初心一直不变，依旧在前行，也理解我作为公众人物应该负担起更多的责任、传播的重任。希望未来不负期望， 能号召更多的年轻的朋友关注和热爱国风、传统文化。”\n\n“把冠军定在道路上，而不是目标上。”\n\n“你们带着特别热 情，特别想要跟你传达他们的爱的时候，你就觉得，这点累算什么。”\n\n“太在意恶评，是对好评的不负责。”\n\n",

    "source": "wy"

  },

  {

    "play_count": "2.1万",

    "id": "17412466554",

    "author": "走马川行北海边",

    "name": "网上很火韩语歌曲｜宿命感拉满氛围神曲",

    "time": "2025-11-08",

    "img": "http://p2.music.126.net/Rf9Nx1eefoGbqGhqq84SBw==/109951172254139596.jpg",

    "total": 72,

    "desc": "前奏一响，便是跨越时空的宿命羁绊。这些火爆全网的韩语神曲，藏着韩剧里初雪拔剑的悸动、跨越百年的深情，也藏着爱而不得的怅惘与命中注定的奔赴。空灵声线交织着缱绻旋律，氛围感直接拉满，每一段旋律都像在诉说： 有些人，遇见即是宿命，哪怕兜兜转转，也终会被命运牵引。戴上耳机，沉浸式坠入这场关于宿命的浪漫与遗憾。",

    "source": "wy"

  },

  {

    "play_count": "1.2万",

    "id": "17426483259",

    "author": "心语馆",

    "name": "【欧美旋律控】前奏封神 耳熟能详欧美神曲",

    "time": "2025-11-12",

    "img": "http://p2.music.126.net/4EiMzo9LAGbNjwF79ecuZg==/109951172271263928.jpg",

    "total": 67,

    "desc": "这份歌单，是资深乐迷私藏的欧美旋律宝库。从格莱美获奖金曲，到小众音乐人的惊艳之作，每一首都经过时间与口碑的双重检验。\n\n有Adele用灵魂嗓音唱出的《Rolling in the Deep》，那强烈鼓点和凄美钢琴交织，让失恋 的痛楚与坚强直击人心；也有Coldplay用《Viva la Vida》带来的摇滚盛宴，壮丽弦乐搭配激昂节奏，展现帝国兴衰。这 里既有流行、摇滚、民谣等主流风格，也不乏R&B、电子乐等小众类型，满足不同音乐偏好。\n\n无论你是在午后闲暇、深夜独处，还是在通勤路上，这些旋律都能为你带来极致的听觉享受，让你沉浸在欧美音乐的独特魅力中，一听就上瘾，循 环到停不下来 。",

    "source": "wy"

  },

  {

    "play_count": "4198",

    "id": "17514849470",

    "author": "心语馆",

    "name": "【高质量轻音】清新宁静 明亮自然",

    "time": "2025-12-04",

    "img": "http://p2.music.126.net/v0jiaItY2fD3LuQVrdt_Cg==/109951172384635472.jpg",

    "total": 71,

    "desc": "蝉鸣躲进树荫，落叶在石阶上打了个转。木吉他的弦音裹着松针的气息，手鼓轻得像松鼠踩过腐叶。不必追赶时间，只需闭眼，让音符替你接住林间漏下的每一缕暖阳。",

    "source": "wy"

  },

  {

    "play_count": "1万",

    "id": "14407617761",

    "author": "露露在发呆",

    "name": "华语R&B：像一只蝴蝶飞过废墟",

    "time": "2025-10-11",

    "img": "http://p2.music.126.net/nYl-Rts9LlhdrGRIx5St-g==/109951172136819703.jpg",

    "total": 58,

    "desc": "我瞒着所有人装作迈过了很多坎，故意显得很开心的样子，事实上只有我知道，阴影就是阴影，有些坎我永远也迈不过去，有些事一时半会释怀，我承认你很好，有些事跟我喜欢你没关系，有些事没在一个频道上，更没办法将两 件事放一起衡量。",

    "source": "wy"

  },

  {

    "play_count": "8188",

    "id": "17511869819",

    "author": "有只黑猫叫灰心",

    "name": "「韩语宿命感」首尔晚风里的心跳",

    "time": "2025-12-04",

    "img": "http://p2.music.126.net/wXRLNUreaGRVcU7CYe20KA==/109951172381558389.jpg",

    "total": 50,

    "desc": "ᥫᩣ当首尔的晚风裹着便利店的暖光掠过耳机线，韩语歌词里那些轻颤的音节，正藏着和你同频的心跳共振。这是专属于宿命感的BGM——每一段旋律都像被按下慢放的初遇镜头：是走廊转角撞进眼底的视线，是咖啡杯沿碰在一起时的轻响，是晚风里没说出口的「恰好我也喜欢你」。耳机里的每一句，都是藏在旋律里的、只属于你的心动序章✨",

    "source": "wy"

  }

]);

import { useRouter } from 'vue-router';

const router = useRouter();

const handlePlayListClick = (item: any) => {
  router.push(`/playlist/${item.id}`);
};
</script>

<style scoped lang="scss">
.home-view {
  padding: 20px 0 40px 0;

  .section-container {
    margin-bottom: 40px;
    padding: 0 20px;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 20px;

      .section-title {
        font-size: 24px;
        font-weight: 800;
        color: var(--text-primary);
        margin: 0;
      }

      .more {
        font-size: 13px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: color 0.2s;
        &:hover { color: #6366f1; }
      }
    }
  }

  .playlist-grid {
    display: grid;
    // 使用 auto-fill 实现响应式列数
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 24px;

    .playlist-card {
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);

      &:hover {
        .cover-wrapper {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);

          img { transform: scale(1.05); }
        }
        .playlist-name { color: #ff6b6b; }
      }

      .cover-wrapper {
        position: relative;
        aspect-ratio: 1;
        border-radius: 14px;
        overflow: hidden;
        background: #f0f0f0;
        margin-bottom: 12px;
        transition: all 0.4s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s ease;
        }

        .play-count {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 2;
        }
      }

      .playlist-info {
        .playlist-name {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          color: #333;
          margin-bottom: 4px;
          // 两行文本截断
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.2s;
        }

        .playlist-author {
          font-size: 12px;
          color: #999;
        }
      }
    }
  }
}
</style>
