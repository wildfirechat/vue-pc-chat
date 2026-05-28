## 打包 kylin 应用商店版本说明

1. 只支持在 Linux amd64 环境打包
2. shell 需要用 bash
3. 执行`npm run pacakge`或`npm run cross-package-linux-arm64` 打出普通的 deb 包
4. 执行`release_kylin_store.sh` 转换成 kylin 应用商店支持的 deb 包
5. 如果还需要转 ok（开明）包的话，需要将本脚本打包的出来的 deb 分别拷贝到kylin v11 amd64 和 arm64 环境，然后执行
```angular2html
sudo debtokaiming ./xxx.deb
```

## 其他说明
1. 开明包安装后，可执行文件路径时`/var/opt/kaiming/bin/野火IM`，可命令行下启动，来调试问题