/**
 * webpack 开发服务器
 *
 * @author : sunkeysun
 */

import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import WebpackConfigure from './Configure'
import _ from 'lodash'

export default class DevServer {
    _server = null
    _serverConfig = null

    constructor({ basePath, publicPath, localWeb, localServer, buildMode, modules, viewEngine } ) {
        const devServer = true
        const configure = new WebpackConfigure({ basePath, publicPath, buildMode, devServer, viewEngine })
        const webpackConfig = configure.getDevTemplate({ modules })

        webpackConfig.entry = _.mapValues(webpackConfig.entry, (val, key) => {
            const newVal = [
                'react-hot-loader/patch',
                'webpack-dev-server/client?http://' + localWeb.host + ':' + localWeb.port + '/',
                'webpack/hot/only-dev-server',
                ...val,
            ]
            return newVal
        })

        const compiler = webpack(webpackConfig)
        this._server = new WebpackDevServer(compiler, {
            hot: true,
            historyApiFallback: true,
            // host: `${localServer.host}:${localServer.port}`,
            port: localServer.port,
            headers: {
                'Access-Control-Allow-Origin': `http://${localServer.host}:${localServer.port}`,
                'Access-Control-Allow-Credentials': true,
            },
            static: {
                publicPath: publicPath+'/',
                watch: {
                    ignored: /node_modules/,
                }
            },
        })

        this._serverConfig = localWeb
    }

    run() {
        if (!this._serverConfig || !this._serverConfig.port || !this._serverConfig.host) {
            throw new Error('devServer "serverConfig" must have valid host and port')
        }
        this._server.listen(this._serverConfig.port)
    }
}
