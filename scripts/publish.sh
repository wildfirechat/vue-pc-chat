#!/bin/sh
echo ''
echo '-------'
echo '请在script目录执行'
echo '-------'
echo ''

cd ..
echo 'enable ptt'
sed -i '' 's/ENABLE_PTT = false/ENABLE_PTT = true/' src/config.js
echo 'enable conference'
cp src/wfc/av/internal/engine-conference.min.js src/wfc/av/internal/engine.min.js

# 打包所有
/bin/rm -rf dist_electron
npm run cross-package-all

echo 'checkout modification'
git checkout -- src/wfc/av/internal/engine.min.js
git checkout -- src/config.js
