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
import OptimizeCssAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import CleanWebpackPlugin from 'clean-webpack-plugin'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
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
    _appName = ''
    _viewEngine = ''

    constructor({ basePath, publicPath, viewEngine, buildMode='release', exposeRoot='__INVENTOR_EXPOSE__' }) {
        this._basePath = basePath
        this._buildMode = buildMode === 'release' ? 'release' : 'debug'
        this._publicPath = publicPath + '/'
        this._exposeRoot = exposeRoot

        const ViewEngine = require(`inventor-view-${viewEngine}/web`).default()
        this._viewEngine = new ViewEngine()
    }

    get _webPath() {
        return `${this._basePath}/web`
    }

    get _buildPath() {
        return `${this._basePath}/build`
    }

    get _sharedPath() {
        return `${this._basePath}/shared`
    }

    get _webpackPath() {
        return `${this._basePath}/webpack`
    }

    get _configPath() {
        return `${this._webpackPath}/config`
    }

    get _outputPath() {
        return `${this._buildPath}/web/${this._buildMode}`
    }

    get _entryDir() {
        return path.resolve(__dirname, 'tmp')
    }

    get _moduleConfig() {
        const moduleConfig = require(`${this._configPath}/modules`)
        return moduleConfig
    }

    get _vendorExternals() {
        const vendorConfig = this._moduleConfig.vendor
        const vendorExternals = _.reduce(vendorConfig.expose, (result, vendor, exposeName) => {
            return {
                ...result,
                [this._getPkg(vendor, 'name')]: `${this._exposeRoot}.vendor.${exposeName}`,
            }
        }, {})

        return vendorExternals
    }

    get _commonExternals() {
        const commonConfig = this._moduleConfig.common
        const commonExternals = _.reduce(commonConfig.expose, (result, common, exposeName) => {
            return {
                ...result,
                [this._getPkg(common, 'name')]: `${this._exposeRoot}.common.${exposeName}`,
            }
        }, {})

        return commonExternals
    }

    _getPkg(pkg, props) {
        return !!_.isString(pkg) ? pkg : pkg[props]
    }

    _ifRelease(release, debug) {
        return this._buildMode === 'release' ? release : debug
    }

    _getTemplate(config) {
        const webpackConfig = {
            mode: this._ifRelease('production', 'development'),
            name: config.name,
            entry: config.entry,
            output: {
                filename: this._ifRelease('[name].[chunkhash].js', '[name].js'),
                path: this._outputPath,
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
                        test: /(\/web\/vendor|node_module).*?\.(less|css)$/,
                        use: ExtractTextPlugin.extract({
                            fallback: 'style-loader',
                            use: [
                                'css-loader',
                                {
                                    loader: 'postcss-loader',
                                    options: {
                                        plugins: [
                                            autoprefixer(),
                                        ],
                                    },
                                },
                                {
                                    loader: 'less-loader',
                                    options: {
                                        javascriptEnabled: true,
                                    },
                                },
                            ],
                        }),
                    },
                    {
                        test: /\/shared\/.*?\.css$/,
                        exclude: /(web\/vendor|node_module)/,
                        use: ExtractTextPlugin.extract({
                            fallback: 'style-loader',
                            use: [
                                'css-loader',
                                {
                                    loader: 'postcss-loader',
                                    options: {
                                        plugins: [
                                            autoprefixer(),
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
            ],
            resolve: {
                extensions: [
                    '.js',
                    '.jsx',
                    '.json',
                ],
                alias: _.get(config, 'alias', {}),
            },
        }

        if (!!config.moduleName) {
            webpackConfig.moduleName = config.moduleName
        }

        if (!!config.rules) {
            webpackConfig.module.rules = webpackConfig.module.rules.concat(config.rules)
        }

        if (!!config.externals) {
            webpackConfig.externals = _.extend({}, webpackConfig.externals, config.externals)
        }

        if (!!config.plugins) {
            webpackConfig.plugins = webpackConfig.plugins.concat(config.plugins)
        }

        if (this._ifRelease('release', 'debug') === 'release') {
            webpackConfig.plugins.push(new OptimizeCssAssetsPlugin())
            webpackConfig.plugins.push(
                new CleanWebpackPlugin(config.outputDir, {
                    root: path.resolve(this._buildPath, `web/${this._buildMode}/`),
                })
            )

            webpackConfig.plugins.unshift(new HashOutput())
        } else {
            webpackConfig.devtool = 'cheap-module-eval-source-map'
            webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin())
        }
        return webpackConfig
    }

    get _appTemplate() {
        const appConfig = this._moduleConfig.app
        const appNames = _.keys(appConfig.modules)
        const prefixApp = `${appConfig.ename}`

        const configList = _.map(appNames, (appName) => {
            const outputName = `${prefixApp}/${appName}/index`
            const entryPath = path.resolve(this._entryDir, `entry-app-${appName}.js`)

            this._createAppEntryFile(appName, entryPath)

            return {
                entry: { [outputName]: [ entryPath ] },
                name: _.get(appConfig, `${appName}.name`, ''),
                moduleName: `${prefixApp}`,
                plugins: [
                    new HtmlWebpackPlugin({
                        chunks: [ outputName ],
                        filename: path.resolve(this._sharedPath, `${prefixApp}/addon/__build.jsx`),
                        template: path.resolve(__dirname, 'addon.tpl'),
                        inject: false,
                    }),
                ],
                outputDir: `${prefixApp}`,
                externals: _.extend({}, this._vendorExternals, this._commonExternals)
            }
        })

        const template = _.map(configList, (config) => this._getTemplate(config))

        return template
    }

    get _commonTemplate() {
        const commonConfig = this._moduleConfig.common
        const outputName = `${commonConfig.ename}/common`
        const entryPath = path.resolve(this._entryDir, `entry-common.js`)

        this._createLibEntryFile(entryPath, 'common')

        const config = {
            entry: { [outputName]: [ entryPath ] },
            name: commonConfig.name,
            moduleName: 'common',
            plugins: [
                new HtmlWebpackPlugin({
                    chunks: [ outputName ],
                    filename: path.resolve(this._sharedPath, `${commonConfig.ename}/addon/__build.jsx`),
                    template: path.resolve(__dirname, 'addon.tpl'),
                    inject: false,
                }),
            ],
            outputDir: 'common',
            externals: this._vendorExternals,
        }

        const template = this._getTemplate(config)
        return template
    }

    get _vendorTemplate() {
        const vendorConfig = this._moduleConfig.vendor
        const outputName = `${vendorConfig.ename}/vendor`
        const entryPath = path.resolve(this._entryDir, 'entry-vendor.js')

        this._createLibEntryFile(entryPath, 'vendor')

        const config = {
            name: vendorConfig.name,
            moduleName: 'vendor',
            entry: { [outputName]: [ entryPath ] },
            plugins: [
                new HtmlWebpackPlugin({
                    chunks: [ outputName ],
                    filename: path.resolve(this._sharedPath, `${vendorConfig.ename}/addon/__build.jsx`),
                    template: path.resolve(__dirname, 'addon.tpl'),
                    inject: false,
                }),
            ],
            outputDir: 'vendor',
        }

        const template = this._getTemplate(config)
        return template
    }

    _checkCreateDir(dir) {
        if (!fs.existsSync(dir)) {
            return fs.mkdirSync(dir)
        }

        return true
    }

    _createAppEntryFile(appName, entryPath) {
        const appConfig = this._moduleConfig.app
        const appPath = `${this._sharedPath}/${appConfig.ename}/${appName}`
        const webPath = this._webPath

        const entryContent = this._viewEngine.getAppEntry({ appPath, webPath })

        fs.writeFileSync(entryPath, entryContent)
    }

    _createLibEntryFile(entryPath, moduleName) {
        const moduleConfig = this._moduleConfig[moduleName]

        this._checkCreateDir(path.dirname(entryPath))

        let tplContent = fs.readFileSync(path.resolve(__dirname, 'libEntry.tpl'), 'utf-8')

        let requireArr = _.map(_.get(moduleConfig, 'preLoad', []), (entry) => `require('${entry}')`)

        requireArr = requireArr.concat(
                        _.map(moduleConfig.expose, (pkg, exposeName) => `_.set(window, '${this._exposeRoot}.${moduleName}.${exposeName}', require('${this._getPkg(pkg, 'entry')}'))`)
                    )

        tplContent = tplContent.replace(/<-importExtra->/g, requireArr.join('\n'))

        fs.writeFileSync(entryPath, tplContent)
    }

    getTemplate({ modules }) {
        const vendorTemplate = this._vendorTemplate
        const commonTemplate = this._commonTemplate
        const appTemplate = this._appTemplate

        let templates = [ vendorTemplate, commonTemplate ].concat(appTemplate)

        if (!!modules.length) {
            templates = _.filter(templates, (template) => !!~modules.indexOf(template.moduleName))
        }

        const targetModules = _.map(templates, (template) => template.moduleName)

        console.log('=========================================================')
        console.log(`Target build modules => ${JSON.stringify(targetModules)}`)
        console.log('=========================================================')

        _.each(templates, (template) => _.unset(template, 'moduleName'))

        return templates
    }

    getDevTemplate({ modules }) {
        const appEntry = _.reduce(this._appTemplate, (result, template) => {
            if (!modules.length || !!~modules.indexOf(template.moduleName)) {
                return {
                    ...result,
                    ...template.entry,
                }
            }
            return result
        }, {})

        const config =  {
            name: 'dev',
            entry: _.extend(
                {},
                this._vendorTemplate.entry,
                this._commonTemplate.entry,
                appEntry
            ),
            alias: _.reduce(this._moduleConfig.common.expose, (result, common, commonName) => {
                return {
                    ...result,
                    [common.name]: common.entry,
                }
            }, {})
        }

        const template = this._getTemplate(config)

        template.optimization = {
            splitChunks: {
                cacheGroups: {
                    default: false,
                    common: {
                        chunks: 'all',
                        test: /[\\/]shared[\\/]common[\\/]/,
                        name: 'common/common',
                        priority: 2,
                    },
                    vendor: {
                        chunks: 'all',
                        test: /[\\/]node_modules[\\/]|[\\/]vendor[\\/]/,
                        name: 'vendor/vendor',
                        priority: 1,
                    },
                },
            },
        }

        return template
    }
}
