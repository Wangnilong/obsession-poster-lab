# OBSESSION Poster Lab

一个面向手机现场拍摄的电影海报生成器。用户可以通过实时构图参考线放置脸、花束、双手和花瓶，在浏览器本地完成滤镜处理，并导出带固定 `OBSESSION` 标识的 A3 300 DPI PNG。

## 功能

- 手机前后摄像头实时取景
- 脸/花束、左右手、花瓶中线和 A3 裁切参考线
- 低照度暖灰、红色轮廓光、柔焦和胶片颗粒滤镜
- 自动人脸定位（浏览器支持时启用）
- A3 纵向 3508 × 4961 px、300 DPI PNG 导出
- 所有照片仅在用户设备中处理，不上传服务器

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

仓库包含 `vercel.json`，可以直接导入 Vercel。Vercel 会运行静态构建并发布 `github-dist`。

## 许可证

[MIT](./LICENSE)。Anton 字体按其目录中的 SIL Open Font License 授权。
