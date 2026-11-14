# vendor/dsh-plugin

`@wildfirechat/dsh-wildfire` 0.2.2 的源码与打包产物，来自
`robot-gateway/dsh-plugin.js`（与源码仓库同一份构建）。

| 路径 | 内容 |
|---|---|
| `dsh-plugin/` | 源码（`src/`）+ 编译产物（`dist/`）+ `package.json` / `tsconfig.json` / README |
| `wildfirechat-dsh-wildfire-0.2.2.tgz` | `npm pack` 生成的安装包（dist + README） |
| `wildfirechat-dsh-wildfire-0.2.2-src.tar.gz` | 含 `src/` 的源码包 |

构建脚本 `scripts/prepare-dsh-runtime.js` 的插件来源优先级：

1. `DSH_PLUGIN_SOURCE` 环境变量；
2. 同级仓库 `../robot-gateway/dsh-plugin.js`（存在 `dist/index.js` 时）；
3. 本目录的 `vendor/dsh-plugin`（脱离 robot-gateway 也能构建）。

同步方式（在 vue-pc-chat 根目录执行）：

```bash
rsync -a --delete ../robot-gateway/dsh-plugin.js/{src,dist,package.json,tsconfig.json,README.md} vendor/dsh-plugin/
cp ../robot-gateway/dsh-plugin.js/wildfirechat-dsh-wildfire-0.2.2.tgz vendor/
tar -czf vendor/wildfirechat-dsh-wildfire-0.2.2-src.tar.gz \
  --exclude='dsh-plugin.js/node_modules' --exclude='dsh-plugin.js/*.tgz' \
  -C .. dsh-plugin.js
```
