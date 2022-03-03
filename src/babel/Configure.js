/**
 * babel 配置类
 *
 * @author : sunkeysun
 */

import _ from 'lodash'

export default class BabelConfigure {
    _ENVS = [ 'server', 'web' ]

    _SERVER_TARGETS = { node: '12.16.0' }
    _WEB_TARGETS = { browsers: '> 0.1%, not ie <= 8' }

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
            ['@babel/plugin-proposal-export-default-from'],
            ['@babel/plugin-proposal-export-namespace-from'],
        ]
    }

    _getServerTemplate() {
        const defaultTemplate = {
            presets: [
                ['@babel/preset-env', {
                    targets: this._SERVER_TARGETS,
                }],
            ],
            plugins: [
                ['module-resolver', {
                    "alias": _.get(this._config, 'server.alias', {})
                }],
                ['css-modules-transform', {
                    generateScopedName: '[path][name]__[local]',
                }],
                ['@babel/transform-runtime', { regenerator: false }],
                ...this._getCommonPlugins(),
            ]
        }
        const template = this._processOverwrite(defaultTemplate, this._config.server)

        return template
    }

    _getWebTemplate() {
        const defaultTemplate = {
            presets: [
                ['@babel/preset-env', {
                    targets: this._WEB_TARGETS,
                }],
            ],
            plugins: [
                ['module-resolver', {
                    alias: _.get(this._config, 'web.alias', {}),
                }],
                ['@babel/transform-runtime'],
                ...this._getCommonPlugins(),
            ],
        }
        if (process.env.NODE_ENV === 'local') {
            defaultTemplate.plugins.push([require.resolve('react-refresh/babel'), { skipEnvCheck: true }])
        }

        const template = this._processOverwrite(defaultTemplate, this._config.web)

        return template
    }

    _processOverwrite(defaultTemplate, customTemplate) {
        const customPresets = _.map(customTemplate.presets, (preset) => this._normalize(preset))
        const customPlugins = _.map(customTemplate.plugins, (plugin) => this._normalize(plugin))
        const defaultPresets = _.map(defaultTemplate.presets, (preset) => this._normalize(preset))
        const defaultPlugins = _.map(defaultTemplate.plugins, (plugin) => this._normalize(plugin))

        const morePresets = _.filter(
            customPresets,
            (preset) => !_.find(defaultPresets, (pst) => pst[0] === preset[0])
        )

        const presets = _.filter(_.map(defaultPresets, (preset, index) => {
            const customPreset = _.find(customPresets, (pst) => preset[0] === pst[0])
            return customPreset ? customPreset : preset
        }).concat(morePresets), (preset) => preset[1] !== 'exclude')

        const morePlugins = _.filter(
            customPlugins,
            (plugin) => !_.find(defaultPlugins, (plg) => plg[0] === plugin[0])
        )

        const plugins = _.filter(_.map(defaultPlugins, (plugin, index) => {
            const customPlugin = _.find(customPlugins, (plg) => plugin[0] === plg[0])
            return customPlugin ? customPlugin : plugin
        }).concat(morePlugins), (plugin) => plugin[1] !== 'exclude')

        return { presets, plugins, ..._.omit(customTemplate, ['presets', 'plugins', 'alias', 'targets']) }
    }

    _normalize(target) {
        const result = _.isArray(target) ? target : [target]
        return result
    }

    getTemplate() {
        if (this._env === 'server') {
            return this._getServerTemplate()
        } else {
            return this._getWebTemplate()
        }
    }
}
