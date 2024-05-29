# v8-hot-reload-kit

各种v8环境（nodejs，chrome，puerts等等）代码运行时热刷新。

## 安装

```bash
npm install v8-hot-reload-kit
```

## watch命令

功能：监听本地一个目录，如果目录下的.js, .mjs文件发生变化，远程刷新v8环境代码

### nodejs案例

* 运行nodejs测试脚本，打开在9222端口打开inspect功能

```bash
node --inspect=9222 test/node-test/test.js
```

* 用v8-hot-reload-kit的watch命令监听`test/node-test/`目录

```bash
npx v8-hot-reload-kit watch test/node-test
```

* 接着你可以修改`test/node-test/`下的js文件看测试脚本的屏幕输出

* v8-hot-reload-kit对比`node --watch`

  - `node --watch`会重启脚本，一些upvalue会重置，v8-hot-reload-kit
  - 以`test/node-test/test.js`为例，用`node --watch test/node-test/test.js`运行，修改test.js，计数器i变量会重置，用v8-hot-reload-kit则不重置

### chrome案例

* 找到你系统chrome的可执行程序目录，打开命令行/终端执行如下命令：

```bash
chrome --remote-debugging-port=9223
```

注意：执行如上命令前需要关闭系统所有chrome实例。

如上命令启动的chrome在9223端口开启了远程调试功能。

* 启动http服务器，根目录为`test\browser-test`，端口为8081

```bash
npm install http-server
npx http-server test/browser-test -p 8081
```

* 在前面启动的chrome浏览器中输入地址 `http://127.0.0.1:8081/` 浏览我们的测试页面

* 用v8-hot-reload-kit的watch命令监听`test/browser-test/`目录，并指明远程端口为9223

```bash
npx v8-hot-reload-kit watch test/browser-test -p 9223
```

* 修改`test/browser-test/test.js`，观察chrome页面的修改效果

### puerts编辑器案例

* puerts的实例启动时指定远程调试端口，假设端口为8080
  - unreal engine下在FJsEnv的构造函数中指定
  - unity下在Puerts.JsEnv构造函数中指定

* 用v8-hot-reload-kit的watch命令监听js加载目录的根目录，`path/to/your/puerts/js/root`目录，并指明远程端口为8080

```bash
npx v8-hot-reload-kit watch path/to/your/puerts/js/root -p 8080
```

* 修改ts代码，手动或者watch自动编译后看编辑器效果

### puerts真机案例

* 注意！puerts出于安全考虑，真机默认不开启远程调试功能，需要手动开启
  - unreal engine下在JsEnv.build.cs文件在ThirdParty函数中加入`PrivateDefinitions.Add("WITH_INSPECTOR");`
  - unity在`puerts/unity/native_src/CMakeLists.txt`加入`list(APPEND PUERTS_COMPILE_DEFINITIONS WITH_INSPECTOR)`，并重新构建Plugins

* puerts的实例启动时指定远程调试端口，假设端口为8080
  - unreal engine下在FJsEnv的构造函数中指定
  - unity下在Puerts.JsEnv构造函数中指定

* 用v8-hot-reload-kit的watch命令监听js加载目录的根目录，`/path/to/your/local/js/root`目录，并指明远程端口为8080，指明远程js根目录`/path/to/your/remote/js/root`

```bash
npx v8-hot-reload-kit watch path/to/your/puerts/js/root -p 8080 -r /path/to/your/remote/js/root
```

小技巧：如果不知道远程js跟目录，可以不输入远程js根目录，然后加-v （verbose）参数：

```bash
npx v8-hot-reload-kit watch path/to/your/puerts/js/root -p 8080 -v
```

会有类似这样的日志：

```bash
/js/Gamescripts/Form/Main/MailFormLogic.mjs loaded, id: 351
/js/Gamescripts/Logic/Shop.mjs loaded, id: 352

...

```

观察这些日志我们可以总结出远程js根目录为`/js/Gamescripts`

* 修改ts代码，手动或者watch自动编译后看编辑器效果
