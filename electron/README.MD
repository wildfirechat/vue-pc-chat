# Electron依赖
打包时需要下载electron发布的版本，默认是从github上electron的release中下载。由于国内很多网络国际出口太窄，经常会下载超时。如果您在国内无法编译，可以使用我们下载好的依赖版本。

## Windows
下载[windows_electron_deps_v13.6.9.zip](https://media.wfcoss.cn/firechat/windows_electron_deps_v13.6.9.zip)，解压到```C:\Users\%{当前用户名}%\AppData\Local\```目录下，解压会解压出```electron```和```electron-builder```两个目录。如果这两个目录已经存在，可以直接覆盖。放置electron依赖后，请再次运行打包命令查看是否起作用。

## Mac
下载[darwin_electron_deps_v13.6.9.tar.gz](https://media.wfcoss.cn/firechat/darwin_electron_deps_v13.6.9.tar.gz)文件，解压到```~/Library/Caches/```目录下，解压会解压出```electron```和```electron-builder```两个目录。如果这两个目录已经存在，可以直接覆盖。放置electron依赖后，请再次运行打包命令查看是否起作用。

## Linux
根据当前Linux平台的架构，请下载[linux_electron_deps_v13.6.9.tar.gz](https://media.wfcoss.cn/firechat/linux_electron_deps_v13.6.9.tar.gz)，x86和arm64架构都是这个依赖，解压到```~/.cache/```目录下，解压会解压出```electron```和```electron-builder```两个目录。如果这两个目录已经存在，可以直接覆盖。放置electron依赖后，请再次运行打包命令查看是否起作用。
