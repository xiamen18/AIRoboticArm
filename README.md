# NMR 自动化送样系统通信调试台

基于 Electron、React、TypeScript 的 Windows 上位机 Demo。软件作为 TCP Client 连接设备 TCP Server，完整覆盖协议 V0.1 的 25 条命令。

## 环境

- Windows 10/11 x64
- Node.js 20 或更高版本
- npm 10 或更高版本

## 启动

```powershell
npm install
npm run dev
```

开发模式会同时启动 Vite 和 Electron。默认连接地址为 `127.0.0.1:5001`，地址不会持久化。

## 验证

```powershell
npm run typecheck
npm test
npm run build
```

## 构建 Windows 绿色版

打包电脑首次准备依赖：

```powershell
npm install
```

生成 Windows x64 单文件绿色版：

```powershell
npm run dist:portable
```

产物位于 `release` 目录，文件名类似
`NMR自动送样通信调试台-0.1.0-win-x64-portable.exe`。将这个 `.exe` 直接拷贝到
Windows 10/11 x64 电脑即可双击运行；目标电脑无需安装 Node.js，也无需执行
`npm install`。首次启动时，Windows SmartScreen 可能提示“未知发布者”，选择
“更多信息”后再选择“仍要运行”。

## 通信行为

- 发出 JSON 后统一追加 `\r\n`。
- 接收按 `\n` 拆包，并兼容移除帧尾 `\r`。
- 同一连接只允许一条在途请求。
- 响应超时可在连接前配置，默认 5 秒；不自动重试，不自动发送心跳。
- 响应必须同时匹配请求的 `cmd` 和 `request_id`。
- 调试日志只保留当前会话，不写入本地文件。

协议依据：[NMR自动化送样系统通信协议.md](./NMR自动化送样系统通信协议.md)。
