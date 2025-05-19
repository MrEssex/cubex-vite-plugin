import fs from "fs";
import path from "path";
import colors from "picocolors";
import { loadEnv } from "vite";
import fullReload from "vite-plugin-full-reload";
import { fileURLToPath } from "url";
let exitHandlersBound = false;
const refreshPaths = [
  "src/**/*",
  "assets/**/*"
].filter((path2) => fs.existsSync(path2.replace(/\*\*$/, "")));
function cubex(config) {
  const pluginConfig = resolvePluginConfig(config);
  return [
    resolveCubexPlugin(pluginConfig),
    ...resolveFullReloadConfig(pluginConfig)
  ];
}
function resolveCubexPlugin(pluginConfig) {
  let viteDevServerUrl;
  let resolvedConfig;
  let userConfig;
  const defaultAliases = {
    "@": "assets/ts"
  };
  return {
    name: "cubex",
    enforce: "post",
    config: (config, { command, mode }) => {
      userConfig = config;
      const env = loadEnv(mode, userConfig.envDir || process.cwd(), "");
      const assetUrl = env.ASSET_URL ?? "";
      const ssr = !!userConfig.build?.ssr;
      return {
        base: userConfig.base ?? (command === "build" ? resolveBase(pluginConfig, assetUrl) : ""),
        publicDir: userConfig.publicDir ?? false,
        build: {
          manifest: userConfig.build?.manifest ?? !ssr,
          outDir: userConfig.build?.outDir ?? ssr ? pluginConfig.ssrOutputDirectory : pluginConfig.buildDirectory,
          rollupOptions: {
            input: userConfig.build?.rollupOptions?.input ?? ssr ? pluginConfig.ssr : pluginConfig.input
          },
          assetsInlineLimit: userConfig.build?.assetsInlineLimit ?? 0
        },
        server: {
          origin: userConfig.server?.origin ?? "https://__cubex_vite_placehilder__.test",
          cors: userConfig.server?.cors ?? {
            origin: userConfig.server?.origin ?? [
              /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1])(?::\d+)?$/,
              ...env.APP_URL ? [env.APP_URL] : [],
              /^https?:\/\/.*\.local-host\.xyz(:\d+)?$/
            ]
          }
        },
        resolve: {
          alias: Array.isArray(userConfig.resolve?.alias) ? [
            ...userConfig.resolve?.alias ?? [],
            ...Object.keys(defaultAliases).map((key) => ({ find: key, replacement: defaultAliases[key] }))
          ] : {
            ...defaultAliases,
            ...userConfig.resolve?.alias
          }
        }
      };
    },
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      const appUrl = getAppUrl(resolvedConfig, pluginConfig);
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        const isAddressInfor = (x) => typeof x === "object";
        if (isAddressInfor(address)) {
          viteDevServerUrl = userConfig.server?.origin ? userConfig.server.origin : `http://localhost:${address.port}`;
          fs.writeFileSync(pluginConfig.hotFile, `${viteDevServerUrl}${server.config.base.replace(/\/$/, "")}`);
          setTimeout(() => {
            server.config.logger.info(`
  ${colors.red(`${colors.bold("CUBEX")} ${cubexVersion()}`)}  ${colors.dim("plugin")} ${colors.bold(`v${pluginVersion()}`)}`);
            server.config.logger.info("");
            server.config.logger.info(`  ${colors.green("\u279C")}  ${colors.bold("APP_URL")}: ${colors.cyan(appUrl.replace(/:(\d+)/, (_, port) => `:${colors.bold(port)}`))}`);
          }, 100);
        }
      });
      if (!exitHandlersBound) {
        const clean = () => {
          if (fs.existsSync(pluginConfig.hotFile)) {
            fs.rmSync(pluginConfig.hotFile);
          }
        };
        process.on("exit", clean);
        process.on("SIGINT", () => process.exit());
        process.on("SIGTERM", () => process.exit());
        process.on("SIGHUP", () => process.exit());
        exitHandlersBound = true;
      }
      return () => server.middlewares.use((req, res, next) => {
        if (req.url === "/index.html") {
          res.statusCode = 404;
          res.end(
            fs.readFileSync(path.join(dirname(), "dev-server-index.html")).toString().replace(/{{ APP_URL }}/g, appUrl)
          );
        }
        next();
      });
    }
  };
}
function resolvePluginConfig(config) {
  if (typeof config === "undefined") {
    throw new Error("cubex-vite-plugin: missing configuration");
  }
  if (typeof config === "string" || Array.isArray(config)) {
    config = { input: config, ssr: config };
  }
  if (typeof config.input === "undefined") {
    throw new Error('cubex-vite-plugin: missing configuration for "input"');
  }
  if (typeof config.publicDirectory === "string") {
    config.publicDirectory = config.publicDirectory.trim().replace(/^\/+/, "");
    if (config.publicDirectory === "") {
      throw new Error(`cubex-vite-plugin: "publicDirectory" must be a subdirectory of the project root. E.g 'public'`);
    }
  }
  if (typeof config.buildDirectory === "string") {
    config.buildDirectory = config.buildDirectory.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (config.buildDirectory === "") {
      throw new Error(`cubex-vite-plugin: "buildDirectory" must be a subdirectory of the project root. E.g 'resources'`);
    }
  }
  if (config.ssrOutputDirectory === "string") {
    config.ssrOutputDirectory = config.ssrOutputDirectory.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  }
  if (config.refresh === true) {
    config.refresh = [{ paths: refreshPaths }];
  }
  return {
    input: config.input,
    publicDirectory: config.publicDirectory ?? "public",
    buildDirectory: config.buildDirectory ?? "resources",
    ssr: config.ssr ?? config.input,
    ssrOutputDirectory: config.ssrOutputDirectory ?? "bootstrap/ssr",
    hotFile: config.hotFile ?? ".dev",
    refresh: config.refresh ?? true
  };
}
function resolveFullReloadConfig({ refresh: config }) {
  if (typeof config === "boolean") {
    return [];
  }
  if (typeof config === "string") {
    config = [{ paths: [config] }];
  }
  if (!Array.isArray(config)) {
    config = [config];
  }
  if (config.some((c) => typeof c === "string")) {
    config = [{ paths: config }];
  }
  return config.flatMap((c) => {
    const plugin = fullReload(c.paths, c.config);
    plugin.__cubex_plugin_config = c;
    return plugin;
  });
}
function resolveBase(config, assetUrl) {
  return assetUrl + (!assetUrl.endsWith("/") ? "/" : "") + config.buildDirectory + "/";
}
function cubexVersion() {
  try {
    const composer = JSON.parse(fs.readFileSync("composer.lock").toString());
    return composer.packages?.find((composerPackage) => composerPackage.name === "cubex/framework")?.version ?? "";
  } catch {
    return "";
  }
}
function pluginVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(dirname(), "../package.json")).toString())?.version;
  } catch {
    return "";
  }
}
function dirname() {
  return fileURLToPath(new URL(".", import.meta.url));
}
function getAppUrl(resolvedConfig, pluginConfig) {
  const defaultsIni = path.resolve("conf", "defaults.ini");
  if (fs.existsSync(defaultsIni)) {
    const defaults = fs.readFileSync(defaultsIni).toString();
    const schema = defaults.match(/schema\s*=\s*(.+)/)?.[1] ?? "http";
    const host = defaults.match(/host\s*=\s*(.+)/)?.[1];
    const port = defaults.match(/port\s*=\s*(.+)/)?.[1];
    if (!port) {
      return `${schema}://${host}`;
    }
    return `${schema}://${host}:${port}`;
  }
  const envDir = resolvedConfig.envDir ?? process.cwd();
  return loadEnv(resolvedConfig.mode, envDir, "APP_URL").APP_URL ?? "undefined";
}
export {
  cubex as default,
  refreshPaths
};
