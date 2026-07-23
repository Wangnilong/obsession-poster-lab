# COSMOS FILM 42

COSMOS FILM 42 的电影与互动档案。主页收录电影项目，每部电影拥有独立的互动工具页；首个项目是面向手机现场拍摄的 `OBSESSION` 海报生成器。

## 功能

- 手机前后摄像头实时取景
- 脸/花束、左右手、花瓶中线和 A3 裁切参考线
- 本地姿态识别，实时提示左右、远近和双手位置
- 拍摄后自动校正人物大小与构图
- 立即、3 秒和 10 秒自拍定时器
- 低照度暖灰、红色轮廓光、柔焦和胶片颗粒滤镜
- A3 屏幕版 3508 × 4961 px、300 DPI PNG 导出
- Canon TR160 专用 A4 打印补偿、2480 × 3508 px PNG、标准 A4 PDF 与直接打印
- AI 模型与字体全部自托管，照片仅在用户设备中处理

## 本地开发

```bash
npm install
npm run dev
```

静态构建：

```bash
npm run build:pages
```

EdgeOne 根域名构建：

```bash
npm run build:edgeone
```

产物位于 `edgeone-dist`，同时生成主页、`/obsession/` 和静态托管回退页。

## 新增电影

1. 在 `src/films.ts` 增加电影资料，主页会自动出现新项目。
2. 复制一个电影互动组件，例如 `app/obsession-poster.tsx`。
3. 在 `src/main.tsx` 注册路径和组件，并在 `app/<电影 slug>/page.tsx` 增加对应页面。
4. 在 `scripts/create-film-routes.mjs` 的 `filmRoutes` 中加入 slug，确保 EdgeOne、Vercel 和 GitHub Pages 都能直接访问该地址。

## 部署

正式域名计划使用 `https://www.cosmosfilm42.cn`，`OBSESSION` 项目位于 `/obsession/`。仓库同时保留 Vercel 与 GitHub Pages 作为构建和备用入口：

- [Vercel 主站](https://obsession-poster.vercel.app)
- [GitHub Pages 备用站](https://wangnilong.github.io/obsession-poster-lab/)

## 许可证

[MIT](./LICENSE)。Anton 字体按其目录中的 SIL Open Font License 授权。
