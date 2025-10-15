<?php

namespace MrEssex\CubexVite;

use Packaged\Dispatch\Dispatch;
use Packaged\Dispatch\ResourceManager;

class Vite
{
  public function __construct(
    protected Dispatch $_dispatch,
    protected string   $_projectRoot = "",
    protected string   $_buildDirectory = 'resources',
    protected string   $_hotFile = "",
  )
  {
  }

  public function getResourceManager(): ResourceManager
  {
    return ResourceManager::resources([], $this->_dispatch);
  }

  public function getExternalResourceManager(): ResourceManager
  {
    return ResourceManager::external([], $this->_dispatch);
  }

  public function hotFile(): string
  {
    return $this->_hotFile ?: rtrim($this->_projectRoot, '/') . DIRECTORY_SEPARATOR . '.dev';
  }

  public function isRunningHot(): bool
  {
    return file_exists($this->hotFile());
  }

  public function external($entryPoints, $prefix = ""): void
  {
    if(!is_array($entryPoints))
    {
      $entryPoints = [$entryPoints];
    }

    foreach($entryPoints as $entryPoint)
    {
      $this->_loadExternalResource($prefix . $entryPoint);
    }
  }

  public function getResourceUri($entryPoints): array
  {
    if(!is_array($entryPoints))
    {
      $entryPoints = [$entryPoints];
    }

    $uris = [];
    foreach($entryPoints as $entryPoint)
    {
      $loc = $this->_resolveResource($entryPoint);
      foreach($loc as $file)
      {
        $uris[] = $this->getResourceManager()->getResourceUri($file);
      }
    }

    return $uris;
  }

  public function __invoke($entryPoints, $includeClient = false): void
  {
    if(!is_array($entryPoints))
    {
      $entryPoints = [$entryPoints];
    }

    $isHot = $this->isRunningHot();
    if($includeClient && $isHot)
    {
      $entryPoints[] = '@vite/client';
    }

    foreach($entryPoints as $entryPoint)
    {
      $loc = $this->_resolveResource($entryPoint);
      if($loc)
      {
        if(is_array($loc))
        {
          array_walk($loc, function ($asset) {
            $this->_loadResource($asset);
          });
        }
        else
        {
          $this->_loadResource($loc);
        }
      }
    }
  }

  public function reactRefresh(): void
  {
    if(!$this->isRunningHot())
    {
      return;
    }

    $react = $this->hotAsset('@react-refresh');
    ResourceManager::inline([], $this->_dispatch)->requireJs(
      'import RefreshRuntime from "' . $react . '"
                    RefreshRuntime.injectIntoGlobalHook(window)
                    window.$RefreshReg$ = () => {}
                    window.$RefreshSig$ = () => (type) => type
                    window.__vite_plugin_react_preamble_installed__ = true',
      ['type' => 'module']
    );
  }

  protected function _getManifest(): array
  {
    $resourceDirectory = $this->_projectRoot . DIRECTORY_SEPARATOR . $this->_buildDirectory;
    $manifestFile = $resourceDirectory . DIRECTORY_SEPARATOR . 'manifest.json';
    if(file_exists($manifestFile))
    {
      return json_decode(file_get_contents($manifestFile), true, 512, JSON_THROW_ON_ERROR);
    }
    return [];
  }

  protected function _hotUrl(string $asset): string
  {
    return rtrim(file_get_contents($this->hotFile())) . '/' . ltrim($asset, '/');
  }

  protected function hotAsset($asset)
  {
    $file = file_get_contents($this->hotFile());
    return rtrim($file) . '/' . $asset;
  }

  protected function _loadResource(string $asset): void
  {
    if(str_ends_with($asset, "@vite/client") || str_ends_with($asset, ".ts") || str_ends_with(
        $asset,
        ".tsx"
      ) || str_ends_with($asset, ".js"))
    {
      $this->getResourceManager()->requireJs($asset, ['type' => 'module']);
    }

    if(str_ends_with($asset, ".css") || str_ends_with($asset, ".scss") || str_ends_with($asset, ".sass"))
    {
      $this->getResourceManager()->requireCss($asset);
    }
  }

  protected function _loadExternalResource(string $asset): void
  {
    if(str_ends_with($asset, ".ts") || str_ends_with($asset, ".js"))
    {
      $this->getExternalResourceManager()->requireJs($asset, ['type' => 'module']);
    }

    if(str_ends_with($asset, ".css") || str_ends_with($asset, ".scss") || str_ends_with($asset, ".sass"))
    {
      $this->getExternalResourceManager()->requireCss($asset);
    }
  }

  protected function _resolveResource(string $entryPoint): string|array
  {
    $isHot = $this->isRunningHot();
    $manifest = $this->_getManifest();
    if($isHot)
    {
      return $this->_hotUrl($entryPoint);
    }

    if(isset($manifest[$entryPoint]))
    {
      return $manifest[$entryPoint]['file'];
    }

    $loc = [];
    foreach(array_keys($manifest) as $key)
    {
      if(str_starts_with($key, $entryPoint))
      {
        $loc[] = $manifest[$key]['file'];
      }
    }

    return $loc;
  }

}
