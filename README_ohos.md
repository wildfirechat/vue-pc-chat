## 原生鸿蒙打包说明

### 前置说明
1. 鸿蒙版 PC SDK 是需要付费的，请联系官方
2. 仅支持在`macOS`或`amd64 Linux`系统交叉打包

### 安装依赖
1. 执行`npm ci`安装依赖
2. 执行`npm install --engine-strict @electron/asar`安装`asar`解压工具
3. 下载适配鸿蒙的 Electron 版本，下载地址请参考[这儿](https://gitcode.com/openharmony-sig/electron/issues/48)，目前仅支持 `v34.x`版本，`v37`版本暂不支持
4. 下载完后，解压到`vue-pc-chat`同级目录，为了后续操作方便，改名为`libelectron_v34`

### 编译及拷贝资源等
```angular2html
# 进入项目目录
cd vue-pc-chat

# 交叉打包linux arm64 版本
npm run cross-package-linux-arm64

# 替换应用图标
cp public/images/icon.png ../libelectron_v34/ohos_hap/AppScope/resources/base/media/app_icon.png
cp public/images/icon.png ../libelectron_v34/ohos_hap/AppScope/resources/base/media/startIcon.png

# 删除默认 app
rm -rf ../libelectron_v34/ohos_hap/web_engine/src/main/resources/resfile/resources/app
mkdir ../libelectron_v34/ohos_hap/web_engine/src/main/resources/resfile/resources/app

# 拷贝 app.asar
cp ./dist_electron/linux-arm64-unpacked/resources/app.asar ../libelectron_v34/ohos_hap/web_engine/src/main/resources/resfile/resources/app/
cd ../libelectron_v34/ohos_hap/web_engine/src/main/resources/resfile/resources/app/

# 解压
asar extract app.asar .

# 删除无用文件，降低体积
rm  -f marswrapper.node app.asar

# 修复 preload.js 加载错误，将记载路径从 app.asar/preload.js 修改为 app/preload.js
sed -i.bak 's/app\.asar/app/g' js/* && rm -f js/*.bak

```

### DevEco Studio 完成最终的打包操作
1. 用`DevEco Studio` 打开`libelectron_v34/ohos_hap` 项目
2. 修改`AppScope/app.json5`里面的`bundleName`、`vendor`等信息
3. 修改`AppScope/resources/base/element/string.json`里面的`value`，别修改`name`，修改的是`value`
4. 配置签名，然后直接运行或打包

### 参考
[ohos_electron](https://gitcode.com/openharmony-sig/electron#hap%E5%8C%85%E6%9E%84%E5%BB%BA%E4%B8%8E%E4%BD%BF%E7%94%A8)