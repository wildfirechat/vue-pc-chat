# vue-pc-chat
野火IM VUE Demo，演示如何将野火IM的能力集成到VUE Electron项目。

## 重要提示
项目在活跃开发中，更完整项目，请参考 [pc-chat](https://github.com/wildfirechat/pc-chat) 。

## 环境依赖
#### mac系统
1. 最新版本的Xcode
2. nodejs 10.16.X
3. npm 6.9.0
4. python 2.7.X
5. git
6. npm install -g node-gyp

#### windows系统
1. nodejs v10.16.x
2. python 2.7.X
3. git
4. npm 6.9.0
5. npm install --global --vs2015 windows-build-tools
6. npm install -g node-gyp
> 第5步安装windows开发环境的安装内容较多，如果网络情况不好可能需要等较长时间，选择早上网络较好时安装是个好的选择

#### linux系统
1. nodejs10.16.X
2. python2.7X
3. git

## 开发
1. ```npm install```
2. ```npm run dev```

## 打包
打包为当前平台架构软件
```
npm run package
```

## 交叉打包
打包为其它平台架构软件
```
#打包windows系统amd64架构
npm run cross-package-win

#打包windows系统x86架构
npm run cross-package-win32

#打包linux系统amd64架构
npm run cross-package-linux

#打包linux系统arm64架构
npm run cross-package-linux-arm64

#打包mac系统amd64架构
npm run cross-package-mac
```

## 截图
![](./image/contact.png)
![](./image/group-conversation-info.png)
![](./image/home.png)
![](./image/picker-user.png)
![](./image/quote.png)
![](./image/sticker.png)


## License

1. Under the Creative Commons Attribution-NoDerivs 3.0 Unported license. See the [LICENSE](https://github.com/wildfirechat/vue-chat/blob/master/LICENSE) file for details.
2. Under the 996ICU License. See the [LICENSE](https://github.com/996icu/996.ICU/blob/master/LICENSE) file for details.
