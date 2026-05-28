## 原生鸿蒙打包说明

### 前置说明
1. 鸿蒙版 PC SDK 是需要付费的，请联系官方
2. 仅支持在`macOS`或`amd64 Linux`系统交叉打包

### 安装依赖
1. 执行`npm ci`安装依赖
2. 执行`npm install --engine-strict @electron/asar`安装`asar`解压工具
3. 克隆[hm-pc-chat](https://github.com/wildfirechat/hm-pc-chat)到`vue-pc-chat`同级目录

### 编译及拷贝资源等
```angular2html
# 进入项目目录
cd vue-pc-chat

# 交叉打包linux arm64 版本
npm run cross-package-linux-arm64

# 替换应用图标
cp public/images/icon.png ../hm-pc-chat/AppScope/resources/base/media/app_icon.png
cp public/images/icon.png ../hm-pc-chat/AppScope/resources/base/media/startIcon.png

# 删除默认 app
rm -rf ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app
mkdir ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app

# 拷贝 app.asar
cp ./dist_electron/linux-arm64-unpacked/resources/app.asar ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app/
cd ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app/

# 解压
asar extract app.asar .

# 删除无用文件，降低体积
rm  -f marswrapper.node app.asar

# 修复 preload.js 加载错误，将记载路径从 app.asar/preload.js 修改为 app/preload.js
sed -i.bak 's/app\.asar/app/g' js/* && rm -f js/*.bak

```

### 截图
`hm-pc-chat`里面包含的是特殊编译的版本，更新资源后，一定要通过 git 工具，将`screenshots`相关改动，全部丢弃，可能被改动的目录有：
```angular2html
web_engine/src/main/resources/resfile/resources/app/node_modules/electron-screenshots
web_engine/src/main/resources/resfile/resources/app/node_modules/fs-extra
web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots
web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots-darwin-arm64
web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots-openharmony-arm64
web_engine/src/main/resources/resfile/resources/app/node_modules/react-screenshots
```

### DevEco Studio 完成最终的打包操作
1. 用`DevEco Studio` 打开`hm-pc-chat` 项目
2. 修改`AppScope/app.json5`里面的`bundleName`、`vendor`等信息
3. 修改`AppScope/resources/base/element/string.json`里面的`value`，别修改`name`，修改的是`value`
4. 配置签名，然后直接运行或打包

### 参考
[ohos_electron](https://gitcode.com/openharmony-sig/electron#hap%E5%8C%85%E6%9E%84%E5%BB%BA%E4%B8%8E%E4%BD%BF%E7%94%A8)