// vue.config.js

const CopywebpackPlugin = require('copy-webpack-plugin')
module.exports = {
    publicPath: '.',
    chainWebpack: config => {
        config.module.rules.delete('eslint');
    },

    pluginOptions: {
        chainWebpack: config => {
            // config.module.rules.delete('eslint');
        },
        electronBuilder: {
            externals: ['electron-screenshots'],
            chainWebpackMainProcess: (config) => {
                // Chain webpack config for electron main process only
                config.module
                    .rule('native')
                    .test(/\.node$/)
                    .use('native-ext-loader')
                    .loader('native-ext-loader')
                    .end();
                // config.externals({
                //     'electron-screenshots': 'require("electron-screenshots")'
                // });
                config.plugin('copy').use(CopywebpackPlugin, [
                    [
                        {
                            from: `${__dirname}/public/**/*`,
                            to: `${__dirname}/dist_electron`,
                        },
                    ]
                ]);
            },
            chainWebpackRendererProcess: (config) => {
                // Chain webpack config for electron renderer process only (won't be applied to web builds)
            },
            nodeIntegration: true,
            webSecurity: false,
            // Use this to change the entrypoint of your app's main process
            // mainProcessFile: 'src/myBackgroundFile.js',
            // Use this to change the entry point of your app's render process. default src/[main|index].[js|ts]
            // rendererProcessFile: 'src/myMainRenderFile.js',
            // Provide an array of files that, when changed, will recompile the main process and restart Electron
            // Your main process file will be added by default
            // mainProcessWatch: ['src/myFile1', 'src/myFile2'],
            // Provide a list of arguments that Electron will be launched with during "electron:serve",
            // which can be accessed from the main process (src/background.js).
            // Note that it is ignored when --debug flag is used with "electron:serve", as you must launch Electron yourself
            // Command line args (excluding --debug, --dashboard, and --headless) are passed to Electron as well
            // mainProcessArgs: ['--arg-name', 'arg-value']
            // outputDir: 'release',
            builderOptions: {
              productName: 'wildfirechat',
              appId: 'cn.wildfire.chat',
              compression: 'normal',
              artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
              mac: {
                extendInfo: {
                  NSCameraUsageDescription: "This app requires camera access to record video.",
                  NSMicrophoneUsageDescription: "This app requires microphone access to record audio."
                },
                hardenedRuntime: true,
                gatekeeperAssess: false
              },
              linux: {
                category: "Chat",
                executableName: "wildfireChat",
                target: [
                  'deb',
                  'AppImage'
                ]
              },
              win: {
                target: "nsis",
                requestedExecutionLevel: "asInvoker"
              },
              nsis: {
                oneClick: false,
                allowToChangeInstallationDirectory: true,
                artifactName: '${productName}-${version}-${os}-${arch}-setup.${ext}',
                deleteAppDataOnUninstall: true,
                perMachine: false,
                createDesktopShortcut: true,
                shortcutName: "wildfireChat"
              }
            }
        }
    },
}
