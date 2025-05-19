<?php

namespace MrEssex\CubexVite;

use JsonException;
use Packaged\Dispatch\Dispatch;
use Packaged\Dispatch\ResourceManager;

class Vite
{
  protected string $_hotFile;
  protected string $_buildDirectory = 'resources';

  public function __construct(
    protected Dispatch $_dispatch,
    protected string   $_projectRoot,
  )
  {
  }

  public function getResourceManager(): ResourceManager
  {
    return ResourceManager::resources([], $this->_dispatch);
  }

  public function hotFile(): string
  {
    return $this->_hotFile ?? rtrim($this->_projectRoot, '/') . DIRECTORY_SEPARATOR . '.dev';
  }

  public function isRunningHot(): bool
  {
    return file_exists($this->hotFile());
  }

  public function __invoke($entryPoints, $includeClient): void
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

    $manifest = $this->_getManifest();
    foreach($entryPoints as $entryPoint)
    {
      if($isHot)
      {
        $this->_loadResource($this->_hotUrl($entryPoint));
      }
      else if(isset($manifest[$entryPoint]))
      {
        $loc = $manifest[$entryPoint]['file'];
        $this->_loadResource($loc);
      }
    }
  }

  /**
   * @throws JsonException
   */
  protected function _getManifest(): array
  {
    $resourceDirectory = $this->_projectRoot . DIRECTORY_SEPARATOR . $this->_buildDirectory;
    $manifestFile = $resourceDirectory . DIRECTORY_SEPARATOR . '.vite' . DIRECTORY_SEPARATOR . 'manifest.json';
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

  protected function _loadResource(string $asset): void
  {
    if(str_ends_with($asset, "@vite/client") || str_ends_with($asset, ".ts") || str_ends_with($asset, ".js"))
    {
      $this->getResourceManager()->requireJs($asset, ['type' => 'module']);
    }

    if(str_ends_with($asset, ".css") || str_ends_with($asset, ".scss") || str_ends_with($asset, ".sass"))
    {
      $this->getResourceManager()->requireCss($asset);
    }
  }
}
