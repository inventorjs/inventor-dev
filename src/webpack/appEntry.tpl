/**
 * 应用入口
 *
 * @author : sunkeysun
 */

import Kernel from 'inventor/web'
import App from '<-sharedPath->/app/<-appName->/App'
import Store from '<-sharedPath->/app/<-appName->/store'
import webpackConfig from '<-webpackPath->/config/common'
import appConfig from '<-sharedPath->/app/<-appName->/config/app'

const kernel = new Kernel({ webpackConfig, appConfig, App, Store })
kernel.run()
