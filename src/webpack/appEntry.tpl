/**
 * 应用入口
 *
 * @author : sunkeysun
 */

import Kernel from 'inventor/web'
import App from '<-appPath->/App'
import reducers from '<-appPath->/redux'
import webpackConfig from '<-webpackPath->/config'
import appConfig from '<-sharedPath->/common/config/app'

const kernel = new Kernel({ webpackConfig, appConfig, App, reducers })
kernel.run()
