/**
 * 应用入口
 *
 * @author : sunkeysun
 */

import Kernel from 'inventor/web'
import App from '<-sharedPath->/app/<-appName->/App'
import reducers from '<-sharedPath->/app/<-appName->/redux'
import webpackConfig from '<-webpackPath->/config/common'
import appConfig from '<-sharedPath->/common/config/app'

const kernel = new Kernel({ webpackConfig, appConfig, App, reducers })
kernel.run()
