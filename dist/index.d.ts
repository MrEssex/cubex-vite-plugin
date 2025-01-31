import { ConfigEnv, Plugin, UserConfig } from 'vite';
import { Config as FullReloadConfig } from 'vite-plugin-full-reload';
import { InputOption } from "rollup";
interface PluginConfig {
    /**
     * The Path of paths of the entry points to compile
     */
    input: InputOption;
    /**
     * Cubex Public Directory
     * @default 'public'
     */
    publicDirectory?: string;
    /**
     * The directory to build the files to
     * @default 'resources'
     */
    buildDirectory?: string;
    /**
     * The path to the "hot" file
     * @default '.dev'
     */
    hotFile?: string;
    /**
     * Configuration for performing full page reloads on file changes
     * {@link https://github.com/ElMassimo/vite-plugin-full-reload}
     * @default false
     */
    refresh?: boolean | string | string[] | RefreshConfig | RefreshConfig[];
}
interface RefreshConfig {
    paths: string[];
    config?: FullReloadConfig;
}
interface CubexPlugin extends Plugin {
    config: (config: UserConfig, env: ConfigEnv) => UserConfig;
}
export declare const refreshPaths: string[];
/**
 * Cubex Plugin for Vite.
 * @param config - A config object or relative path(s) of the scripts to be compiled.
 */
export default function cubex(config: string | string[] | PluginConfig): [CubexPlugin, ...Plugin[]];
export {};
