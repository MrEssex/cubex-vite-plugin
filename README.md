# Cubex Vite Plugin

## Introduction

[Vite](https://vitejs.dev/) is a modern frontend tool that delivers an extremely fast development experience. It
includes features like lightning-fast cold server start, instant hot module replacement, and optimized builds for
production.

This plugin integrates Vite into Cubex to provide a seamless development experience.

This project is a modified version of
the [CodeIgniter Vite Plugin](https://github.com/monster010/codeigniter-vite-plugin)
which in turn is based on the [Laravel Vite Plugin](https://github.com/laravel/vite-plugin)

## Installation

Install with composer:

```shell
composer require mressex/cubex-vite-plugin
```

Create a `vite.config.js` file in the root of your project:

```
// vite.config.js
import { defineConfig } from 'vite';
import cubex from "cubex-vite-plugin";

export default defineConfig({
    plugins: [
        cubex([
            'assets/scss/index.scss',
            'assets/ts/index.ts',
        ]),
    ],
});
```

## Getting Started

- Install your node dependencies: `npm install`
- Start vite server: `npm run dev`

### Add to the Cubex DI, also requires Dispatch to be setup

```php
$cubex->share(Vite::class, $cubex->resolve(Vite::class, $ctx->getProjectRoot()));
```

### Loading Your Scripts and Styles

Register and css or ts files in the `vite.config.js` file. The plugin will automatically load the files in the
development environment and use the production build in the production environment.

pass true if you want to include the Vite client for Hot Mode Reloading

```php
protected function _registerResources(Vite $vite): void
  {
    $vite(['assets/scss/index.scss', 'assets/ts/index.ts'], true);
  }
```
