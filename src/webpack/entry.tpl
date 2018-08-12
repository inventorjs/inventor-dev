/**
 * 应用入口
 *
 * @author : sunkeysun
 */

import '<-webPath->/vendor/__vendor'

<-importExtra->

import Kernel from 'inventor/web'
import App from '<-sharedPath->/apps/<-appName->/App'
import reducers from '<-sharedPath->/apps/<-appName->/redux'
import webpackConfig from '<-webpackPath->/config'
import appConfig from '<-sharedPath->/common/config/app'

const kernel = new Kernel({ webpackConfig, appConfig, App, reducers })
kernel.run()
