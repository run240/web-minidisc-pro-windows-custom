import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  const useWindowsCommandShell =
    process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    shell: useWindowsCommandShell,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function copy(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

function patchInterface(sourceName) {
  const source = join(root, 'webminidisc', 'src', 'services', 'interfaces', sourceName);
  const destination = join(root, 'src', 'wmd', 'original', 'services', 'interfaces', sourceName);
  let text = readFileSync(source, 'utf8');
  text = `// This file has been auto-generated! DO NOT EDIT!\n${text}`;
  text = text.replace(
    /^import Worker(.*)? from '[^']+';/gm,
    'const Worker$1 = null as any;',
  );
  text = text.replaceAll('import.meta.url', '""');
  writeFileSync(destination, text, 'utf8');
}

function patchGeneratedHiMDService() {
  const destination = join(
    root,
    'src',
    'wmd',
    'original',
    'services',
    'interfaces',
    'himd.ts',
  );
  // GitHub's Windows runners may check out the generated source with CRLF
  // line endings. Normalize before matching the reviewed LF patch blocks so
  // the build is reproducible regardless of Git's autocrlf setting.
  let text = readFileSync(destination, 'utf8').replace(/\r\n?/g, '\n');
  const pairBefore = `    async pair() {
        const device = await navigator.usb.requestDevice({ filters: DevicesIds });`;
  const pairAfter = `    async pair() {
        // A service instance is reused when the renderer returns to the mode
        // selection screen. Never carry a previous disc across a new pairing.
        this.himd = undefined;
        this.cachedDisc = undefined;
        this.atdata = null;
        const device = await navigator.usb.requestDevice({ filters: DevicesIds });`;
  const finalizeBefore = `    async finalize(): Promise<void> {
        await this.fsDriver?.driver?.close();
    }`;
  const finalizeAfter = `    async finalize(): Promise<void> {
        const driver = this.fsDriver?.driver;
        try {
            await driver?.close();
        } finally {
            this.streamingWorker?.close();
            this.streamingWorker = null;
            this.session = null;
            this.atdata = null;
            this.himd = undefined;
            this.fsDriver = undefined;
            this.dropCachedContentList();
        }
    }`;
  if (!text.includes(pairBefore) || !text.includes(finalizeBefore)) {
    throw new Error('The pinned Hi-MD service no longer matches the reviewed patch.');
  }
  text = text.replace(pairBefore, pairAfter).replace(finalizeBefore, finalizeAfter);
  writeFileSync(destination, text, 'utf8');
}

const renderer = join(root, 'renderer');
rmSync(renderer, { recursive: true, force: true });

patchInterface('himd.ts');
patchInterface('netmd.ts');
patchGeneratedHiMDService();
copy(
  join(root, 'custom-overrides', 'patches', 'webusb-device.js'),
  join(root, 'node_modules', 'usb', 'dist', 'webusb', 'webusb-device.js'),
);
run(process.execPath, [
  join(root, 'custom-overrides', 'patches', 'patch-node-mass-storage.mjs'),
]);
run(npx, ['tsc']);

copy(join(root, 'custom-overrides', 'dist'), join(root, 'dist'));
// The customized renderer is a complete, reviewed build artifact. Building
// the upstream submodule first would only be overwritten here and also makes
// the Windows build depend on the upstream submodule's stale package lock.
copy(join(root, 'custom-overrides', 'renderer'), renderer);

const extras = join(root, 'extras');
mkdirSync(extras, { recursive: true });
copy(
  join(root, 'custom-overrides', 'extras', 'WMDP-DRIVER-HELPER-NOTICE.txt'),
  join(extras, 'WMDP-DRIVER-HELPER-NOTICE.txt'),
);
copy(
  join(root, 'custom-overrides', 'extras', 'LIBWDI-COPYING-LGPLv3.txt'),
  join(extras, 'LIBWDI-COPYING-LGPLv3.txt'),
);

const helper = join(root, 'third_party', 'libwdi', 'build-x64', 'wmdp-driver-helper.exe');
if (!existsSync(helper)) {
  throw new Error(
    'Driver helper is missing. Build third_party\\libwdi\\build-wmdp-helper.cmd first.',
  );
}
copy(helper, join(extras, 'wmdp-driver-helper.exe'));

const libwdiArchive = join(extras, 'LIBWDI-SOURCE-v1.5.1-wmdp.zip');
rmSync(libwdiArchive, { force: true });
run('tar', [
  '-a',
  '-cf',
  libwdiArchive,
  '-C',
  join(root, 'third_party', 'libwdi'),
  '.',
]);

copy(
  join(root, 'custom-overrides', 'MODIFIED-BUILD-NOTICE.txt'),
  join(root, 'MODIFIED-BUILD-NOTICE.txt'),
);
copy(join(root, 'custom-overrides'), join(root, 'SOURCE-MODIFICATIONS'));

console.log('Custom source tree is ready for electron-builder.');
