const fs = require('fs');
const path = require('path');

// ── 1. Patch metro/package.json to expose internal src paths needed by expo@49 ──
const metroPkgPath = path.join(__dirname, '..', 'node_modules', 'metro', 'package.json');

if (fs.existsSync(metroPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(metroPkgPath, 'utf8'));
  if (pkg.exports) {
    const neededExports = {
      './src/lib/TerminalReporter': './src/lib/TerminalReporter.js',
      './src/lib/createWebsocketServer': './src/lib/createWebsocketServer.js',
      './src/lib/splitBundleOptions': './src/lib/splitBundleOptions.js',
      './src/lib/reporting': './src/lib/reporting.js',
      './src/Server': './src/Server.js',
      './src/HmrServer': './src/HmrServer.js',
      './src/Assets': './src/Assets.js',
      './src/DeltaBundler': './src/DeltaBundler.js',
      './src/IncrementalBundler': './src/IncrementalBundler.js',
      './src/Bundler': './src/Bundler.js',
      './src/shared/types': './src/shared/types.js',
      './src/DeltaBundler/types': './src/DeltaBundler/types.js',
      './src/DeltaBundler/Serializers/helpers/js': './src/DeltaBundler/Serializers/helpers/js.js',
    };
    let patched = false;
    for (const [exportPath, filePath] of Object.entries(neededExports)) {
      if (!pkg.exports[exportPath]) {
        pkg.exports[exportPath] = filePath;
        patched = true;
      }
    }
    if (patched) {
      fs.writeFileSync(metroPkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log('[patch-metro] Patched metro/package.json exports.');
    } else {
      console.log('[patch-metro] metro/package.json already patched.');
    }
  }
}

// ── 2. Patch @expo/cli resolveFromProject.js for ES module interop ──
// expo@49 expects CJS classes but metro@0.83.x exports ES module default exports.
const resolveFromProjectPath = path.join(
  __dirname, '..', 'node_modules', '@expo', 'cli', 'build', 'src',
  'start', 'server', 'metro', 'resolveFromProject.js'
);

if (fs.existsSync(resolveFromProjectPath)) {
  let src = fs.readFileSync(resolveFromProjectPath, 'utf8');
  const marker = '/* patched-esm-interop */';

  if (!src.includes(marker)) {
    // Fix importMetroHmrServerFromProject to unwrap default export
    src = src.replace(
      'function importMetroHmrServerFromProject(projectRoot) {\n    return importFromProject(projectRoot, "metro/src/HmrServer");\n}',
      `function importMetroHmrServerFromProject(projectRoot) { ${marker}\n    const mod = importFromProject(projectRoot, "metro/src/HmrServer");\n    return mod && mod.__esModule ? mod.default : mod;\n}`
    );

    // Fix importMetroCreateWebsocketServerFromProject similarly
    src = src.replace(
      'function importMetroCreateWebsocketServerFromProject(projectRoot) {\n    return importFromProject(projectRoot, "metro/src/lib/createWebsocketServer");\n}',
      `function importMetroCreateWebsocketServerFromProject(projectRoot) {\n    const mod = importFromProject(projectRoot, "metro/src/lib/createWebsocketServer");\n    return mod && mod.__esModule ? mod.default : mod;\n}`
    );

    fs.writeFileSync(resolveFromProjectPath, src, 'utf8');
    console.log('[patch-metro] Patched @expo/cli resolveFromProject.js for ES module interop.');
  } else {
    console.log('[patch-metro] @expo/cli resolveFromProject.js already patched.');
  }
}
