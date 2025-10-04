# YouTube Gist Chrome 扩展

这个目录包含一个 Chrome 扩展，可以在浏览 YouTube 视频时自动在页面右侧推荐列表上方展示对应的 YouTubeGist 页面，同时保留原有的弹出窗口功能。

## 功能
- 在 YouTube 视频页面右侧推荐区域嵌入面板，自动展开并加载对应的 YouTubeGist 页面。
- 面板默认展开，点击顶部 "YouTubeGist" 按钮可折叠或重新展开内容，并会记住上一次的展开状态。
- 面板支持关闭，关闭后在当前视频停留时不再自动出现，切换到新视频会重新显示。
- 点击工具栏图标，可在弹出窗口中获取对应的 YouTubeGist 链接并在新标签页打开。

## 使用方式
1. 在 Chrome 中打开 `chrome://extensions/` 页面，右上角开启“开发者模式”。
2. 选择“加载已解压的扩展程序”，并指向本仓库下的 `extension` 目录。
3. 打开任意 YouTube 视频页面，点击工具栏中的扩展图标，即可在弹窗中获取并打开对应的 YouTubeGist 链接。

## 自定义
默认的 YouTubeGist 链接基于 `https://www.youtubegist.com/watch?v=`。若实际的站点路径不同，可修改 `extension/popup.js` 和 `extension/content.js` 首行的 `GIST_BASE_URL` 常量。

## 开发说明
- 扩展使用 Manifest V3。
- 弹出窗口逻辑位于 `extension/popup.js`。
- 在页面注入的侧边面板逻辑位于 `extension/content.js`。
- 目前没有引入构建工具或依赖，直接编辑文件即可。
