/**
 * webpack 配置类
 *
 * @author : sunkeysun
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import _ from 'lodash'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import CleanWebpackPlugin from 'clean-webpack-plugin'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
import FileManagerPlugin from 'filemanager-webpack-plugin'
import autoprefixer from 'autoprefixer'
import ProgressBarPlugin from 'progress-bar-webpack-plugin'
import HappyPack from 'happypack'
import HashOutput from 'webpack-plugin-hash-output'

const happyThreadPool = HappyPack.ThreadPool({ size: os.cpus().length })

const allChunks = []

export default class WebpackConfigure {
    _basePath = ''
    _buildMode = ''
    _publicPath = ''
    _vendorEntryPath = ''
    _appName = ''

    constructor({ basePath, publicPath, buildMode='release', appName='' }) {
        this._basePath = basePath
        this._buildMode = buildMode === 'release' ? 'release' : 'debug'
        this._publicPath = publicPath + '/'
        this._vendorEntryPath = path.resolve(this.webPath, 'vendor/__vendor.js')
        this._appName = appName
    }

    get webPath() {
        return `${this._basePath}/web`
    }

    get buildPath() {
        return `${this._basePath}/build`
    }

    get sharedPath() {
        return `${this._basePath}/shared`
    }

    get webpackPath() {
        return `${this._basePath}/webpack`
    }

    get configPath() {
        return `${this.webPath}/config`
    }

    get buildMode() {
        return this._buildMode
    }

    _ifRelease(release, debug) {
        return this.buildMode === 'release' ? release : debug
    }

    _template() {
        const outputPath = `${this.buildPath}/web/${this.buildMode}`
        const appConfig = this._getAppsConfig()
        const vendorConfig = require(`${this.configPath}/vendor`).default

        let webpackConfig = {
            mode: this._ifRelease('development', 'development'),
            name: 'inventor',
            entry: appConfig.entry,
            output: {
                filename: this._ifRelease('[name].[chunkhash].js', '[name].js'),
                path: outputPath,
                publicPath: this._publicPath,
            },
            module: {
                rules: [
                    {
                        test: /package\.json$/,
                        use: [
                            {
                                loader: 'package-json-cleanup-loader',
                                options: {
                                    only: [ 'name', 'version' ],
                                },
                            },
                        ],
                    },
                    {
                        test: /\.jsx?$/,
                        use: [
                            'happypack/loader?id=babel',
                        ],
                        exclude: /node_modules/,
                    },
                    {
                        test: /(vendor|node_module).*?\.(less|css)$/,
                        use: ExtractTextPlugin.extract({
                            fallback: 'style-loader',
                            use: [
                                'css-loader',
                                {
                                    loader: 'postcss-loader',
                                    options: {
                                        plugins: [
                                            autoprefixer,
                                        ],
                                    },
                                },
                                'less-loader',
                            ],
                        }),
                    },
                    {
                        test: /\.css$/,
                        exclude: /(vendor|node_module)/,
                        use: ExtractTextPlugin.extract({
                            fallback: 'style-loader',
                            use: [
                                {
                                    loader: 'css-loader',
                                    query: {
                                        module: true,
                                        localIdentName: '[path][name]__[local]',
                                    }
                                },
                                {
                                    loader: 'postcss-loader',
                                    options: {
                                        plugins: [
                                            autoprefixer,
                                        ],
                                    },
                                },
                            ],
                        }),
                    },
                    {
                        test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/,
                        use: [
                            {
                                loader: 'url-loader',
                                query: {
                                    limit: 1,
                                    name: 'resources/[name].[ext]?[hash]',
                                }
                            },
                        ],
                    }
                ],
            },
            optimization: {
                splitChunks: {
                    cacheGroups: {
                        default: false,
                        common: {
                            chunks: 'all',
                            test: (module, chunks) => {
                                if (!!_.startsWith(module.context, `${this.sharedPath}/common`)) {
                                    return true
                                }
                                return false
                            },
                            name: 'common/common',
                            priority: -1,
                        },
                        vendor: {
                            chunks: 'all',
                            test: (module, chunks) => {
                                if (!!_.startsWith(module.context, `${this._basePath}/node_modules`)
                                    || _.startsWith(module.context, `${this.webPath}/vendor`)) {
                                    return true
                                }
                                return false
                            },
                            name: 'vendor/vendor',
                            priority: -2,
                        },
                    },
                },
            },
            plugins: [
                new ProgressBarPlugin(),
                new HappyPack({
                    id: 'babel',
                    loaders: ['babel-loader'],
                    threadPool: happyThreadPool,
                }),
                new ExtractTextPlugin({
                    filename: this._ifRelease('[name].[md5:contenthash:hex:20].css', '[name].css'),
                    allChunks: true,
                }),
                new HtmlWebpackPlugin({
                    chunks: [ 'common/common' ],
                    filename: path.resolve(this.sharedPath, 'common/addon/__build.jsx'),
                    template: path.resolve(__dirname, 'addon.tpl'),
                    inject: false,
                }),
                new HtmlWebpackPlugin({
                    chunks: [ 'vendor/vendor' ],
                    filename: path.resolve(this.sharedPath, 'vendor/addon/__build.jsx'),
                    template: path.resolve(__dirname, 'addon.tpl'),
                    inject: false,
                }),
            ],
            resolve: {
                extensions: [
                    '.js',
                    '.jsx',
                    '.json',
                ]
            },
        }

        webpackConfig.plugins = webpackConfig.plugins.concat(appConfig.plugins)

        if (this._ifRelease('release', 'debug') === 'release') {
            const cleanDirs = appConfig.output.concat(['common', 'vendor'])
            webpackConfig.plugins.push(
                new CleanWebpackPlugin(cleanDirs, {
                    root: path.join(this.buildPath, `/web/${this.buildMode}/`),
                })
            )

            webpackConfig.plugins.push(new HashOutput())

            webpackConfig.plugins.push(
                new webpack.HashedModuleIdsPlugin({
                    hashFunction: 'md5',
                    hashDigest: 'hex',
                    hashDigestLength: 16,
                })
            )
        } else {
            webpackConfig.devtool = 'cheap-module-eval-source-map'
            webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin())
        }

        return webpackConfig
    }

    _createEntryFile(appName, entryPath) {
        const vendorConfig = require(`${this.configPath}/vendor`).default
        const commonConfig = require(`${this.configPath}/common`).default
        const appsConfig = require(`${this.configPath}/apps`).default
        const appConfig = _.get(appsConfig, appName, {})

        let tplContent = fs.readFileSync(path.resolve(__dirname, 'entry.tpl'), 'utf-8')

        const vendorImportExtra = _.map(vendorConfig.importExtra, (item, index) => `import '${item}'`)
        const commonImportExtra = _.map(commonConfig.importExtra, (item, index) => `import '${item}'`)
        const appImportExtra = _.map(appConfig.importExtra, (item, index) => `import '${item}'`)
        const importExtra = _.uniq(vendorImportExtra.concat(commonImportExtra).concat(appImportExtra)).join('\n')

        tplContent = tplContent.replace(/<-appName->/g, appName)
                               .replace(/<-importExtra->/g, importExtra)
                               .replace(/<-sharedPath->/g, this.sharedPath)
                               .replace(/<-webPath->/g, this.webPath)
                               .replace(/<-webpackPath->/g, this.webpackPath)

        fs.writeFileSync(entryPath, tplContent)
    }

    _getAppsConfig() {
        const appsConfig = require(`${this.configPath}/apps`).default
        const apps = !!this._appName ? [this._appName] : _.keys(appsConfig)
        let entry = {}
        let plugins = []
        let output = []

        _.each(apps, (appName) => {
            const config = _.extend({}, appsConfig.common, appsConfig[appName])
            const outputName = `apps/${appName}/index`
            const entryPath = path.resolve(this.webPath, `apps/__${appName}.js`)
            entry[outputName] = [ entryPath ]

            plugins.push(
                new HtmlWebpackPlugin({
                    chunks: [ outputName ],
                    filename: path.resolve(this.sharedPath, `apps/${appName}/addon/__build.jsx`),
                    template: path.resolve(__dirname, 'addon.tpl'),
                    inject: false,
                }),
            )

            output.push(`apps/${appName}/`)

            this._createEntryFile(appName, entryPath)
        })

        return {
            entry,
            plugins,
            output,
        }
    }

    getTemplate() {
        const template = this._template()

        return template
    }
}
