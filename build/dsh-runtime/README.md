# DSH runtime（打包时生成）

`build/dsh-runtime/{node,dsh,profile,VERSION}` 由脚本生成，已 gitignore：

```bash
npm run prepare-dsh-runtime
```

源：

- Node: 当前 node（>=22.19）或 `DSH_NODE_BINARY`
- DSH: `DSH_SOURCE` 或 `npm root -g` 下的 `@deepseek-ai/dsh`
- Profile: `DSH_PROFILE_SOURCE` 或 `~/.dsh/profiles/wildfire`

脚本会把本地 `../robot-gateway/dsh-plugin.js/dist` 覆盖进 bundled profile，避免旧插件。

运行时时 Host 会：

1. 使用 `resources/dsh-runtime/node` + `dsh/lib/bin.js` 启动；
2. 首次把 `resources/dsh-runtime/profile` 复制到 `userData/dsh-home/profiles/wildfire`；
3. 设置 `DSH_HOME=userData/dsh-home`，不依赖宿主机 `~/.dsh`。

发布注意：

- 每个目标平台/架构在对应平台生成 runtime（不能用 macOS 的 Node 打 Windows 包）。
- macOS 需要对 Node 二进制和所有 `.node` 文件签名/公证；否则 `codesign --deep --strict` 会失败。
- runtime 约 620MB，安装包会相应变大。
