本目录下为远程控制功能

远程控制默认禁用，如果需要启用的话
1. 需要高级版音视频 SDK 才支持，并且专业版 im-server 需要打开远程协助功能开关
2. `background.js` 里面，将下面两行取消注释：
   ```js
   import rcProto from '../rc.node';
   initRCMain(rcProto);

   ```