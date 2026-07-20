# OBSESSION Poster Lab

一个面向手机现场拍摄的电影海报生成器。用户可以通过实时构图参考线放置脸、花束、双手和花瓶，在浏览器本地完成滤镜处理，并导出带固定 `OBSESSION` 标识的 A3 300 DPI PNG。

## 功能

- 手机前后摄像头实时取景
- 脸/花束、左右手、花瓶中线和 A3 裁切参考线
- 本地姿态识别，实时提示左右、远近和双手位置
- 拍摄后自动校正人物大小与构图
- 立即、3 秒和 10 秒自拍定时器
- 低照度暖灰、红色轮廓光、柔焦和胶片颗粒滤镜
- A3 纵向 3508 × 4961 px、300 DPI PNG 导出
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

## 部署

仓库包含 Vercel 配置及 GitHub Pages 工作流。每次推送 `main` 后会自动更新两个公开地址：

- [Vercel 主站](https://obsession-poster.vercel.app)
- [GitHub Pages 备用站](https://wangnilong.github.io/obsession-poster-lab/)

## 许可证

[MIT](./LICENSE)。Anton 字体按其目录中的 SIL Open Font License 授权。
