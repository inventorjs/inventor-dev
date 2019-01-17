/**
 * babel 配置类
 *
 * @author : sunkeysun
 */

import _ from 'lodash'

export default class BabelConfigure {
    _ENVS = [ 'server', 'web' ]
    _SERVER_TARGETS = { node: '10.14.0' }
    _WEB_TARGETS = {}

    _env = 'web'
    _config = {
        server: {},
        web: {},
    }

    constructor(api, config) {
        if (!~this._ENVS.indexOf(process.env.BABEL_ENV)) {
            throw new Error(`'process.env.BABEL_ENV' must set in ${JSON.stringify(this._ENVS)}`)
        }

        api.cache.never()

        this._env = process.env.BABEL_ENV
        this._config = config
    }

    _getCommonPlugins() {
        return [
            ['@babel/plugin-proposal-decorators', { 'legacy': true }],
            ['@babel/plugin-proposal-class-properties', { 'loose': true }],
            '@babel/plugin-proposal-export-default-from',
            '@babel/plugin-proposal-export-namespace-from',
            '@babel/plugin-syntax-dynamic-import',
            '@babel/plugin-proposal-function-bind',
        ]
    }

    _getServerTemplate() {
        const defaultTemplate = {
            presets: [
                '@babel/preset-react',
                ['@babel/preset-env', {
                    targets: _.get(this._config, 'server.targets', this._SERVER_TARGETS),
                }],
                ..._.get(this._config, 'server.presets', []),
            ],
            plugins: [
                ['module-resolver', {
                    "alias": _.get(this._config, 'server.alias', {})
                }],
                ['css-modules-transform', {
                    generateScopedName: '[path][name]__[local]',
                    extensions: ['.css']
                }],
                ['@babel/transform-runtime', { regenerator: false }],
                ...this._getCommonPlugins(),
                ..._.get(this._config, 'server.plugins', []),
            ]
        }
        return defaultTemplate
    }

    _getWebTemplate() {
        const defaultTemplate = {
            presets: [
                '@babel/preset-react',
                ['@babel/preset-env', {
                    targets: _.get(this._config, 'web.targets', this._WEB_TARGETS),
                }],
                ..._.get(this._config, 'web.presets', []),
            ],
            plugins: [
                ['module-resolver', {
                    alias: _.get(this._config, 'web.alias'),
                }],
                '@babel/transform-runtime',
                ...this._getCommonPlugins(),
                ..._.get(this._config, 'web.plugins', []),
            ],
        }

        return defaultTemplate
    }

    getTemplate() {
        if (this._env === 'server') {
            return this._getServerTemplate()
        } else {
            return this._getWebTemplate()
        }
    }
}