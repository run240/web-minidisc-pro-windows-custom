"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const networkwm_js_1 = require("networkwm-js");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const translations_1 = require("./wmd/translations");
const node_fetch_1 = __importDefault(require("node-fetch"));
const electron_store_1 = __importDefault(require("electron-store"));
const server_bootstrap_1 = require("./macos/server-bootstrap");
const child_process_1 = require("child_process");
const networkwm_service_1 = require("./wmd/networkwm-service");
const electron_context_menu_1 = __importDefault(require("electron-context-menu"));
const electron_prompt_1 = __importDefault(require("electron-prompt"));
const encryption_1 = require("networkwm-js/dist/encryption");
const async_mutex_1 = require("async-mutex");
const wusb_interop_1 = require("./wusb-interop");
const device_diagnostics_1 = require("./device-diagnostics");
const getOfRenderer = (...p) => path_1.default.join(__dirname, '..', 'renderer', ...p);
async function ewmdOpenDialog(window, filters, directory) {
    const res = await electron_1.dialog.showOpenDialog(window, { filters, properties: [directory ? 'openDirectory' : 'openFile'] });
    if (res.canceled)
        return null;
    else
        return res.filePaths[0];
}
let relaunching = false;
function reload(window) {
    if (relaunching)
        return;
    relaunching = true;
    // AppImages do not restart correctly
    if (electron_1.app.isPackaged && process.env.APPIMAGE) {
        electron_1.dialog.showMessageBoxSync(window, { message: "This is an AppImage. Electron has a bug where AppImages cannot restart. Please restart the app manually" });
    }
    electron_1.app.relaunch();
    electron_1.app.exit();
}
function withTimeout(promise, timeoutMs, message, code = 'OPERATION_TIMEOUT') {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => {
            const error = new Error(message);
            error.code = code;
            reject(error);
        }, timeoutMs);
    });
    return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
        if (timeout)
            clearTimeout(timeout);
    });
}
function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
let rendererWarningSequence = 0;
function showRendererWarning(window, warning) {
    if (window.isDestroyed())
        return Promise.resolve();
    const closeChannel = `miniDiscWarningClosed:${process.pid}:${Date.now()}:${rendererWarningSequence++}`;
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            electron_1.ipcMain.removeAllListeners(closeChannel);
            resolve();
        };
        const timeout = setTimeout(finish, 120000);
        electron_1.ipcMain.once(closeChannel, finish);
        window.webContents.send('showMiniDiscWarning', {
            ...warning,
            closeChannel,
        });
    });
}
electron_1.app.commandLine.appendSwitch('ignore-certificate-errors');
function setupSettings(window) {
    const store = new electron_store_1.default();
    const _settings = [
        {
            family: 'Functionality',
            name: 'Open Devtools',
            async handleChange() {
                window.webContents.openDevTools();
            },
            state: 0,
            type: 'action',
        },
        {
            family: 'Functionality',
            name: 'Use a Default Download Directory',
            async handleChange(newVal) {
                if (newVal) {
                    // Enabled
                    if (!store.get('downloadPath', null)) { // Match both '' and null
                        // Ask the user for the path
                        const userProvided = await ewmdOpenDialog(window, [], true);
                        if (!userProvided)
                            return; // If the user cancelled, do not write any changes
                        store.set('downloadPath', userProvided);
                    }
                }
                store.set('useDownloadPath', newVal);
            },
            state: store.get('useDownloadPath', false),
            type: 'boolean',
        },
        store.get('useDownloadPath', false) ? {
            family: 'Functionality',
            name: 'Default Download Directory',
            async handleChange(newVal) {
                if (!newVal && store.get('downloadPath', '')) {
                    // If the user cancelled, but there's a path set already, do not do anything
                    return;
                }
                if (!newVal) {
                    // The user cancelled, and there's nothing set (edge case)
                    // Disable the menu option
                    store.set('useDownloadPath', false);
                }
                store.set('downloadPath', newVal);
            },
            type: 'hostDirPath',
            state: store.get('downloadPath', ''),
        } : null,
        {
            family: 'Functionality',
            name: 'Import NetworkWM Keyring Data',
            type: 'action',
            state: 0,
            async handleChange() {
                const resp = await (0, electron_prompt_1.default)({
                    title: 'Keyring Import',
                    label: 'Please enter the keyring string below',
                    inputAttrs: {
                        type: 'text',
                    }
                }, window);
                if (resp === null)
                    return;
                let rawData;
                let backup = Object.assign({}, encryption_1.EKBROOTS);
                Object.keys(encryption_1.EKBROOTS).forEach((e) => delete encryption_1.EKBROOTS[e]);
                try {
                    rawData = Uint8Array.from(atob(resp), e => e.charCodeAt(0));
                    (0, networkwm_js_1.importKeys)(rawData);
                }
                catch (ex) {
                    electron_1.dialog.showMessageBoxSync(window, { message: 'Keyring import failed.' });
                    Object.keys(encryption_1.EKBROOTS).forEach((e) => encryption_1.EKBROOTS[e] = backup[e]);
                    return;
                }
                fs_1.default.writeFileSync(path_1.default.join(electron_1.app.getPath('userData'), 'EKBROOTS.DES'), rawData);
                reload(window);
            }
        }
    ];
    const settings = _settings.filter(e => e);
    electron_1.ipcMain.removeHandler('setting_update');
    electron_1.ipcMain.removeHandler('fetch_settings_list');
    electron_1.ipcMain.handle("setting_update", async (_, name, newValue) => {
        const setting = settings.find(e => e.name === name);
        if (setting.handleChange) {
            await setting.handleChange(newValue);
            setupSettings(window);
        }
    });
    electron_1.ipcMain.handle("fetch_settings_list", () => {
        return settings.map(e => {
            let q = Object.assign({}, e);
            delete q['handleChange'];
            return q;
        });
    });
}
function setupEncoder() {
    function invoke(program, args) {
        return new Promise(res => {
            const name = path_1.default.basename(program);
            const process = (0, child_process_1.spawn)(program, args);
            process.on('close', (e) => res(e === 0));
            process.stdout.on('data', e => console.log(`[${name} - STDOUT]: ${e.toString().trim()}`));
            process.stderr.on('data', e => console.log(`[${name} - STDERR]: ${e.toString().trim()}`));
        });
    }
    electron_1.ipcMain.handle("invokeLocalEncoder", async (_, ffmpegPath, encoderPath, data, sourceFilename, parameters) => {
        // Pipeline:
        // inFile.ANY ==(ffmpeg)==> inFile.wav ==(encoder)==> outFile.wav
        let tempDir = '';
        if (os_1.default.platform() === 'darwin') {
            const homeDir = electron_1.app.getPath('home');
            tempDir = path_1.default.join(homeDir, 'Library', 'Caches', 'ElectronWMD');
        }
        else {
            tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'atracenc'));
        }
        if (!fs_1.default.existsSync(tempDir)) {
            fs_1.default.mkdirSync(tempDir);
        }
        const inFilePath = path_1.default.join(tempDir, sourceFilename);
        fs_1.default.writeFileSync(inFilePath, new Uint8Array(data));
        const intermediateFilePath = path_1.default.join(tempDir, "intermediate.wav");
        const ffmpegArgs = ['-i', inFilePath];
        if (parameters.enableReplayGain) {
            ffmpegArgs.push('-af', 'volume=replaygain=track');
        }
        ffmpegArgs.push('-ac', '2', '-ar', '44100', '-f', 'wav', intermediateFilePath);
        console.log(`Executing ffmpeg. ARGS: ${ffmpegArgs}`);
        await invoke(ffmpegPath, ffmpegArgs);
        const outFilePath = path_1.default.join(tempDir, "output.wav");
        const bitrateString = (parameters.format.bitrate + '');
        const allArgs = ['-e', '-br', bitrateString, intermediateFilePath, outFilePath];
        console.log(`Executing encoder EXE: ${encoderPath}. ARGS: ${allArgs}`);
        await invoke(encoderPath, allArgs);
        const rawData = new Uint8Array(fs_1.default.readFileSync(outFilePath)).buffer;
        fs_1.default.unlinkSync(outFilePath);
        fs_1.default.unlinkSync(inFilePath);
        fs_1.default.unlinkSync(intermediateFilePath);
        fs_1.default.rmdirSync(tempDir);
        return rawData;
    });
}
async function createWindow() {
    const store = new electron_store_1.default();
    const savedBounds = store.get('windowBounds', null);
    const boundsAreVisible = savedBounds && electron_1.screen.getAllDisplays().some(display => {
        const area = display.workArea;
        const overlapWidth = Math.max(0, Math.min(savedBounds.x + savedBounds.width, area.x + area.width) - Math.max(savedBounds.x, area.x));
        const overlapHeight = Math.max(0, Math.min(savedBounds.y + savedBounds.height, area.y + area.height) - Math.max(savedBounds.y, area.y));
        return overlapWidth >= 100 && overlapHeight >= 100;
    });
    const window = new electron_1.BrowserWindow({
        ...(boundsAreVisible ? savedBounds : { width: 1280, height: 900 }),
        icon: path_1.default.join(__dirname, '..', 'res', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    if (store.get('windowMaximized', false))
        window.maximize();
    let saveBoundsTimer;
    const saveWindowPlacement = () => {
        if (window.isDestroyed() || window.isMinimized())
            return;
        store.set('windowBounds', window.getNormalBounds());
        store.set('windowMaximized', window.isMaximized());
    };
    const scheduleWindowPlacementSave = () => {
        if (saveBoundsTimer)
            clearTimeout(saveBoundsTimer);
        saveBoundsTimer = setTimeout(saveWindowPlacement, 250);
    };
    window.on('move', scheduleWindowPlacementSave);
    window.on('resize', scheduleWindowPlacementSave);
    window.on('maximize', scheduleWindowPlacementSave);
    window.on('unmaximize', scheduleWindowPlacementSave);
    window.on('close', saveWindowPlacement);
    console.log(electron_1.app.getPath('exe'));
    await integrate(window);
    window.setMenuBarVisibility(false);
    await window.loadURL('file://' + getOfRenderer('index.html')); //Can't use the `sandbox://` protocol - index.html would (incorrectly) redirect to https
    window.setTitle('Web MiniDisc Pro');
    window.setMenuBarVisibility(false);
    window.webContents.session.on('will-download', async (event, item, contents) => {
        let downloadPath = store.get('downloadPath', '');
        let useDownloadPath = store.get('useDownloadPath', false);
        if (downloadPath && useDownloadPath) {
            const baseFilename = item.getFilename();
            let filename = path_1.default.join(downloadPath, baseFilename);
            const { name, ext } = path_1.default.parse(baseFilename);
            let i = 1;
            while (fs_1.default.existsSync(filename)) {
                filename = path_1.default.join(downloadPath, `${name} (${i++})${ext}`);
            }
            item.setSavePath(filename);
        }
    });
}
function getDefinedFunctions(currentObj) {
    const defined = new Set();
    do {
        Object.getOwnPropertyNames(currentObj)
            .filter((n) => typeof currentObj[n] == 'function' && !(n in defined))
            .forEach(defined.add.bind(defined));
    } while ((currentObj = Object.getPrototypeOf(currentObj)));
    return defined;
}
function traverseObject(window, objectFactory, namespace) {
    let currentObj = objectFactory();
    const defined = getDefinedFunctions(currentObj);
    let hiMDRecoveryPending = false;
    let netMDRecoveryPending = false;
    defined.forEach((n) => {
        const translatedName = namespace + n;
        console.log(`[INTEGRATE]: Registering handler ${translatedName}`);
        electron_1.ipcMain.handle(translatedName, async function (_, ...allArgs) {
            var _a;
            for (let i = 0; i < allArgs.length; i++) {
                if (((_a = allArgs[i]) === null || _a === void 0 ? void 0 : _a.interprocessType) === 'function') {
                    allArgs[i] = async (...args) => {
                        window.webContents.send('_callback', `${translatedName}_callback${i}`, ...args);
                    };
                }
            }
            const targetObject = objectFactory();
            if (!targetObject.__activeIpcMethods) {
                Object.defineProperty(targetObject, '__activeIpcMethods', {
                    configurable: true,
                    value: new Set(),
                });
            }
            targetObject.__activeIpcMethods.add(n);
            try {
                const isForcedTOCReload = n === 'listContent' && allArgs[0] === true;
                if (isForcedTOCReload &&
                    (targetObject.atdata !== null && targetObject.atdata !== undefined ||
                        targetObject.currentSession !== undefined ||
                        [...targetObject.__activeIpcMethods].some(method => ['prepareUpload', 'upload', 'finalizeUpload', 'download'].includes(method)))) {
                    const error = new Error('전송 중에는 디스크를 다시 검색할 수 없습니다. 전송이 끝난 뒤 다시 시도해 주세요.');
                    error.code = 'ACTIVE_TRANSFER';
                    throw error;
                }
                const operation = Promise.resolve().then(() => targetObject[n](...allArgs));
                const shouldTimeOutHiMD = namespace === '_himd_' &&
                    ['pair', 'getDeviceName', 'listContent', 'applyEditBatch'].includes(n);
                const shouldTimeOutNetMD = namespace === '_netmd_' &&
                    (['pair', 'connect'].includes(n) || isForcedTOCReload);
                let result;
                if (shouldTimeOutHiMD) {
                    result = await withTimeout(operation, n === 'applyEditBatch' ? 60000 : 30000, n === 'applyEditBatch'
                        ? 'Hi-MD 편집 적용과 검증 시간이 초과되었습니다. 장치를 분리하지 말고 잠시 기다린 뒤, 앱이 복구되지 않으면 USB를 다시 연결해 주세요.'
                        : 'Hi-MD 파일시스템을 찾지 못했습니다. 일반 NetMD 포맷 미디어라면 USB 인터페이스가 Hi-MD 모드에 남아 있는 상태일 수 있습니다.', 'HIMD_TIMEOUT');
                }
                else if (shouldTimeOutNetMD) {
                    result = await withTimeout(operation, isForcedTOCReload ? 20000 : 15000, isForcedTOCReload
                        ? '디스크 다시 검색 시간이 초과되었습니다. USB 케이블을 다시 연결한 뒤 재시도해 주세요.'
                        : 'NetMD 기기 연결 응답 시간이 초과되었습니다. USB 케이블을 다시 연결한 뒤 재시도해 주세요.', isForcedTOCReload ? 'NETMD_RESCAN_TIMEOUT' : 'NETMD_TIMEOUT');
                }
                else {
                    result = await operation;
                }
                return [result, null];
            }
            catch (err) {
                console.log("Node Error: ");
                console.log(err);
                if (err?.code === 'HIMD_TIMEOUT' && !hiMDRecoveryPending) {
                    hiMDRecoveryPending = true;
                    try {
                        await withTimeout(targetObject.finalize(), 4000, 'Hi-MD 연결 정리 시간 초과');
                    }
                    catch (cleanupError) {
                        console.log('Timed-out Hi-MD connection cleanup failed:', cleanupError);
                    }
                    await showRendererWarning(window, {
                        title: 'Hi-MD 연결 시간이 초과되었습니다',
                        message: '현재 미디어에서 Hi-MD 파일시스템을 찾지 못해 모드 선택 화면으로 돌아갑니다.',
                        detail: '일반 NetMD 포맷 미디어가 들어 있다면 RH1의 USB 인터페이스만 Hi-MD 모드에 남아 있는 상태입니다. 일반 미디어라면 NetMD를 선택하고, Hi-MD 포맷이 확실하다면 미디어 장착을 확인한 뒤 다시 시도하세요.',
                    });
                    if (!window.isDestroyed())
                        window.webContents.reload();
                    hiMDRecoveryPending = false;
                    return [null, null];
                }
                if (err?.code === 'NETMD_TIMEOUT' && !netMDRecoveryPending) {
                    netMDRecoveryPending = true;
                    try {
                        const stalledInterface = targetObject.netmdInterface;
                        targetObject.netmdInterface = undefined;
                        targetObject.dropCachedContentList?.();
                        await withTimeout(Promise.resolve(stalledInterface?.netMd?.finalize()), 3000, 'NetMD 연결 정리 시간 초과');
                    }
                    catch (cleanupError) {
                        console.log('Timed-out NetMD connection cleanup failed:', cleanupError);
                    }
                    await showRendererWarning(window, {
                        title: 'NetMD 연결 시간이 초과되었습니다',
                        message: '기기가 연결 요청에 응답하지 않아 모드 선택 화면으로 돌아갑니다.',
                        detail: '장치를 잠시 기다린 뒤 NetMD 연결을 다시 시도해 주세요.',
                    });
                    if (!window.isDestroyed())
                        window.webContents.reload();
                    netMDRecoveryPending = false;
                    return [null, null];
                }
                return [null, err];
            }
            finally {
                targetObject.__activeIpcMethods.delete(n);
            }
        });
    });
    return Array.from(defined).map(e => namespace + e);
}
async function integrate(window) {
    const webusb = wusb_interop_1.WebUSBInterop.create();
    Object.defineProperty(global, 'navigator', {
        writable: false,
        value: { usb: webusb },
    });
    Object.defineProperty(global, 'window', {
        writable: false,
        value: global,
    });
    Object.defineProperty(global, 'alert', {
        writable: false,
        value: (text) => electron_1.dialog.showMessageBoxSync(window, { message: text }),
    });
    const service = new translations_1.EWMDNetMD({ debug: true });
    let currentObj = service;
    console.log(currentObj);
    const defList = traverseObject(window, () => currentObj, "_netmd_");
    electron_1.ipcMain.handle('_netmd__definedParameters', () => defList);
    let alreadySwitched = false;
    let factoryIface = null;
    let factoryDefList = [];
    electron_1.ipcMain.handle('reload', reload.bind(null, window));
    electron_1.ipcMain.handle('getMiniDiscDiagnostics', () => (0, device_diagnostics_1.getMiniDiscDiagnostics)());
    electron_1.ipcMain.handle('openWindowsDriverGuide', () => electron_1.dialog.showMessageBox(window, {
        type: 'info',
        title: 'MiniDisc WinUSB 드라이버 안내',
        message: '별도의 드라이버 프로그램을 설치할 필요가 없습니다.',
        detail: [
            '1. MiniDisc 기기를 USB로 연결합니다.',
            '2. 사용할 NetMD 또는 Hi-MD 연결 버튼을 누릅니다.',
            '3. WinUSB가 없으면 표시되는 안내에서 “WinUSB 설치”를 누릅니다.',
            '4. Windows 관리자 권한 확인 창을 허용합니다.',
            '',
            'NetMD와 Hi-MD의 USB ID가 다른 기기는 각 모드에서 처음 한 번씩 설치해야 합니다.',
        ].join('\n'),
        buttons: ['확인'],
    }));
    const modeSwitchStore = new electron_store_1.default({ name: 'minidisc-mode-switch' });
    const rememberPendingMiniDiscMode = (mode) => {
        modeSwitchStore.set('pending', {
            mode,
            createdAt: Date.now(),
            creatorPid: process.pid,
        });
    };
    const clearPendingMiniDiscMode = () => modeSwitchStore.delete('pending');
    electron_1.ipcMain.handle('consumePendingMiniDiscMode', () => {
        const pending = modeSwitchStore.get('pending', null);
        if (!pending ||
            (pending.mode !== 'netmd' && pending.mode !== 'himd') ||
            typeof pending.createdAt !== 'number' ||
            Date.now() - pending.createdAt > 60000) {
            clearPendingMiniDiscMode();
            return null;
        }
        // Do not feed the request back to the process that initiated it.
        // A relaunched app has a new PID and may consume it once.
        if (pending.creatorPid === process.pid)
            return null;
        const diagnostics = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
        const ready = diagnostics.devices.some((device) => device.mode === pending.mode);
        if (!ready)
            return null;
        clearPendingMiniDiscMode();
        return pending.mode;
    });
    electron_1.ipcMain.handle('peekPendingMiniDiscMode', () => {
        const pending = modeSwitchStore.get('pending', null);
        if (!pending ||
            (pending.mode !== 'netmd' && pending.mode !== 'himd') ||
            typeof pending.createdAt !== 'number' ||
            Date.now() - pending.createdAt > 60000) {
            clearPendingMiniDiscMode();
            return null;
        }
        return pending.creatorPid === process.pid ? null : pending.mode;
    });
    const switchHiMDInterfaceToNetMD = async (device) => {
        if (!device?.supportsHiMD || device.driverStatus !== 'winusb') {
            return { ok: false, message: '전환할 Hi-MD WinUSB 인터페이스를 찾지 못했습니다.' };
        }
        webusb.setPreferredDevice(device);
        let driver;
        let commandError;
        try {
            if (himdService.fsDriver || himdService.himd) {
                try {
                    await withTimeout(himdService.finalize(), 4000, '이전 Hi-MD 연결 정리 시간이 초과되었습니다.');
                }
                catch (cleanupError) {
                    console.log('Previous Hi-MD interface cleanup failed:', cleanupError);
                }
            }
            const paired = await withTimeout(himdService.pair(), 10000, `${device.modelHint}의 Hi-MD USB 인터페이스를 여는 시간이 초과되었습니다.`);
            if (!paired || !himdService.fsDriver?.driver) {
                return { ok: false, message: `${device.modelHint}의 Hi-MD USB 인터페이스를 열지 못했습니다.` };
            }
            driver = himdService.fsDriver.driver;
            await withTimeout(driver.init(), 10000, 'Hi-MD USB 명령 인터페이스 준비 시간이 초과되었습니다.');
            const switchCommand = new Uint8Array([
                0xc2, 0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]);
            rememberPendingMiniDiscMode('netmd');
            try {
                await withTimeout(driver.sendCommandInGetResult(switchCommand, 0, true, switchCommand.length), 10000, 'NetMD 인터페이스 전환 명령 시간이 초과되었습니다.');
            }
            catch (error) {
                // Switching interfaces disconnects the old Hi-MD USB handle before
                // the command status can be returned, so a USB error is expected.
                commandError = error;
                console.log('Hi-MD to NetMD interface switch disconnected the old handle:', error);
            }
            for (let attempt = 0; attempt < 24; attempt++) {
                await wait(500);
                const refreshed = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
                const switched = refreshed.devices.find((candidate) => candidate.mode === 'netmd');
                if (switched) {
                    webusb.setPreferredDevice(switched);
                    return {
                        ok: true,
                        message: `${switched.modelHint}이(가) NetMD USB 모드(${switched.vendorIdHex}:${switched.productIdHex})로 전환되었습니다.`,
                        device: switched,
                    };
                }
            }
            return {
                ok: false,
                message: commandError
                    ? `NetMD 인터페이스 전환 명령 후 장치가 다시 나타나지 않았습니다: ${commandError instanceof Error ? commandError.message : String(commandError)}`
                    : 'NetMD 인터페이스 전환 명령은 완료됐지만 장치가 NetMD USB 모드로 다시 나타나지 않았습니다.',
            };
        }
        catch (error) {
            clearPendingMiniDiscMode();
            return {
                ok: false,
                message: `NetMD 인터페이스 전환 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
        finally {
            himdService.fsDriver = undefined;
            himdService.himd = undefined;
            himdService.cachedDisc = undefined;
            himdService.session = null;
            if (driver) {
                Promise.resolve(driver.close()).catch(() => { });
            }
        }
    };
    const hiMDProductsByNetMDProduct = new Map([
        [0x017e, [0x017f]],
        [0x0180, [0x0181]],
        [0x0182, [0x0183]],
        [0x0184, [0x0185]],
        [0x0186, [0x0187]],
        [0x0219, [0x021a]],
        [0x021b, [0x021c]],
        [0x021d, [0x022d]],
        [0x022c, [0x022d]],
        [0x0286, [0x0287]],
    ]);
    const switchNetMDInterfaceToHiMD = async (device) => {
        const expectedProducts = hiMDProductsByNetMDProduct.get(device?.productId);
        if (!device?.supportsNetMD || device.driverStatus !== 'winusb' || !expectedProducts) {
            return { ok: false, message: 'Hi-MD 전환을 지원하는 NetMD WinUSB 인터페이스를 찾지 못했습니다.' };
        }
        webusb.setPreferredDevice(device);
        let openedInterface;
        let commandError;
        try {
            if (service.netmdInterface) {
                try {
                    await withTimeout(service.finalize(), 4000, '이전 NetMD 연결 정리 시간이 초과되었습니다.');
                }
                catch (cleanupError) {
                    console.log('Previous NetMD interface cleanup failed:', cleanupError);
                }
            }
            const paired = await withTimeout(service.pair(), 12000, `${device.modelHint}의 NetMD USB 인터페이스를 여는 시간이 초과되었습니다.`);
            if (!paired || !service.netmdInterface) {
                return { ok: false, message: `${device.modelHint}의 NetMD USB 인터페이스를 열지 못했습니다.` };
            }
            openedInterface = service.netmdInterface;
            const openedDevice = openedInterface.netMd;
            if (openedDevice.getVendor() !== device.vendorId || openedDevice.getProduct() !== device.productId) {
                return { ok: false, message: '선택한 기기와 실제 열린 기기가 달라 인터페이스 전환을 중단했습니다.' };
            }
            try {
                // This is only the interface switch. Unlike formatToHiMD(),
                // it does not call eraseDisc() and does not modify media data.
                rememberPendingMiniDiscMode('himd');
                await withTimeout(openedInterface.enterHiMDMode(), 10000, 'Hi-MD 인터페이스 전환 명령 시간이 초과되었습니다.');
            }
            catch (error) {
                // A successful mode change normally disconnects the NetMD handle
                // before the command response is returned.
                commandError = error;
                console.log('NetMD to Hi-MD interface switch disconnected the old handle:', error);
            }
            for (let attempt = 0; attempt < 24; attempt++) {
                await wait(500);
                const refreshed = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
                const switched = refreshed.devices.find((candidate) => candidate.vendorId === device.vendorId &&
                    expectedProducts.includes(candidate.productId));
                if (switched) {
                    webusb.setPreferredDevice(switched);
                    return {
                        ok: true,
                        message: `${switched.modelHint}이(가) Hi-MD USB 모드(${switched.vendorIdHex}:${switched.productIdHex})로 전환되었습니다.`,
                        device: switched,
                    };
                }
            }
            return {
                ok: false,
                message: commandError
                    ? `Hi-MD 인터페이스 전환 명령 후 장치가 다시 나타나지 않았습니다: ${commandError instanceof Error ? commandError.message : String(commandError)}`
                    : 'Hi-MD 인터페이스 전환 명령은 완료됐지만 장치가 Hi-MD USB 모드로 다시 나타나지 않았습니다.',
            };
        }
        catch (error) {
            clearPendingMiniDiscMode();
            return {
                ok: false,
                message: `Hi-MD 인터페이스 전환 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
        finally {
            service.netmdInterface = undefined;
            service.dropCachedContentList();
            if (openedInterface) {
                Promise.resolve(openedInterface.netMd.finalize()).catch(() => { });
            }
        }
    };
    const restartMiniDiscUsbInterface = async (requestedMode, askConfirmation = true) => {
        if (process.platform !== 'win32') {
            return { ok: false, message: 'USB 모드 자동 전환은 Windows 전용입니다.' };
        }
        if (requestedMode !== 'netmd' && requestedMode !== 'himd') {
            return { ok: false, message: '알 수 없는 MiniDisc 연결 모드입니다.' };
        }
        const diagnostics = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
        const device = diagnostics.devices.find((candidate) => candidate.mode !== requestedMode) ||
            diagnostics.devices[0];
        if (!device?.driverInstanceId) {
            return { ok: false, message: '다시 시작할 MiniDisc USB 장치 인스턴스를 찾지 못했습니다.' };
        }
        const modeName = requestedMode === 'netmd' ? 'NetMD' : 'Hi-MD';
        if (askConfirmation) {
            const confirmation = await electron_1.dialog.showMessageBox(window, {
                type: 'question',
                title: 'USB 모드 자동 전환',
                message: `${device.modelHint}의 USB 인터페이스를 다시 시작할까요?`,
                detail: [
                    `현재 USB ID: ${device.vendorIdHex}:${device.productIdHex}`,
                    `목표 모드: ${modeName}`,
                    '',
                    'Windows 장치만 소프트웨어로 다시 시작하며 디스크 데이터는 변경하지 않습니다.',
                    '관리자 권한 확인 창이 나타나면 허용해 주세요.',
                ].join('\n'),
                buttons: ['취소', '다시 시작'],
                defaultId: 1,
                cancelId: 0,
                noLink: true,
            });
            if (confirmation.response === 0) {
                return { ok: false, cancelled: true };
            }
        }
        const quotePowerShell = (value) => `'${String(value).replace(/'/g, "''")}'`;
        const powerShellScript = [
            '$ErrorActionPreference = "Stop"',
            `$process = Start-Process -FilePath 'pnputil.exe' -ArgumentList @('/restart-device', ${quotePowerShell(device.driverInstanceId)}) -Verb RunAs -WindowStyle Hidden -Wait -PassThru`,
            'exit $process.ExitCode',
        ].join('\r\n');
        const encodedScript = Buffer.from(powerShellScript, 'utf16le').toString('base64');
        try {
            const exitCode = await new Promise((resolve, reject) => {
                const child = (0, child_process_1.spawn)('powershell.exe', [
                    '-NoProfile',
                    '-NonInteractive',
                    '-EncodedCommand',
                    encodedScript,
                ], { windowsHide: true, stdio: 'ignore' });
                const timeout = setTimeout(() => {
                    try {
                        child.kill();
                    }
                    catch (_) { }
                    reject(new Error('Windows 장치 다시 시작 시간이 초과되었습니다.'));
                }, 60000);
                child.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
                child.once('exit', (code) => {
                    clearTimeout(timeout);
                    resolve(code ?? -1);
                });
            });
            if (exitCode !== 0) {
                return { ok: false, message: `Windows가 장치 다시 시작을 완료하지 못했습니다. 종료 코드: ${exitCode}` };
            }
            for (let attempt = 0; attempt < 16; attempt++) {
                await wait(500);
                const refreshed = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
                const switched = refreshed.devices.find((candidate) => candidate.mode === requestedMode);
                if (switched) {
                    webusb.setPreferredDevice(switched);
                    return {
                        ok: true,
                        message: `${switched.modelHint}이(가) ${modeName} USB 모드(${switched.vendorIdHex}:${switched.productIdHex})로 다시 연결되었습니다.`,
                        device: switched,
                    };
                }
            }
            return {
                ok: false,
                message: `장치는 다시 시작했지만 ${modeName} USB 모드로 바뀌지 않았습니다. 이 기기에서는 한 번의 물리적 USB 재연결이 필요할 수 있습니다.`,
            };
        }
        catch (error) {
            return {
                ok: false,
                message: `USB 장치 다시 시작 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    };
    electron_1.ipcMain.handle('restartMiniDiscUsbInterface', (_, requestedMode) => restartMiniDiscUsbInterface(requestedMode, true));
    electron_1.ipcMain.handle('prepareMiniDiscConnection', async (_, requestedMode, selectedDeviceId) => {
        if (process.platform !== 'win32') {
            return { proceed: true };
        }
        if (requestedMode !== 'netmd' && requestedMode !== 'himd') {
            return { proceed: false, message: '알 수 없는 MiniDisc 연결 모드입니다.' };
        }
        // RH1-class devices need a short settling period after a physical
        // media change. Opening the mass-storage interface too early can
        // leave the first Hi-MD attempt waiting until its timeout.
        if (requestedMode === 'himd') {
            await wait(1500);
        }
        let diagnostics = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
        let candidates = diagnostics.devices.filter((device) => requestedMode === 'netmd' ? device.supportsNetMD : device.supportsHiMD);
        if (candidates.length === 0 && diagnostics.devices.length > 0) {
            const hiMDDevice = requestedMode === 'netmd'
                ? diagnostics.devices.find((device) => device.supportsHiMD && device.mode === 'himd')
                : undefined;
            const netMDDevice = requestedMode === 'himd'
                ? diagnostics.devices.find((device) => device.supportsNetMD &&
                    device.mode === 'netmd' &&
                    hiMDProductsByNetMDProduct.has(device.productId))
                : undefined;
            const restartResult = hiMDDevice
                ? await switchHiMDInterfaceToNetMD(hiMDDevice)
                : netMDDevice
                    ? await switchNetMDInterfaceToHiMD(netMDDevice)
                    : await restartMiniDiscUsbInterface(requestedMode, false);
            if (restartResult.ok) {
                diagnostics = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
                candidates = diagnostics.devices.filter((device) => requestedMode === 'netmd' ? device.supportsNetMD : device.supportsHiMD);
            }
            else {
                return {
                    proceed: false,
                    modeSwitchFailed: true,
                    warning: {
                        title: 'USB 모드 자동 전환 실패',
                        message: restartResult.message || 'MiniDisc USB 모드를 자동으로 전환하지 못했습니다.',
                        detail: '디스크 데이터는 변경되지 않았습니다. 잠시 기다린 뒤 같은 연결 버튼을 다시 눌러보세요.',
                    },
                };
            }
        }
        if (candidates.length === 0) {
            webusb.clearPreferredDevice();
            // Let the original connection flow display its normal no-device dialog.
            return { proceed: true };
        }
        let device = candidates[0];
        if (candidates.length > 1) {
            const getSelectionId = (candidate) => [
                candidate.vendorIdHex,
                candidate.productIdHex,
                candidate.busNumber ?? '',
                candidate.deviceAddress ?? '',
            ].join(':');
            device = selectedDeviceId
                ? candidates.find((candidate) => getSelectionId(candidate) === selectedDeviceId)
                : undefined;
            if (!device) {
                webusb.clearPreferredDevice();
                return {
                    proceed: false,
                    selectionRequired: true,
                    requestedMode,
                    candidates: candidates.map((candidate) => ({
                        selectionId: getSelectionId(candidate),
                        modelHint: candidate.modelHint,
                        vendorIdHex: candidate.vendorIdHex,
                        productIdHex: candidate.productIdHex,
                        busNumber: candidate.busNumber,
                        deviceAddress: candidate.deviceAddress,
                        mode: candidate.mode,
                        driverStatus: candidate.driverStatus,
                    })),
                };
            }
        }
        webusb.setPreferredDevice(device);
        if (device.driverStatus === 'winusb') {
            return { proceed: true, device };
        }
        const modeName = requestedMode === 'netmd' ? 'NetMD' : 'Hi-MD';
        const currentDriver = device.driverName || {
            usbstor: 'USBSTOR',
            unknown: '확인되지 않음',
            other: '다른 드라이버',
        }[device.driverStatus] || device.driverStatus;
        const confirmation = await electron_1.dialog.showMessageBox(window, {
            type: 'warning',
            title: 'WinUSB 드라이버가 필요합니다',
            message: `${device.modelHint}을(를) ${modeName}로 연결하려면 WinUSB가 필요합니다.`,
            detail: [
                `USB ID: ${device.vendorIdHex}:${device.productIdHex}`,
                `현재 드라이버: ${currentDriver}`,
                '',
                '확인을 누르면 이 기기만 대상으로 WinUSB 드라이버를 자동 설치합니다.',
                '관리자 권한 확인 창(UAC)이 나타나면 허용해 주세요.',
                '',
                '설치 중에는 USB 케이블을 분리하지 마세요.',
            ].join('\n'),
            buttons: ['취소', 'WinUSB 설치'],
            defaultId: 1,
            cancelId: 0,
            noLink: true,
        });
        if (confirmation.response === 0) {
            return { proceed: false, cancelled: true };
        }
        const extrasDirectory = path_1.default.join(electron_1.app.getAppPath(), 'extras');
        const installerPath = path_1.default.join(extrasDirectory, 'wmdp-driver-helper.exe');
        if (!fs_1.default.existsSync(installerPath)) {
            await electron_1.dialog.showMessageBox(window, {
                type: 'error',
                title: '설치 도우미를 찾을 수 없습니다',
                message: '내장 WinUSB 설치 엔진을 찾지 못했습니다.',
                detail: installerPath,
                buttons: ['확인'],
            });
            return { proceed: false, installerMissing: true };
        }
        const publishDriverInstallStatus = (status) => {
            if (!window.isDestroyed()) {
                window.webContents.send('miniDiscDriverInstallStatus', {
                    deviceName: device.modelHint,
                    modeName,
                    ...status,
                });
            }
        };
        const driverWorkDirectory = path_1.default.join(electron_1.app.getPath('temp'), 'WebMiniDisc-Pro-Driver', `${device.vendorIdHex}_${device.productIdHex}`);
        const driverOutputDirectory = path_1.default.join(driverWorkDirectory, 'driver');
        const installerResultPath = path_1.default.join(driverWorkDirectory, 'installer-result.txt');
        fs_1.default.mkdirSync(driverWorkDirectory, { recursive: true });
        fs_1.default.mkdirSync(driverOutputDirectory, { recursive: true });
        fs_1.default.writeFileSync(installerResultPath, 'pending', 'utf8');
        const helperArguments = [
            '--name', String(device.modelHint || 'MiniDisc_Device').replace(/[^A-Za-z0-9_.-]/g, '_'),
            '--manufacturer', 'WebMiniDisc',
            '--vid', `0x${device.vendorId.toString(16).padStart(4, '0')}`,
            '--pid', `0x${device.productId.toString(16).padStart(4, '0')}`,
            '--type', '0',
            '--dest', 'driver',
            '--silent',
            '--timeout', '120000',
        ];
        const quotePowerShell = (value) => `'${String(value).replace(/'/g, "''")}'`;
        const startInstallerCommand = [
            `$process = Start-Process -FilePath ${quotePowerShell(installerPath)}`,
            `-ArgumentList @(${helperArguments.map(quotePowerShell).join(',')})`,
            `-WorkingDirectory ${quotePowerShell(driverWorkDirectory)}`,
            '-Verb RunAs -WindowStyle Hidden -Wait -PassThru',
        ].join(' ');
        const powerShellScript = [
            'try {',
            `  ${startInstallerCommand}`,
            `  [System.IO.File]::WriteAllText(${quotePowerShell(installerResultPath)}, [string]$process.ExitCode)`,
            '  exit 0',
            '} catch {',
            `  [System.IO.File]::WriteAllText(${quotePowerShell(installerResultPath)}, ('launch-error:' + $_.Exception.Message))`,
            '  exit 1',
            '}',
        ].join('\r\n');
        const encodedPowerShellScript = Buffer.from(powerShellScript, 'utf16le').toString('base64');
        let powerShellExitCode = -1;
        let installerTimedOut = false;
        publishDriverInstallStatus({
            phase: 'installing',
            startedAt: Date.now(),
            timeoutMs: 180000,
        });
        try {
            const installerProcessResult = await new Promise((resolve, reject) => {
                const child = (0, child_process_1.spawn)('powershell.exe', [
                    '-NoProfile',
                    '-NonInteractive',
                    '-EncodedCommand',
                    encodedPowerShellScript,
                ], {
                    windowsHide: true,
                    stdio: 'ignore',
                });
                let settled = false;
                const finish = (result) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timeout);
                    resolve(result);
                };
                const timeout = setTimeout(() => {
                    try {
                        child.kill();
                    }
                    catch (_) {
                        // The elevated helper has its own timeout and may already be exiting.
                    }
                    finish({ code: -1, timedOut: true });
                }, 180000);
                child.once('error', (error) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timeout);
                    reject(error);
                });
                child.once('exit', (code) => finish({ code: code ?? -1, timedOut: false }));
            });
            powerShellExitCode = installerProcessResult.code;
            installerTimedOut = installerProcessResult.timedOut;
        }
        catch (error) {
            publishDriverInstallStatus({ phase: 'close' });
            await electron_1.dialog.showMessageBox(window, {
                type: 'error',
                title: '설치 도우미 실행 실패',
                message: '내장 WinUSB 설치 엔진을 실행하지 못했습니다.',
                detail: error instanceof Error ? error.message : String(error),
                buttons: ['확인'],
            });
            return { proceed: false, installerFailed: true };
        }
        if (installerTimedOut) {
            publishDriverInstallStatus({ phase: 'close' });
            await electron_1.dialog.showMessageBox(window, {
                type: 'error',
                title: 'WinUSB 설치 응답 없음',
                message: '설치 도우미가 제한 시간 안에 응답하지 않았습니다.',
                detail: [
                    '관리자 권한 확인 창이 다른 창 뒤에 있었거나 Windows가 설치를 완료하지 못했을 수 있습니다.',
                    'USB 케이블을 분리하지 말고 잠시 기다린 뒤 MiniDisc 연결 진단에서 드라이버 상태를 확인하세요.',
                ].join('\n'),
                buttons: ['확인'],
            });
            return { proceed: false, installerFailed: true, installerTimedOut: true };
        }
        publishDriverInstallStatus({ phase: 'verifying' });
        const installerResult = fs_1.default.readFileSync(installerResultPath, 'utf8').trim();
        if (installerResult.startsWith('launch-error:')) {
            publishDriverInstallStatus({ phase: 'close' });
            await electron_1.dialog.showMessageBox(window, {
                type: 'error',
                title: '설치 도우미 실행 실패',
                message: '관리자 권한으로 설치 엔진을 시작하지 못했습니다.',
                detail: installerResult.slice('launch-error:'.length) || 'Windows가 실행 요청을 거부했습니다.',
                buttons: ['확인'],
            });
            return { proceed: false, installerFailed: true };
        }
        const installerExitCode = Number.parseInt(installerResult, 10);
        if (!Number.isFinite(installerExitCode)) {
            publishDriverInstallStatus({ phase: 'close' });
            await electron_1.dialog.showMessageBox(window, {
                type: 'error',
                title: '설치 결과 확인 실패',
                message: '설치 엔진의 결과를 읽지 못했습니다.',
                detail: `PowerShell 종료 코드: ${powerShellExitCode}`,
                buttons: ['확인'],
            });
            return { proceed: false, installerFailed: true };
        }
        await new Promise(resolve => setTimeout(resolve, 1200));
        const refreshedDiagnostics = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
        const refreshedDevice = refreshedDiagnostics.devices.find((candidate) => candidate.vendorId === device.vendorId &&
            candidate.productId === device.productId);
        if (refreshedDevice?.driverStatus === 'winusb') {
            webusb.setPreferredDevice(refreshedDevice);
            publishDriverInstallStatus({ phase: 'close' });
            await electron_1.dialog.showMessageBox(window, {
                type: 'info',
                title: 'WinUSB 설치 완료',
                message: `${device.modelHint}의 WinUSB 드라이버를 설치했습니다.`,
                detail: installerExitCode === 0
                    ? `${modeName} 연결을 계속합니다.`
                    : `Windows에서 설치 성공을 확인했습니다. 설치 엔진의 마지막 응답(${installerExitCode})은 기기 재연결 과정에서 끊겼지만 정상입니다.`,
                buttons: ['확인'],
            });
            return { proceed: true, installed: true, device: refreshedDevice };
        }
        if (installerExitCode !== 0) {
            const installerErrorDescriptions = {
                '-1': '드라이버 파일 입출력 오류',
                '-2': '잘못된 설치 인수',
                '-3': '드라이버 작업 폴더 접근 실패',
                '-4': '연결된 대상 기기를 찾지 못함',
                '-6': '기기가 다른 프로그램에서 사용 중',
                '-7': '드라이버 설치 시간 초과',
                '-9': 'Windows에서 다른 드라이버 설치가 진행 중',
                '-11': '드라이버 설치 리소스 처리 오류',
                '-14': '사용자가 설치를 취소함',
                '-15': '관리자 권한이 필요함',
                '-17': '생성된 INF 파일 구문 오류',
                '-18': '드라이버 서명 카탈로그 누락',
                '-19': 'Windows가 드라이버 서명을 거부함',
            };
            publishDriverInstallStatus({ phase: 'close' });
            await electron_1.dialog.showMessageBox(window, {
                type: 'error',
                title: 'WinUSB 설치 실패',
                message: '드라이버 설치를 완료하지 못했습니다.',
                detail: `${installerErrorDescriptions[String(installerExitCode)] || '알 수 없는 설치 오류'}\n설치 엔진 종료 코드: ${installerExitCode}`,
                buttons: ['확인'],
            });
            return { proceed: false, installerFailed: true, installerExitCode };
        }
        publishDriverInstallStatus({ phase: 'close' });
        await electron_1.dialog.showMessageBox(window, {
            type: 'info',
            title: 'WinUSB 설치 완료',
            message: '드라이버 설치를 완료했습니다.',
            detail: '기기가 아직 다시 표시되지 않습니다. USB 케이블을 뺐다가 다시 연결한 뒤 같은 연결 버튼을 눌러주세요.',
            buttons: ['확인'],
        });
        return {
            proceed: false,
            installed: true,
            reconnectRequired: true,
            device,
        };
    });
    electron_1.ipcMain.handle('formatStandardMDToNetMD', async () => {
        if (process.platform !== 'win32') {
            return { ok: false, message: '이 기능은 Windows 전용입니다.' };
        }
        const diagnostics = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
        const hiMDDevices = diagnostics.devices.filter(device => device.supportsHiMD);
        if (hiMDDevices.length === 0) {
            return { ok: false, message: 'Hi-MD 모드로 연결된 지원 기기를 찾지 못했습니다.' };
        }
        if (hiMDDevices.length > 1) {
            return { ok: false, message: '안전을 위해 포맷할 Hi-MD 기기 하나만 USB에 연결해 주세요.' };
        }
        const hiMDDevice = hiMDDevices[0];
        if (hiMDDevice.driverStatus !== 'winusb') {
            return {
                ok: false,
                message: `${hiMDDevice.modelHint}의 현재 Hi-MD 인터페이스에 WinUSB를 먼저 설치해 주세요.`,
            };
        }
        const confirmation = await electron_1.dialog.showMessageBox(window, {
            type: 'warning',
            title: 'NetMD로 포맷',
            message: '현재 디스크를 일반 MD(NetMD)용으로 초기화하시겠습니까?',
            detail: [
                '디스크의 모든 트랙과 데이터가 영구적으로 삭제됩니다.',
                '60/74/80분 일반 MD만 변환할 수 있습니다.',
                '1GB Hi-MD 전용 미디어에는 사용할 수 없습니다.',
                '',
                `대상 기기: ${hiMDDevice.modelHint} (${hiMDDevice.vendorIdHex}:${hiMDDevice.productIdHex})`,
                '포맷 후 기기의 USB 인터페이스를 NetMD로 전환합니다.',
            ].join('\n'),
            buttons: ['취소', '모든 데이터를 지우고 NetMD로 포맷'],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
        });
        if (confirmation.response !== 1) {
            return { ok: false, cancelled: true, message: '포맷을 취소했습니다.' };
        }
        webusb.setPreferredDevice(hiMDDevice);
        try {
            if (himdService.atdata !== null) {
                return { ok: false, message: 'Hi-MD 전송 작업이 진행 중입니다. 작업을 마친 뒤 다시 시도해 주세요.' };
            }
            if (himdService.fsDriver || himdService.himd) {
                try {
                    await withTimeout(himdService.finalize(), 4000, '이전 Hi-MD 연결 정리 시간이 초과되었습니다.');
                }
                catch (cleanupError) {
                    console.log('Previous Hi-MD format connection cleanup failed:', cleanupError);
                }
            }
            const paired = await withTimeout(himdService.pair(), 10000, `${hiMDDevice.modelHint}의 Hi-MD USB 인터페이스를 여는 시간이 초과되었습니다.`);
            if (!paired) {
                return { ok: false, message: `${hiMDDevice.modelHint}의 Hi-MD 인터페이스를 열지 못했습니다.` };
            }
            await withTimeout(himdService.initHiMD(), 30000, 'Hi-MD 파일시스템을 읽는 시간이 초과되었습니다. 일반 MD가 들어 있다면 USB를 다시 연결해 주세요.', 'HIMD_TIMEOUT');
            const capacity = await withTimeout(himdService.fsDriver.getTotalSpace(), 10000, '디스크 용량 확인 시간이 초과되었습니다.');
            if (capacity > 500000000) {
                return {
                    ok: false,
                    message: '1GB Hi-MD 전용 미디어는 일반 MD 형식으로 변환할 수 없습니다.',
                };
            }
            const driver = himdService.fsDriver.driver;
            await driver.wipe();
            const switchCommand = new Uint8Array([
                0xc2, 0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]);
            let switchError;
            try {
                await driver.sendCommandInGetResult(switchCommand, 0, true, switchCommand.length);
            }
            catch (error) {
                // A successful interface switch normally disconnects the Hi-MD USB ID before
                // the command result can be returned, which surfaces as a USB error.
                switchError = error;
                console.log('MiniDisc interface switch disconnected the Hi-MD handle:', error);
            }
            return {
                ok: true,
                erased: true,
                switchRequested: true,
                capacity,
                message: switchError
                    ? '디스크 초기화가 완료되었습니다. 장치가 자동 전환되지 않으면 USB를 한 번 다시 연결해 주세요.'
                    : '디스크 초기화와 NetMD 인터페이스 전환을 요청했습니다.',
            };
        }
        catch (error) {
            console.error('NetMD format failed:', error);
            return {
                ok: false,
                message: error?.code === 'HIMD_TIMEOUT'
                    ? 'Hi-MD 파일시스템을 읽지 못했습니다. 디스크가 이미 일반 MD 형식일 수 있습니다. USB 케이블을 분리했다 다시 연결한 뒤 NetMD를 선택해 주세요.'
                    : error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            const driver = himdService.fsDriver?.driver;
            himdService.fsDriver = undefined;
            himdService.himd = undefined;
            himdService.cachedDisc = undefined;
            himdService.session = null;
            webusb.clearPreferredDevice();
            Promise.resolve(driver?.close()).catch(() => { });
        }
    });
    electron_1.ipcMain.handle('_switchToFactory', async () => {
        factoryIface = await service.factory();
        if (alreadySwitched)
            return factoryDefList;
        alreadySwitched = true;
        factoryDefList = traverseObject(window, () => factoryIface, "_factory__");
        // exploitDownloadTrack uses nested objects with callbacks, and callbacks with return values.
        // The nomral ipc-copying code can't be used for that.
        let shouldAbortAtracDownload = false;
        let handleBadSectorResolve = null;
        electron_1.ipcMain.removeHandler('_factory__exploitDownloadTrack');
        electron_1.ipcMain.handle('_factory__exploitDownloadTrack', async (_, ...allArgs) => {
            handleBadSectorResolve = null;
            shouldAbortAtracDownload = false;
            const enableHandleBadSector = allArgs[3].handleBadSector;
            const enableShouldCancelImmediately = allArgs[3].handleBadSector;
            allArgs[3] = Object.assign(Object.assign({}, allArgs[3]), { handleBadSector: async (...args) => {
                    window.webContents.send('_atracdl_callback_handleBadSector', ...args);
                    return await new Promise(res => handleBadSectorResolve = res);
                }, shouldCancelImmediately: () => shouldAbortAtracDownload });
            if (!enableHandleBadSector)
                delete allArgs[3].handleBadSector;
            if (!enableShouldCancelImmediately)
                delete allArgs[3].shouldCancelImmediately;
            allArgs[2] = async (...args) => window.webContents.send('_callback', `_factory__exploitDownloadTrack_callback2`, ...args);
            try {
                return [await factoryIface.exploitDownloadTrack(...allArgs), null];
            }
            catch (err) {
                console.log("Node Error: ");
                console.log(err);
                return [null, err];
            }
        });
        electron_1.ipcMain.handle('_atracdl_cancel', () => shouldAbortAtracDownload = true);
        electron_1.ipcMain.handle('_atracdl_callback_handleBadSector_return', (_, status) => handleBadSectorResolve === null || handleBadSectorResolve === void 0 ? void 0 : handleBadSectorResolve(status));
        return factoryDefList;
    });
    const himdService = new translations_1.EWMDHiMD({ debug: true });
    const transferMethods = new Set(['prepareUpload', 'upload', 'finalizeUpload', 'download']);
    const hasActiveTransfer = serviceObject => [...(serviceObject.__activeIpcMethods ?? [])].some(method => transferMethods.has(method));
    electron_1.ipcMain.handle('setRH1KoreanTitleExperiment', async (_, requestedState) => {
        const enabled = Boolean(requestedState);
        if (himdService.atdata !== null || hasActiveTransfer(himdService)) {
            return {
                ok: false,
                enabled: Boolean(himdService.spec.experimentalKoreanTitles),
                message: '전송 중에는 한글 제목 실험 설정을 바꿀 수 없습니다.',
            };
        }
        if (enabled) {
            const activeDevice = himdService.fsDriver?.usbDevice;
            const isRH1HiMD = activeDevice?.vendorId === 0x054c && activeDevice?.productId === 0x0287;
            if (!isRH1HiMD) {
                himdService.spec.experimentalKoreanTitles = false;
                return {
                    ok: false,
                    enabled: false,
                    message: '이 실험 기능은 Hi-MD 모드의 Sony MZ-RH1(0x054c:0x0287)에서만 켤 수 있습니다.',
                };
            }
        }
        himdService.spec.experimentalKoreanTitles = enabled;
        return {
            ok: true,
            enabled,
        };
    });
    const clearMiniDiscConnections = async () => {
        if (himdService.atdata !== null || hasActiveTransfer(service) || hasActiveTransfer(himdService)) {
            return {
                ok: false,
                busy: true,
                message: '현재 전송 작업이 진행 중입니다. 작업이 끝난 뒤 모드 선택 화면으로 돌아가 주세요.',
            };
        }
        const warnings = [];
        try {
            await withTimeout(service.finalize(), 4000, 'NetMD 연결 정리 시간이 초과되었습니다.');
        }
        catch (error) {
            if (service.netmdInterface)
                warnings.push(`NetMD: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            service.netmdInterface = undefined;
            service.dropCachedContentList();
        }
        try {
            await withTimeout(himdService.finalize(), 5000, 'Hi-MD 연결 정리 시간이 초과되었습니다.');
        }
        catch (error) {
            warnings.push(`Hi-MD: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            himdService.fsDriver = undefined;
            himdService.himd = undefined;
            himdService.cachedDisc = undefined;
            himdService.session = null;
            himdService.streamingWorker = null;
            himdService.spec.experimentalKoreanTitles = false;
        }
        webusb.clearPreferredDevice();
        return {
            ok: true,
            warning: warnings.length > 0 ? warnings.join('\n') : undefined,
        };
    };
    electron_1.ipcMain.handle('returnToModeSelection', async () => clearMiniDiscConnections());
    electron_1.ipcMain.handle('formatStandardMDToHiMD', async () => {
        if (process.platform !== 'win32') {
            return { ok: false, message: '이 기능은 Windows 전용입니다.' };
        }
        const diagnostics = (0, device_diagnostics_1.getMiniDiscDiagnostics)();
        const candidates = diagnostics.devices.filter(device => device.supportsNetMD && device.mode === 'netmd');
        if (candidates.length === 0) {
            return {
                ok: false,
                message: 'NetMD USB 인터페이스로 연결된 Hi-MD 지원 기기를 찾지 못했습니다.',
            };
        }
        let targetDevice = candidates[0];
        if (candidates.length > 1) {
            const selection = await electron_1.dialog.showMessageBox(window, {
                type: 'question',
                title: 'Hi-MD로 포맷할 기기 선택',
                message: '디스크를 지울 기기를 정확히 선택하세요.',
                buttons: ['취소', ...candidates.map(device => `${device.modelHint} (${device.vendorIdHex}:${device.productIdHex})`)],
                defaultId: 0,
                cancelId: 0,
                noLink: true,
            });
            if (selection.response === 0)
                return { ok: false, cancelled: true, message: '포맷을 취소했습니다.' };
            targetDevice = candidates[selection.response - 1];
        }
        if (!targetDevice)
            return { ok: false, cancelled: true, message: '포맷할 기기를 선택하지 않았습니다.' };
        if (targetDevice.driverStatus !== 'winusb') {
            return {
                ok: false,
                message: `${targetDevice.modelHint}의 NetMD 인터페이스에 WinUSB를 먼저 설치해 주세요.`,
            };
        }
        if (hasActiveTransfer(service) || hasActiveTransfer(himdService) || himdService.atdata !== null) {
            return { ok: false, message: '현재 전송 작업이 진행 중입니다. 작업을 마친 뒤 다시 시도해 주세요.' };
        }
        webusb.setPreferredDevice(targetDevice);
        let switchRequested = false;
        try {
            if (service.netmdInterface) {
                try {
                    await withTimeout(service.finalize(), 4000, '이전 NetMD 연결 정리 시간이 초과되었습니다.');
                }
                catch (cleanupError) {
                    console.log('Previous NetMD connection cleanup failed:', cleanupError);
                }
            }
            const paired = await withTimeout(service.pair(), 12000, `${targetDevice.modelHint}의 NetMD 인터페이스를 여는 시간이 초과되었습니다.`);
            if (!paired)
                return { ok: false, message: `${targetDevice.modelHint}의 NetMD 인터페이스를 열지 못했습니다.` };
            const openedDevice = service.netmdInterface?.netMd;
            if (!openedDevice ||
                openedDevice.getVendor() !== targetDevice.vendorId ||
                openedDevice.getProduct() !== targetDevice.productId) {
                return { ok: false, message: '선택한 기기와 실제 열린 기기가 달라 포맷을 중단했습니다.' };
            }
            const capabilities = await withTimeout(service.getServiceCapabilities(), 12000, '기기의 Hi-MD 포맷 지원 여부를 확인하지 못했습니다.');
            if (!capabilities.includes(10)) {
                return {
                    ok: false,
                    message: `${targetDevice.modelHint}은(는) 펌웨어의 NetMD→Hi-MD 포맷 명령을 지원하지 않습니다.`,
                };
            }
            if (!capabilities.includes(2)) {
                return {
                    ok: false,
                    message: '디스크가 쓰기 금지 상태이거나 포맷 가능한 미디어가 아닙니다.',
                };
            }
            const confirmation = await electron_1.dialog.showMessageBox(window, {
                type: 'warning',
                title: 'Hi-MD로 포맷',
                message: '현재 일반 MD를 Hi-MD 형식으로 초기화하시겠습니까?',
                detail: [
                    '디스크의 모든 트랙과 제목이 영구적으로 삭제됩니다.',
                    '',
                    `대상 기기: ${targetDevice.modelHint} (${targetDevice.vendorIdHex}:${targetDevice.productIdHex})`,
                    '포맷 뒤 기기는 Hi-MD USB 인터페이스로 다시 연결됩니다.',
                    '해당 Hi-MD USB ID에 WinUSB를 처음 설치하는 경우 추가 안내가 나타날 수 있습니다.',
                ].join('\n'),
                buttons: ['취소', '모든 데이터를 지우고 Hi-MD로 포맷'],
                defaultId: 0,
                cancelId: 0,
                noLink: true,
            });
            if (confirmation.response !== 1)
                return { ok: false, cancelled: true, message: '포맷을 취소했습니다.' };
            let commandError;
            try {
                await withTimeout(service.formatToHiMD(), 30000, 'Hi-MD 포맷 명령의 응답 시간이 초과되었습니다.');
                switchRequested = true;
            }
            catch (error) {
                commandError = error;
                console.log('NetMD to Hi-MD switch interrupted:', error);
            }
            const expectedHiMDProducts = new Map([
                [0x017e, [0x017f]],
                [0x0180, [0x0181]],
                [0x0182, [0x0183]],
                [0x0184, [0x0185]],
                [0x0186, [0x0187]],
                [0x0219, [0x021a]],
                [0x021b, [0x021c]],
                [0x021d, [0x022d]],
                [0x022c, [0x022d]],
                [0x0286, [0x0287]],
            ]);
            const expectedProducts = expectedHiMDProducts.get(targetDevice.productId) ?? [];
            let refreshedDevices = [];
            for (let attempt = 0; attempt < 4; attempt++) {
                await wait(800);
                refreshedDevices = (0, device_diagnostics_1.getMiniDiscDiagnostics)().devices;
                if (refreshedDevices.some(device => device.vendorId === targetDevice.vendorId &&
                    expectedProducts.includes(device.productId))) {
                    switchRequested = true;
                    break;
                }
            }
            const oldInterfaceStillPresent = refreshedDevices.some(device => device.vendorId === targetDevice.vendorId &&
                device.productId === targetDevice.productId &&
                device.busNumber === targetDevice.busNumber);
            if (!commandError || switchRequested) {
                return {
                    ok: true,
                    erased: true,
                    switchRequested: true,
                    message: 'Hi-MD 포맷 명령을 완료했습니다. Hi-MD 인터페이스가 나타나지 않으면 USB 케이블을 한 번 다시 연결해 주세요.',
                };
            }
            if (!oldInterfaceStillPresent) {
                return {
                    ok: true,
                    erased: true,
                    switchRequested: true,
                    message: '기기가 포맷 중 USB에서 다시 연결되어 마지막 응답은 끊겼습니다. USB를 다시 연결한 뒤 Hi-MD를 선택해 주세요.',
                };
            }
            return {
                ok: false,
                erased: true,
                message: `디스크 삭제 뒤 Hi-MD 전환을 확인하지 못했습니다. USB를 다시 연결해 상태를 확인해 주세요.\n${commandError instanceof Error ? commandError.message : String(commandError)}`,
            };
        }
        catch (error) {
            console.error('Hi-MD format failed:', error);
            return {
                ok: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            const netmdInterface = service.netmdInterface;
            service.netmdInterface = undefined;
            service.dropCachedContentList();
            webusb.clearPreferredDevice();
            if (!switchRequested)
                Promise.resolve(netmdInterface?.netMd.finalize()).catch(() => { });
        }
    });
    let keyData = undefined;
    try {
        keyData = new Uint8Array(fs_1.default.readFileSync(path_1.default.join(electron_1.app.getPath('userData'), 'EKBROOTS.DES')));
    }
    catch (_) {
        console.log("Can't read roots");
    }
    const nwService = new networkwm_service_1.NetworkWMService(keyData);
    if (process.platform !== 'darwin') {
        const himdDeflist = traverseObject(window, () => himdService, "_himd_");
        electron_1.ipcMain.handle('_himd__definedParameters', () => himdDeflist);
        const nwDeflist = traverseObject(window, () => nwService, "_nwjs_");
        electron_1.ipcMain.handle('_nwjs__definedParameters', () => nwDeflist);
    }
    else {
        const connection = new server_bootstrap_1.Connection();
        connection.deviceDisconnectedCallback = () => reload(window);
        const connectionMutex = new async_mutex_1.Mutex();
        const callHiMDMethod = async (methodName, allArgs) => {
            const call = connection.callMethod('himd', methodName, ...allArgs);
            if (methodName !== 'getDeviceName')
                return call;
            let timeout;
            try {
                return await Promise.race([
                    call,
                    new Promise((_, reject) => {
                        timeout = setTimeout(() => reject(new Error('Hi-MD 디스크 초기화 시간이 초과되었습니다. USB를 분리한 뒤 다시 연결해 주세요.')), 30000);
                    }),
                ]);
            }
            finally {
                if (timeout)
                    clearTimeout(timeout);
            }
        };
        connection.callbackHandler = (service, name, ...args) => window.webContents.send("_callback", (service === 'himd' ? '_himd_' : '_nwjs_') + name, ...args);
        const himdDefinedMethods = getDefinedFunctions(himdService);
        electron_1.ipcMain.handle('_himd__definedParameters', () => [...himdDefinedMethods].map(e => '_himd_' + e));
        for (let methodName of himdDefinedMethods) {
            electron_1.ipcMain.handle(`_himd_${methodName}`, async (_, ...allArgs) => {
                console.log(`Execute: ${methodName}`);
                if (methodName === 'connect') {
                    if (connection.socket) {
                        connection.disconnect();
                    }
                    try {
                        (0, server_bootstrap_1.startServer)();
                    }
                    catch (ex) {
                        return [null, ex];
                    }
                    const error = await connection.awaitConnection();
                    if (error) {
                        return [null, error];
                    }
                }
                if (!connection.socket) {
                    return [null, new Error("Server not ready!")];
                }
                const release = await connectionMutex.acquire();
                try {
                    return [await callHiMDMethod(methodName, allArgs), null];
                }
                catch (err) {
                    console.log("External HIMD Error: ");
                    console.log(err);
                    if (methodName === 'getDeviceName' && connection.socket)
                        connection.disconnect();
                    return [null, err];
                }
                finally {
                    release();
                }
            });
        }
        const nwjsDefinedMethods = getDefinedFunctions(himdService);
        electron_1.ipcMain.handle('_nwjs__definedParameters', () => [...nwjsDefinedMethods].map(e => '_nwjs_' + e));
        for (let methodName of nwjsDefinedMethods) {
            electron_1.ipcMain.handle(`_nwjs_${methodName}`, async (_, ...allArgs) => {
                console.log(`Execute: ${methodName}`);
                if (methodName === 'connect') {
                    if (connection.socket) {
                        connection.disconnect();
                    }
                    try {
                        (0, server_bootstrap_1.startServer)();
                    }
                    catch (ex) {
                        return [null, ex];
                    }
                    const error = await connection.awaitConnection();
                    if (error) {
                        return [null, error];
                    }
                }
                if (!connection.socket) {
                    return [null, new Error("Server not ready!")];
                }
                const release = await connectionMutex.acquire();
                try {
                    return [await connection.callMethod('nwjs', methodName, ...allArgs), null];
                }
                catch (err) {
                    console.log("External NWJS Error: ");
                    console.log(err);
                    return [null, err];
                }
                finally {
                    release();
                }
            });
        }
    }
    electron_1.ipcMain.handle('_unrestrictedFetch', async (_, url, parameters) => {
        return await (await (0, node_fetch_1.default)(url, parameters)).text();
    });
    electron_1.ipcMain.handle('_signHiMDDisc', () => global.signHiMDDisc());
    electron_1.ipcMain.handle('_signNWJS', () => global.signNWJS());
    electron_1.ipcMain.handle('_debug_himdPullFile', async (e, a, b) => {
        console.log(`Pulling HiMD file ${a} to local ${b}`);
        const handle = await himdService.fsDriver.fatfs.open(a, false);
        if (!handle) {
            console.log("No file!");
        }
        fs_1.default.writeFileSync(b, await handle.readAll());
        await handle.close();
    });
    electron_1.ipcMain.handle('_debug_himdList', async (e, a) => {
        console.log(`Listing HiMD dir ${a}`);
        const list = await himdService.fsDriver.fatfs.listDir(a);
        if (!list) {
            console.log("No such dir!");
        }
        console.log(list.join(', '));
    });
    electron_1.ipcMain.handle("openFileHostDialog", async (_, filters, directory) => {
        return ewmdOpenDialog(window, filters, directory);
    });
    require("./md-squirrel-main").setupMDSquirrelIPC(window);
    setupSettings(window);
    setupEncoder();
    // On a USB disconnect event, enumerate services, check if any was connected
    const addKnownDeviceCB = webusb.addKnownDevice.bind(webusb);
    nwService.deviceConnectedCallback = addKnownDeviceCB;
    himdService.deviceConnectedCallback = addKnownDeviceCB;
    webusb.ondisconnect = event => {
        if ([service, himdService, nwService].some(e => e.isDeviceConnected(event.device))) {
            reload(window);
        }
    };
}
(0, electron_context_menu_1.default)({
    showInspectElement: false,
});
electron_1.app.whenReady().then(() => {
    electron_1.protocol.registerFileProtocol('sandbox', (rq, callback) => {
        const filePath = path_1.default.normalize(rq.url.substring('sandbox://'.length));
        if (path_1.default.isAbsolute(filePath) || filePath.includes('..')) {
            electron_1.app.quit();
        }
        const tgt = decodeURI(getOfRenderer(filePath));
        console.log(`[SANDBOX]: Requested ${tgt}`);
        callback(tgt);
    });
    createWindow();
});
//# sourceMappingURL=main.js.map
