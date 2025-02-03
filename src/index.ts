import fs from 'fs'
import { AddressInfo } from 'net'
import path from 'path'
import colors from 'picocolors'
import { ConfigEnv, loadEnv, Plugin, PluginOption, ResolvedConfig, UserConfig } from 'vite'
import fullReload, { Config as FullReloadConfig } from 'vite-plugin-full-reload'
import { fileURLToPath } from "url";

interface PluginConfig {
  /**
   * The Path of paths of the entry points to compile
   */
  input: string | string[]

  /**
   * Cubex Public Directory
   * @default 'public'
   */
  publicDirectory?: string

  /**
   * The directory to build the files to
   * @default 'resources'
   */
  buildDirectory?: string

  /**
   * The path to the "hot" file
   * @default '.dev'
   */
  hotFile?: string

  /**
   * The path of the SSR entry point
   */
  ssr?: string | string[]

  /**
   * The directory to output the SSR files to
   *
   * @default 'bootstrap/ssr'
   */
  ssrOutputDirectory?: string

  /**
   * Configuration for performing full page reloads on file changes
   * {@link https://github.com/ElMassimo/vite-plugin-full-reload}
   * @default false
   */
  refresh?: boolean | string | string[] | RefreshConfig | RefreshConfig[]
}

interface RefreshConfig {
  paths: string[]
  config?: FullReloadConfig
}

interface CubexPlugin extends Plugin {
  config: (config: UserConfig, env: ConfigEnv) => UserConfig
}

type DevServerUrl = `${'http' | 'https'}://${string}:${number}`;

let exitHandlersBound = false;

export const refreshPaths = [
  'src/**/*',
  'assets/**/*',
].filter(path => fs.existsSync(path.replace(/\*\*$/, '')));

/**
 * Cubex Plugin for Vite.
 * @param config - A config object or relative path(s) of the scripts to be compiled.
 */
export default function cubex(config: string | string[] | PluginConfig): [CubexPlugin, ...Plugin[]] {
  const pluginConfig = resolvePluginConfig(config);

  return [
    resolveCubexPlugin(pluginConfig),
    ...resolveFullReloadConfig(pluginConfig) as Plugin[]
  ];
}

/**
 * Resolve the Cubex Plugin
 * @param pluginConfig
 */
function resolveCubexPlugin(pluginConfig: Required<PluginConfig>): CubexPlugin {
  let viteDevServerUrl: DevServerUrl;
  let resolvedConfig: ResolvedConfig;
  let userConfig: UserConfig;

  const defaultAliases: Record<string, string> = {
    '@': 'assets/ts',
  }

  return {
    name: 'cubex',
    enforce: 'post',
    config: (config, { command, mode }) => {
      userConfig = config;
      const env = loadEnv(mode, userConfig.envDir || process.cwd(), '');
      const assetUrl = env.ASSET_URL ?? '';
      const ssr = !!userConfig.build?.ssr;

      // ensureCommandShouldRunInEnvironment(command, serverConfig);

      return {
        base: userConfig.base ?? (command === 'build' ? resolveBase(pluginConfig, assetUrl) : ''),
        publicDir: userConfig.publicDir ?? false,
        build: {
          manifest: userConfig.build?.manifest ?? !ssr,
          outDir: userConfig.build?.outDir ?? ssr ? pluginConfig.ssrOutputDirectory : pluginConfig.buildDirectory,
          rollupOptions: {
            input: userConfig.build?.rollupOptions?.input ?? ssr ? pluginConfig.ssr : pluginConfig.input,
          },
          assetsInlineLimit: userConfig.build?.assetsInlineLimit ?? 0,
        },
        server: {
          origin: userConfig.server?.origin ?? 'https://__cubex_vite_placehilder__.test',
          cors: userConfig.server?.cors ?? {
            origin: userConfig.server?.origin ?? [
              /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1])(?::\d+)?$/,
              ...(env.APP_URL ? [env.APP_URL] : []),   // *               (APP_URL="http://my-app.tld")
              /^https?:\/\/.*\.local-host\.xyz(:\d+)?$/,          // cubex-local    (SCHEME://*.local-host.xyz:PORT)
            ]
          }
        },
        resolve: {
          alias: Array.isArray(userConfig.resolve?.alias)
            ? [
              ...userConfig.resolve?.alias ?? [],
              ...Object.keys(defaultAliases).map(key => ({ find: key, replacement: defaultAliases[key] }))
            ]
            : {
              ...defaultAliases,
              ...userConfig.resolve?.alias,
            }
        }
      }
    },
    configResolved(config) {
      resolvedConfig = config
    },
    configureServer(server) {
      const appUrl = getAppUrl(resolvedConfig, pluginConfig)

      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();

        const isAddressInfor = (x: string | AddressInfo | null | undefined): x is AddressInfo => typeof x === 'object'
        if (isAddressInfor(address)) {
          viteDevServerUrl = userConfig.server?.origin ? userConfig.server.origin as DevServerUrl : `http://localhost:${address.port}`;

          fs.writeFileSync(pluginConfig.hotFile, `${viteDevServerUrl}${server.config.base.replace(/\/$/, '')}`);

          setTimeout(() => {
            server.config.logger.info(`\n  ${colors.red(`${colors.bold('CUBEX')} ${cubexVersion()}`)}  ${colors.dim('plugin')} ${colors.bold(`v${pluginVersion()}`)}`)
            server.config.logger.info('')
            server.config.logger.info(`  ${colors.green('➜')}  ${colors.bold('APP_URL')}: ${colors.cyan(appUrl.replace(/:(\d+)/, (_, port) => `:${colors.bold(port)}`))}`)
          }, 100)
        }
      });

      if (!exitHandlersBound) {
        const clean = () => {
          if (fs.existsSync(pluginConfig.hotFile)) {
            fs.rmSync(pluginConfig.hotFile);
          }
        }

        process.on('exit', clean);
        process.on('SIGINT', () => process.exit())
        process.on('SIGTERM', () => process.exit())
        process.on('SIGHUP', () => process.exit())

        exitHandlersBound = true
      }

      return () => server.middlewares.use((req, res, next) => {
        if (req.url === '/index.html') {
          res.statusCode = 404
          res.end(
            fs.readFileSync(path.join(dirname(), 'dev-server-index.html')).toString().replace(/{{ APP_URL }}/g, appUrl)
          )
        }
        next();
      })
    },
  }
}

