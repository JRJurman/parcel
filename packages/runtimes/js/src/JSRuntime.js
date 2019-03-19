// @flow
import {Runtime} from '@parcel/plugin';
import path from 'path';

const LOADERS = {
  browser: {
    css: './loaders/browser/css-loader',
    html: './loaders/browser/html-loader',
    js: './loaders/browser/js-loader',
    wasm: './loaders/browser/wasm-loader'
  },
  node: {
    css: './loaders/node/css-loader',
    html: './loaders/node/html-loader',
    js: './loaders/node/js-loader',
    wasm: './loaders/node/wasm-loader'
  }
};

export default new Runtime({
  async apply(bundle) {
    // Dependency ids in code replaced with referenced bundle names
    // Loader runtime added for bundle groups that don't have a native loader (e.g. HTML/CSS/Worker - isURL?),
    // and which are not loaded by a parent bundle.
    // Loaders also added for modules that were moved to a separate bundle because they are a different type
    // (e.g. WASM, HTML). These should be preloaded prior to the bundle being executed. Replace the entry asset(s)
    // with the preload module.

    if (bundle.type !== 'js') {
      return;
    }

    // $FlowFixMe - ignore unknown properties?
    let loaders = LOADERS[bundle.env.context];
    if (!loaders) {
      return;
    }

    let bundleGroups = bundle.assetGraph.findNodes(
      n => n.type === 'bundle_group'
    );
    for (let bundleGroup of bundleGroups) {
      // Ignore deps with native loaders, e.g. workers.
      if (
        bundleGroup.type !== 'bundle_group' ||
        bundleGroup.value.dependency.isURL
      ) {
        continue;
      }

      let bundles = bundle.assetGraph
        .getBundles(bundleGroup.value)
        .sort(
          bundle =>
            bundle.assetGraph.hasNode(bundleGroup.value.entryAssetId) ? 1 : -1
        );

      let loaderModules = bundles.map(b => {
        let loader = loaders[b.type];
        if (!loader) {
          throw new Error('Could not find a loader for ');
        }

        return `[require(${JSON.stringify(loader)}), ${JSON.stringify(
          path.relative(path.dirname(bundle.filePath), b.filePath)
        )}]`;
      });

      await bundle.assetGraph.addAsset(bundleGroup, {
        filePath: __filename,
        env: bundle.env,
        code: `module.exports = require('./bundle-loader')([${loaderModules.join(
          ', '
        )}, ${JSON.stringify(bundleGroup.value.entryAssetId)}]);`
      });
    }
  }
});