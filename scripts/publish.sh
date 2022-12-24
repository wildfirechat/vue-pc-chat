#!/bin/sh
echo ''
echo '-------'
echo '请在script目录执行'
echo '-------'
echo ''

cd ..
sed -i '' 's/ENABLE_PTT = false/ENABLE_PTT = true/' src/config.js
cp src/wfc/av/internal/engine-conference.min.js src/wfc/av/internal/engine.min.js

# 打包所有
/bin/rm -rf dist_electron
npm run cross-package-all