/**
 * Convert the users configuration into a standard structure with defaults
 */
function resolvePluginConfig(config: string | string[] | PluginConfig): Required<PluginConfig> {
  if (typeof config === 'undefined') {
    throw new Error('cubex-vite-plugin: missing configuration')
  }

  if (typeof config === 'string' || Array.isArray(config)) {
    config = { input: config, ssr: config }
  }

  if (typeof config.input === 'undefined') {
    throw new Error('cubex-vite-plugin: missing configuration for "input"');
  }

  if (typeof config.publicDirectory === 'string') {
    config.publicDirectory = config.publicDirectory.trim().replace(/^\/+/, '')

    if (config.publicDirectory === '') {
      throw new Error('cubex-vite-plugin: "publicDirectory" must be a subdirectory of the project root. E.g \'public\'');
    }
  }

  if (typeof config.buildDirectory === 'string') {
    config.buildDirectory = config.buildDirectory.trim().replace(/^\/+/, '').replace(/\/+$/, '')

    if (config.buildDirectory === '') {
      throw new Error('cubex-vite-plugin: "buildDirectory" must be a subdirectory of the project root. E.g \'resources\'');
    }
  }

  if (config.ssrOutputDirectory === "string") {
    config.ssrOutputDirectory = config.ssrOutputDirectory.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  }

  if (config.refresh === true) {
    config.refresh = [{ paths: refreshPaths }];
  }


  return {
    input: config.input,
    publicDirectory: config.publicDirectory ?? 'public',
    buildDirectory: config.buildDirectory ?? 'resources',
    ssr: config.ssr ?? config.input,
    ssrOutputDirectory: config.ssrOutputDirectory ?? 'bootstrap/ssr',
    hotFile: config.hotFile ?? '.dev',
    refresh: config.refresh ?? true // default to true
  }
}


function resolveFullReloadConfig({ refresh: config }: Required<PluginConfig>): PluginOption[] {
  if (typeof config === 'boolean') {
    return [];
  }

  if (typeof config === 'string') {
    config = [{ paths: [config] }];
  }

  if (!Array.isArray(config)) {
    config = [config];
  }

  if (config.some(c => typeof c === 'string')) {
    config = [{ paths: config }] as RefreshConfig[];
  }

  return (config as RefreshConfig[]).flatMap(c => {
    const plugin = fullReload(c.paths, c.config);

    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    /** @ts-ignore */
    plugin.__cubex_plugin_config = c

    return plugin;
  })
}


/**
 * Resolve the Vite base option from the plugin configuration
 */
function resolveBase(config: Required<PluginConfig>, assetUrl: string): string {
  return assetUrl + (!assetUrl.endsWith('/') ? '/' : '') + config.buildDirectory + '/';
}

/**
 * The version of Cubex being run.
 */
function cubexVersion(): string {
  try {
    const composer = JSON.parse(fs.readFileSync('composer.lock').toString())

    return composer.packages?.find((composerPackage: {
      name: string
    }) => composerPackage.name === 'cubex/framework')?.version ?? ''
  } catch {
    return ''
  }
}

/**
 * The version of the Cubex Vite plugin being run.
 */
function pluginVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(dirname(), '../package.json')).toString())?.version
  } catch {
    return ''
  }
}

/**
 * The directory of the current file.
 */
function dirname(): string {
  return fileURLToPath(new URL('.', import.meta.url))
}

function getAppUrl(resolvedConfig: ResolvedConfig, pluginConfig: Required<PluginConfig>): string {
  // look in the conf directory and load the defaults.ini file [serve] section and get host
  const defaultsIni = path.resolve('conf', 'defaults.ini');

  if (fs.existsSync(defaultsIni)) {
    const defaults = fs.readFileSync(defaultsIni).toString();
    const host = defaults.match(/host\s*=\s*(.+)/)?.[1];
    const port = defaults.match(/port\s*=\s*(.+)/)?.[1];

    return `http://${host}:${port}`;
  }

  const envDir = resolvedConfig.envDir ?? process.cwd();
  return loadEnv(resolvedConfig.mode, envDir, 'APP_URL').APP_URL ?? 'undefined';
}
