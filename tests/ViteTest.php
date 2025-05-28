<?php

namespace MrEssex\CubexVite\Tests;

use MrEssex\CubexVite\Vite;
use Packaged\Dispatch\Dispatch;
use PHPUnit\Framework\TestCase;

class ViteTest extends TestCase
{
  public function testInvoke(): void
  {
    $dispatch = new Dispatch(__DIR__);
    $vite = new Vite($dispatch, __DIR__);

    $vite(['assets/views/example/index.scss', 'assets/views/example/index.ts']);

    $store = $dispatch->store();

    self::assertMatchesRegularExpression(
      '#<link href="r/\w.*/assets/index-DkTYsDSU.css" rel="stylesheet" type="text/css">#',
      $store->generateHtmlIncludes($store::TYPE_CSS)
    );

    self::assertMatchesRegularExpression(
      '#<script src="r/\w.*/assets/index-BGVdNEyr.js" type="module"></script>#',
      $store->generateHtmlIncludes($store::TYPE_JS)
    );
  }

  public function testPathMatchInvoke(): void
  {
    $dispatch = new Dispatch(__DIR__);
    $vite = new Vite($dispatch, __DIR__);

    // Should include all resources in the assets/views/example directory
    $vite(['assets/views/example']);

    $store = $dispatch->store();

    self::assertMatchesRegularExpression(
      '#<link href="r/\w.*/assets/index-DkTYsDSU.css" rel="stylesheet" type="text/css">#',
      $store->generateHtmlIncludes($store::TYPE_CSS)
    );

    self::assertMatchesRegularExpression(
      '#<script src="r/\w.*/assets/index-BGVdNEyr.js" type="module"></script>#',
      $store->generateHtmlIncludes($store::TYPE_JS)
    );
  }

  public function testExternal(): void
  {
    $dispatch = new Dispatch(__DIR__);
    $vite = new Vite($dispatch, __DIR__);

    $vite->external(['assets/views/example/index.scss', 'assets/views/example/index.ts']);
    $store = $dispatch->store();

    self::assertMatchesRegularExpression(
      '#<link href="assets/views/example/index.scss" rel="stylesheet" type="text/css">#',
      $store->generateHtmlIncludes($store::TYPE_CSS)
    );

    self::assertMatchesRegularExpression(
      '#<script src="assets/views/example/index.ts" type="module"></script>#',
      $store->generateHtmlIncludes($store::TYPE_JS)
    );
  }

  public function testResolveExternal(): void
  {
    $dispatch = new Dispatch(__DIR__);
    $vite = new Vite($dispatch, __DIR__);

    // Should include all resources in the assets/views/example directory
    $res = $vite->getResourceUri('assets/views/example');

    // Require all the resources as external with a prefix
    $vite->external($res, 'example-prefix/test/assets/');

    $store = $dispatch->store();

    self::assertMatchesRegularExpression(
      '#<link href="example-prefix/test/assets/r/\w.*/assets/index-DkTYsDSU.css" rel="stylesheet" type="text/css">#',
      $store->generateHtmlIncludes($store::TYPE_CSS)
    );

    self::assertMatchesRegularExpression(
      '#<script src="example-prefix/test/assets/r/\w.*/assets/index-BGVdNEyr.js" type="module"></script>#',
      $store->generateHtmlIncludes($store::TYPE_JS)
    );
  }

  public function testResolveMultipleDirectories() {
    $dispatch = new Dispatch(__DIR__);
    $vite = new Vite($dispatch, __DIR__);

    // Should include all resources in the assets/views/example directory
    $vite(['assets/views/example', 'assets/views/main']);

    $store = $dispatch->store();

    self::assertMatchesRegularExpression(
      '#<link href="r/\w.*/assets/index-DkTYsDSU.css" rel="stylesheet" type="text/css"><link href="r/\w.*/assets/index-xWPGQPTh.css" rel="stylesheet" type="text/css">#',
      $store->generateHtmlIncludes($store::TYPE_CSS)
    );

    self::assertMatchesRegularExpression(
      '#<script src="r/\w.*/assets/index-BGVdNEyr.js" type="module"></script><script src="r/\w.*/assets/index-C0WG5Avm.js" type="module"></script>#',
      $store->generateHtmlIncludes($store::TYPE_JS)
    );
  }
}
