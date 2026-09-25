// 注册内置的离线图标数据，使 @iconify/vue 的 <Icon> 组件完全离线工作，
// 不再在运行时请求 api.iconify.design。数据由 scripts/build-icons.mjs 生成。
import { addCollection } from '@iconify/vue'
import localIcons from './assets/icons.json'

for (const collection of Object.values(localIcons)) {
  addCollection(collection as Parameters<typeof addCollection>[0])
}
