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

    constructor({ basePath, publicPath, buildMode='release' }) {
        this._basePath = basePath
        this._buildMode = buildMode === 'release' ? 'release' : 'debug'
        this._publicPath = publicPath + '/'
        this._exposeRoot = '__IEXPOSE__'
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
        const moduleConfig = require(`${this._configPath}/module`)
        return moduleConfig
    }

    get _vendorExternals() {
        const vendorConfig = this._moduleConfig.vendor
        const vendorExternals = _.reduce(vendorConfig.expose, (result, vendor, exposeName) => {
            return {
                ...result,
                [vendor.name]: `${this._exposeRoot}.vendor.${exposeName}`,
            }
        }, {})

        return vendorExternals
    }

    get _commonExternals() {
        const commonConfig = this._moduleConfig.common
        const commonExternals = _.reduce(commonConfig.expose, (result, common, exposeName) => {
            return {
                ...result,
                [common.name]: `${this._exposeRoot}.common.${exposeName}`,
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
            moduleName: config.moduleName,
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
                        test: /(vendor|node_module).*?\.(less|css)$/,
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
                        test: /\.css$/,
                        exclude: /(vendor|node_module)/,
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
            webpackConfig.plugins.push(
                new CleanWebpackPlugin(config.outputDir, {
                    root: path.join(this._buildPath, `/web/${this._buildMode}/`),
                })
            )

            webpackConfig.plugins.push(new HashOutput())
        } else {
            webpackConfig.devtool = 'cheap-module-eval-source-map'
            webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin())
        }
        return webpackConfig
    }

    get _appTemplate() {
        const appConfig = this._moduleConfig.app
        const appNames = _.keys(appConfig)

        const configList = _.map(appNames, (appName) => {
            const outputName = `app/${appName}/index`
            const entryPath = path.resolve(this._entryDir, `app-${appName}.js`)

            this._createAppEntryFile(appName, entryPath)

            return {
                entry: { [outputName]: [ entryPath ] },
                name: _.get(appConfig, `${appName}.name`, ''),
                moduleName: `app/${appName}`,
                plugins: [
                    new HtmlWebpackPlugin({
                        chunks: [ outputName ],
                        filename: path.resolve(this._sharedPath, `app/${appName}/addon/__build.jsx`),
                        template: path.resolve(__dirname, 'addon.tpl'),
                        inject: false,
                    }),
                ],
                outputDir: `app/${appName}`,
                externals: _.extend({}, this._vendorExternals, this._commonExternals)
            }
        })

        const template = _.map(configList, (config) => this._getTemplate(config))

        return template
    }

    get _commonTemplate() {
        const outputName = 'common/common'
        const entryPath = path.resolve(this._sharedPath, `common/index.js`)
        const commonConfig = this._moduleConfig.common

        const config = {
            entry: { [outputName]: [ entryPath ] },
            name: commonConfig.name,
            moduleName: 'common',
            plugins: [
                new HtmlWebpackPlugin({
                    chunks: [ outputName ],
                    filename: path.resolve(this._sharedPath, `common/addon/__build.jsx`),
                    template: path.resolve(__dirname, 'addon.tpl'),
                    inject: false,
                }),
            ],
            outputDir: 'common',
            rules: _.map(commonConfig.expose, (pkg, exposeName) => {
                return {
                    test: require.resolve(this._getPkg(pkg, 'entry')),
                    use: [
                        { loader: 'expose-loader', options: `${this._exposeRoot}.common.${exposeName}` },
                    ],
                }
            }),
            externals: this._vendorExternals,
        }

        const template = this._getTemplate(config)
        return template
    }

    get _vendorTemplate() {
        const outputName = 'vendor/vendor'
        const entryPath = path.resolve(this._entryDir, 'vendor.js')
        const vendorConfig = this._moduleConfig.vendor

        this._createVendorEntryFile(entryPath)

        const config = {
            name: vendorConfig.name,
            moduleName: 'vendor',
            entry: { [outputName]: [ entryPath ] },
            plugins: [
                new HtmlWebpackPlugin({
                    chunks: [ outputName ],
                    filename: path.resolve(this._sharedPath, `vendor/addon/__build.jsx`),
                    template: path.resolve(__dirname, 'addon.tpl'),
                    inject: false,
                }),
            ],
            outputDir: 'vendor',
            rules: _.map(vendorConfig.expose, (pkg, exposeName) => {
                return {
                    test: require.resolve(`${this._getPkg(pkg, 'entry')}`),
                    use: [
                        { loader: 'expose-loader', options: `${this._exposeRoot}.vendor.${exposeName}` },
                    ],
                }
            })
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
        let tplContent = fs.readFileSync(path.resolve(__dirname, 'appEntry.tpl'), 'utf-8')

        this._checkCreateDir(path.dirname(entryPath))

        tplContent = tplContent.replace(/<-appName->/g, appName)
                               .replace(/<-sharedPath->/g, this._sharedPath)
                               .replace(/<-webPath->/g, this._webPath)
                               .replace(/<-webpackPath->/g, this._webpackPath)

        fs.writeFileSync(entryPath, tplContent)
    }


    _createVendorEntryFile(entryPath) {
        const vendorConfig = this._moduleConfig.vendor

        this._checkCreateDir(path.dirname(entryPath))

        let tplContent = fs.readFileSync(path.resolve(__dirname, 'vendorEntry.tpl'), 'utf-8')

        let loadList = _.map(vendorConfig.expose, (pkg) => this._getPkg(pkg, 'entry'))
                        .concat(_.get(vendorConfig, 'autoLoad', []))

        const importExtra = _.map(loadList, (pkgName) => `require('${pkgName}')`).join('\n')

        tplContent = tplContent.replace(/<-importExtra->/g, importExtra)

        fs.writeFileSync(entryPath, tplContent)
    }

    getTemplate() {
        const vendorTemplate = this._vendorTemplate
        const commonTemplate = this._commonTemplate
        const appTemplate = this._appTemplate
        const buildModules = _.filter(_.get(process.env, 'BUILD_MODULES', '').split('&'), (moduleName) => !!moduleName)

        let templates = [ vendorTemplate, commonTemplate ].concat(appTemplate)

        if (!!buildModules.length) {
            templates = _.filter(templates, (template) => !!~buildModules.indexOf(template.moduleName))
        }

        _.each(templates, (template) => _.unset(template, 'moduleName'))

        return templates
    }

    getDevTemplate() {
        const appEntry = _.reduce(this._appTemplate, (result, template) => {
            return {
                ...result,
                ...template.entry,
            }
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

        return template
    }
}
