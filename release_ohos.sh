cp src/wfc/av/internal/engine-conference.min.js src/wfc/av/internal/engine.min.js

# 打包mac版本
npm run package

# 替换应用图标
cp public/images/icon.png ../hm-pc-chat/AppScope/resources/base/media/app_icon.png
cp public/images/icon.png ../hm-pc-chat/AppScope/resources/base/media/startIcon.png

# 删除默认 app
rm -rf ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app
mkdir ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app

# 拷贝 app.asar
cp ./dist_electron/mac-universal/野火IM.app/Contents/Resources/app.asar ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app/
cd ../hm-pc-chat/web_engine/src/main/resources/resfile/resources/app/

# 解压
asar extract app.asar .

# 删除无用文件，降低体积
rm  -f marswrapper.node app.asar

# 修复 preload.js 加载错误，将记载路径从 app.asar/preload.js 修改为 app/preload.js
sed -i.bak 's/app\.asar/app/g' js/* && rm -f js/*.bak

cd -
cd ../hm-pc-chat

git clean -f -d web_engine/src/main/resources/resfile/resources/app/node_modules/electron-screenshots
git clean -f -d web_engine/src/main/resources/resfile/resources/app/node_modules/fs-extra
git clean -f -d web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots
git clean -f -d web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots-openharmony-arm64
git clean -f -d web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots-darwin-arm64
git clean -f -d web_engine/src/main/resources/resfile/resources/app/node_modules/react-screenshots

git checkout -- web_engine/src/main/resources/resfile/resources/app/node_modules/electron-screenshots
git checkout -- web_engine/src/main/resources/resfile/resources/app/node_modules/fs-extra
git checkout -- web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots
git checkout -- web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots-openharmony-arm64
git checkout -- web_engine/src/main/resources/resfile/resources/app/node_modules/node-screenshots-darwin-arm64
git checkout -- web_engine/src/main/resources/resfile/resources/app/node_modules/react-screenshots






