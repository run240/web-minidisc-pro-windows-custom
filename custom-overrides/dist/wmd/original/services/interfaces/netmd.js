"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetMDUSBService = exports.NetMDService = exports.DefaultMinidiscSpec = exports.WireformatDict = exports.ExploitCapability = exports.Capability = void 0;
exports.getCodecFromIndex = getCodecFromIndex;
exports.getDefaultCodec = getDefaultCodec;
exports.getDefaultCodecName = getDefaultCodecName;
exports.convertDiscToWMD = convertDiscToWMD;
exports.convertDiscToNJS = convertDiscToNJS;
exports.convertGroupToWMD = convertGroupToWMD;
exports.convertGroupToNJS = convertGroupToNJS;
exports.convertTrackToWMD = convertTrackToWMD;
exports.convertTrackToNJS = convertTrackToNJS;
// This file has been auto-generated! DO NOT EDIT!
const netmd_js_1 = require("netmd-js");
const web_encrypt_worker_1 = require("netmd-js/dist/web-encrypt-worker");
const utils_1 = require("netmd-js/dist/utils");
const utils_2 = require("../../utils");
const async_mutex_1 = require("async-mutex");
const netmd_exploits_1 = require("netmd-exploits");
const netmd_exploits_2 = __importDefault(require("netmd-exploits"));
const netmd_tocmanip_1 = __importDefault(require("netmd-tocmanip"));
const title_romanization_1 = require("../title-romanization");
const Worker = null;
const sanitizeNetMDHalfWidthTitle = (title) => (0, utils_1.sanitizeHalfWidthTitle)((0, title_romanization_1.romanizeKoreanTitle)(title)).substring(0, 120);
const sanitizeNetMDFullWidthTitle = (title) => (0, utils_1.sanitizeFullWidthTitle)((0, title_romanization_1.romanizeKoreanTitle)(title)).substring(0, 105);
var Capability;
(function (Capability) {
    Capability[Capability["contentList"] = 0] = "contentList";
    Capability[Capability["playbackControl"] = 1] = "playbackControl";
    Capability[Capability["metadataEdit"] = 2] = "metadataEdit";
    Capability[Capability["trackUpload"] = 3] = "trackUpload";
    Capability[Capability["trackDownload"] = 4] = "trackDownload";
    Capability[Capability["discEject"] = 5] = "discEject";
    Capability[Capability["factoryMode"] = 6] = "factoryMode";
    Capability[Capability["himdTitles"] = 7] = "himdTitles";
    Capability[Capability["fullWidthSupport"] = 8] = "fullWidthSupport";
    Capability[Capability["nativeMonoUpload"] = 9] = "nativeMonoUpload";
    Capability[Capability["himdFormat"] = 10] = "himdFormat";
})(Capability || (exports.Capability = Capability = {}));
var ExploitCapability;
(function (ExploitCapability) {
    ExploitCapability[ExploitCapability["runTetris"] = 0] = "runTetris";
    ExploitCapability[ExploitCapability["flushUTOC"] = 1] = "flushUTOC";
    ExploitCapability[ExploitCapability["downloadAtrac"] = 2] = "downloadAtrac";
    ExploitCapability[ExploitCapability["readFirmware"] = 3] = "readFirmware";
    ExploitCapability[ExploitCapability["spUploadSpeedup"] = 4] = "spUploadSpeedup";
    ExploitCapability[ExploitCapability["uploadAtrac1"] = 5] = "uploadAtrac1";
    ExploitCapability[ExploitCapability["himdFullMode"] = 6] = "himdFullMode";
    ExploitCapability[ExploitCapability["readRam"] = 7] = "readRam";
    ExploitCapability[ExploitCapability["uploadMonoSP"] = 8] = "uploadMonoSP";
    ExploitCapability[ExploitCapability["disableDiscSwapDetection"] = 9] = "disableDiscSwapDetection";
    ExploitCapability[ExploitCapability["enterServiceMode"] = 10] = "enterServiceMode";
})(ExploitCapability || (exports.ExploitCapability = ExploitCapability = {}));
function getCodecFromIndex(spec, index) {
    return {
        codec: spec.availableFormats[index[0]].codec,
        bitrate: spec.availableFormats[index[0]].availableBitrates[index[1]],
    };
}
function getDefaultCodec(spec) {
    return getCodecFromIndex(spec, spec.defaultFormat);
}
function getDefaultCodecName(spec) {
    var _a;
    return (_a = spec.availableFormats[spec.defaultFormat[0]].userFriendlyName) !== null && _a !== void 0 ? _a : spec.availableFormats[spec.defaultFormat[0]].codec;
}
exports.WireformatDict = {
    SP: netmd_js_1.Wireformat.pcm,
    LP2: netmd_js_1.Wireformat.lp2,
    LP105: netmd_js_1.Wireformat.l105kbps,
    LP4: netmd_js_1.Wireformat.lp4,
};
class DefaultMinidiscSpec {
    constructor() {
        this.availableFormats = [{ codec: 'SPS', defaultBitrate: 292, userFriendlyName: 'SP', availableBitrates: [292] }, { codec: 'SPM', defaultBitrate: 146, userFriendlyName: 'MONO', availableBitrates: [146], displayBadgeFriendlyName: 'SP' }, { codec: 'AT3', defaultBitrate: 132, userFriendlyName: 'LP2', availableBitrates: [132] }, { codec: 'AT3', defaultBitrate: 66, userFriendlyName: 'LP4', availableBitrates: [66] }];
        this.defaultFormat = [0, 0];
        this.specName = 'MD';
        this.measurementUnits = 'frames';
    }
    sanitizeHalfWidthTitle(title) {
        return sanitizeNetMDHalfWidthTitle(title);
    }
    sanitizeFullWidthTitle(title) {
        return sanitizeNetMDFullWidthTitle(title);
    }
    getRemainingCharactersForTitles(disc) {
        return (0, netmd_js_1.getRemainingCharactersForTitles)(convertDiscToNJS(disc));
    }
    getCharactersForTitle(track) {
        const { halfWidth, fullWidth } = (0, netmd_js_1.getCellsForTitle)(convertTrackToNJS(track));
        return {
            halfWidth: halfWidth * 7,
            fullWidth: fullWidth * 7,
        };
    }
    translateDefaultMeasuringModeTo(mode, defaultMeasuringModeDuration) {
        return Math.floor(292 / mode.bitrate) * defaultMeasuringModeDuration;
    }
    translateToDefaultMeasuringModeFrom(mode, durationInMode) {
        return durationInMode / Math.floor(292 / mode.bitrate);
    }
}
exports.DefaultMinidiscSpec = DefaultMinidiscSpec;
class NetMDService {
    constructor() {
        this.mutex = new async_mutex_1.Mutex();
    }
    async factory() {
        return null;
    }
    async flush() { }
    async formatToHiMD() { }
    // Required in HiMD api:
    async fetchPartOfTrack(index, startSeconds, lengthSeconds) { return null; }
}
exports.NetMDService = NetMDService;
// Compatibility methods. Do NOT use these unless absolutely necessary!!
function convertDiscToWMD(source) {
    return Object.assign(Object.assign({}, source), { left: Math.ceil(source.left / 512), total: Math.ceil(source.total / 512), groups: source.groups.map(convertGroupToWMD) });
}
function convertDiscToNJS(source) {
    return Object.assign(Object.assign({}, source), { left: source.left * 512, total: source.total * 512, groups: source.groups.map(convertGroupToNJS) });
}
function convertGroupToWMD(source) {
    return Object.assign(Object.assign({}, source), { tracks: source.tracks.map(convertTrackToWMD) });
}
function convertGroupToNJS(source) {
    return Object.assign(Object.assign({}, source), { tracks: source.tracks.map(convertTrackToNJS) });
}
function convertTrackToWMD(source) {
    return Object.assign(Object.assign({}, source), { duration: Math.ceil(source.duration / 512), encoding: {
            [netmd_js_1.Encoding.sp]: source.channel === 1 ? { codec: 'SPM', bitrate: 146 } : { codec: 'SPS', bitrate: 292 },
            [netmd_js_1.Encoding.lp2]: { codec: 'AT3', bitrate: 132 },
            [netmd_js_1.Encoding.lp4]: { codec: 'AT3', bitrate: 66 },
        }[source.encoding] });
}
function convertTrackToNJS(source) {
    return Object.assign(Object.assign({}, source), { duration: source.duration * 512, encoding: source.encoding.codec.startsWith('SP') ? netmd_js_1.Encoding.sp : source.encoding.bitrate === 132 ? netmd_js_1.Encoding.lp2 : netmd_js_1.Encoding.lp4 });
}
class NetMDUSBService extends NetMDService {
    constructor({ debug = false }) {
        super();
        if (debug) {
            // Logging a few methods that have been causing issues with some units
            const _fn = (...args) => {
                if (args && args[0] && args[0].method) {
                    console.log(...args);
                }
            };
            this.logger = {
                debug: _fn,
                info: _fn,
                warn: _fn,
                error: _fn,
                child: () => this.logger,
            };
        }
        Object.defineProperty(window, 'exposeAPIToConsole', {
            writable: true,
            configurable: true,
            value: () => {
                console.log('%cThe following features have been exposed:', 'font-size: 20px; color: cyan;');
                console.log('%c- formatQuery() - a function which formats given hex data with parameters', 'font-size: 15px; color: cyan;');
                console.log('%c- scanQuery() - a function which parses data with the help of a given hex format with parameters', 'font-size: 15px; color: cyan;');
                console.log('%c- patch() - a function which patches the device', 'font-size: 15px; color: cyan;');
                console.log('%c- readPatch() - a function which reads a patch from the device', 'font-size: 15px; color: cyan;');
                console.log('%c- unpatch() - a function which removes a patch', 'font-size: 15px; color: cyan;');
                console.log("%c- interface - an instance of netmd-js's NetMDInterface", 'font-size: 15px; color: cyan;');
                Object.defineProperty(window, 'formatQuery', { value: netmd_js_1.formatQuery, configurable: true });
                Object.defineProperty(window, 'scanQuery', { value: netmd_js_1.scanQuery, configurable: true });
                Object.defineProperty(window, 'readPatch', { value: netmd_js_1.readPatch, configurable: true });
                Object.defineProperty(window, 'patch', { value: netmd_js_1.patch, configurable: true });
                Object.defineProperty(window, 'unpatch', { value: netmd_js_1.unpatch, configurable: true });
                Object.defineProperty(window, 'interface', { value: this.netmdInterface, configurable: true });
            },
        });
        console.log('%cIf you would like to experiment with NetMD features in the console, please run exposeAPIToConsole()', 'font-size: 25px; color: cyan;');
    }
    async getServiceCapabilities() {
        var _a, _b, _c, _d, _e, _f, _g;
        const basic = [Capability.contentList, Capability.playbackControl, Capability.fullWidthSupport];
        if (((_a = this.netmdInterface) === null || _a === void 0 ? void 0 : _a.netMd.getVendor()) === 0x54c && this.netmdInterface.netMd.getProduct() === 0x0286) {
            // MZ-RH1
            basic.push(Capability.trackDownload);
        }
        if (((_b = this.netmdInterface) === null || _b === void 0 ? void 0 : _b.netMd.getVendor()) === 0x54c && await ((_c = this.netmdInterface) === null || _c === void 0 ? void 0 : _c.canEjectDisc())) {
            basic.push(Capability.discEject);
        }
        // TODO: Add a flag for this instead of relying just on the name.
        const deviceName = (_d = this.netmdInterface) === null || _d === void 0 ? void 0 : _d.netMd.getDeviceName();
        if (((deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes('Sony')) &&
            ((deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes('MZ-N')) || (deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes('MZ-S1')) || deviceName.includes('MZ-RH') || deviceName.includes('MZ-DH10P') || (deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes('DS-HMD1')))) ||
            ((deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes('Aiwa')) && (deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes('AM-NX'))) ||
            (deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes('PCGA-MDN1'))) {
            // Only Sony (and Aiwa since it's the same thing) portables have the factory mode.
            basic.push(Capability.factoryMode);
        }
        if ((deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes("MZ-RH")) || (deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes("MZ-NH")) || (deviceName === null || deviceName === void 0 ? void 0 : deviceName.includes("CMT-AH10"))) {
            // Is HiMD -> Can be formatted to HiMD
            basic.push(Capability.himdFormat);
        }
        const deviceFlags = (_e = this.netmdInterface) === null || _e === void 0 ? void 0 : _e.netMd.getDeviceFlags();
        if (deviceFlags) {
            if (deviceFlags.nativeMonoUpload) {
                basic.push(Capability.nativeMonoUpload);
            }
        }
        try {
            const flags = (_g = (await ((_f = this.netmdInterface) === null || _f === void 0 ? void 0 : _f.getDiscFlags()))) !== null && _g !== void 0 ? _g : 0;
            if ((flags & netmd_js_1.DiscFlag.writeProtected) === 0) {
                return [...basic, Capability.trackUpload, Capability.metadataEdit];
            }
        }
        catch (err) { }
        return basic;
    }
    async listContentUsingCache() {
        if (!this.cachedContentList) {
            console.log("There's no cached version of the TOC, caching");
            this.cachedContentList = convertDiscToWMD(await (0, netmd_js_1.listContent)(this.netmdInterface));
        }
        else {
            console.log("There's a cached TOC available.");
        }
        return JSON.parse(JSON.stringify(this.cachedContentList));
    }
    dropCachedContentList() {
        console.log('Cached TOC Dropped');
        this.cachedContentList = undefined;
    }
    async pair() {
        this.dropCachedContentList();
        const iface = await (0, netmd_js_1.openNewDevice)(navigator.usb, this.logger);
        if (iface === null) {
            return false;
        }
        this.netmdInterface = iface;
        return true;
    }
    async connect() {
        this.dropCachedContentList();
        const iface = await (0, netmd_js_1.openPairedDevice)(navigator.usb, this.logger);
        if (iface === null) {
            return false;
        }
        this.netmdInterface = iface;
        return true;
    }
    async listContent(dropCache = false) {
        if (dropCache)
            this.dropCachedContentList();
        return await this.listContentUsingCache();
    }
    async getDeviceStatus() {
        return await (0, netmd_js_1.getDeviceStatus)(this.netmdInterface);
    }
    async getDeviceName() {
        return this.netmdInterface.netMd.getDeviceName();
    }
    async finalize() {
        const netmdInterface = this.netmdInterface;
        this.netmdInterface = undefined;
        this.dropCachedContentList();
        if (netmdInterface)
            await netmdInterface.netMd.finalize();
    }
    async finalizeForDisconnect() {
        const netmdInterface = this.netmdInterface;
        this.netmdInterface = undefined;
        this.dropCachedContentList();
        if (!netmdInterface)
            return;
        const deviceName = netmdInterface.netMd.getDeviceName() ?? '';
        const isPortableNetMD = /\b(?:MZ-|AM-NX|IM-|SJ-MR)/i.test(deviceName);
        if (isPortableNetMD) {
            const ejectRequest = Promise.resolve(netmdInterface.ejectDisc()).then(() => true, () => false);
            await Promise.race([
                ejectRequest,
                (0, utils_1.sleep)(6000).then(() => false),
            ]);
            await (0, utils_1.sleep)(1500);
        }
        await netmdInterface.netMd.finalize();
    }
    async rewriteGroups(groups) {
        const disc = await this.listContentUsingCache();
        disc.groups = groups;
        this.cachedContentList = disc;
        await (0, netmd_js_1.rewriteDiscGroups)(this.netmdInterface, convertDiscToNJS(disc));
    }
    async renameTrack(index, title, fullWidthTitle) {
        title = sanitizeNetMDHalfWidthTitle(title);
        const sanitizedFullWidthTitle = fullWidthTitle === undefined ? undefined : sanitizeNetMDFullWidthTitle(fullWidthTitle);
        await this.netmdInterface.setTrackTitle(index, title);
        if (sanitizedFullWidthTitle !== undefined) {
            await this.netmdInterface.setTrackTitle(index, sanitizedFullWidthTitle, true);
        }
        const disc = await this.listContentUsingCache();
        for (const group of disc.groups) {
            for (const track of group.tracks) {
                if (track.index === index) {
                    track.title = title;
                    if (sanitizedFullWidthTitle !== undefined) {
                        track.fullWidthTitle = sanitizedFullWidthTitle;
                    }
                }
            }
        }
        this.cachedContentList = disc;
    }
    async renameGroup(groupIndex, newName, newFullWidthName) {
        newName = sanitizeNetMDHalfWidthTitle(newName);
        if (newFullWidthName !== undefined) {
            newFullWidthName = sanitizeNetMDFullWidthTitle(newFullWidthName);
        }
        const disc = await this.listContentUsingCache();
        const thisGroup = disc.groups.find(g => g.index === groupIndex);
        if (!thisGroup) {
            return;
        }
        thisGroup.title = newName;
        if (newFullWidthName !== undefined) {
            thisGroup.fullWidthTitle = newFullWidthName;
        }
        this.cachedContentList = disc;
        await (0, netmd_js_1.rewriteDiscGroups)(this.netmdInterface, convertDiscToNJS(disc));
    }
    async addGroup(groupBegin, groupLength, title, fullWidthTitle = '') {
        title = sanitizeNetMDHalfWidthTitle(title);
        fullWidthTitle = sanitizeNetMDFullWidthTitle(fullWidthTitle);
        const disc = await this.listContentUsingCache();
        const ungrouped = disc.groups.find(n => n.title === null);
        if (!ungrouped) {
            return; // You can only group tracks that aren't already in a different group, if there's no such tracks, there's no point to continue
        }
        const ungroupedLengthBeforeGroup = ungrouped.tracks.length;
        const thisGroupTracks = ungrouped.tracks.filter(n => n.index >= groupBegin && n.index < groupBegin + groupLength);
        ungrouped.tracks = ungrouped.tracks.filter(n => !thisGroupTracks.includes(n));
        if (ungroupedLengthBeforeGroup - ungrouped.tracks.length !== groupLength) {
            throw new Error('A track cannot be in 2 groups!');
        }
        if (!(0, utils_2.isSequential)(thisGroupTracks.map(n => n.index))) {
            throw new Error('Invalid sequence of tracks!');
        }
        disc.groups.push({
            title,
            fullWidthTitle,
            index: disc.groups.length,
            tracks: thisGroupTracks,
        });
        disc.groups = disc.groups.filter(g => g.tracks.length !== 0).sort((a, b) => a.tracks[0].index - b.tracks[0].index);
        this.cachedContentList = disc;
        await (0, netmd_js_1.rewriteDiscGroups)(this.netmdInterface, convertDiscToNJS(disc));
    }
    async deleteGroup(index) {
        const disc = await this.listContentUsingCache();
        let ungroupedGroup = disc.groups.find(g => g.title === null);
        if (!ungroupedGroup) {
            ungroupedGroup = {
                index: -1,
                title: null,
                fullWidthTitle: null,
                tracks: [],
            };
            disc.groups.unshift(ungroupedGroup);
        }
        const groupIndex = disc.groups.findIndex(g => g.index === index);
        if (groupIndex >= 0) {
            const deleted = disc.groups.splice(groupIndex, 1)[0];
            ungroupedGroup.tracks = ungroupedGroup.tracks.concat(deleted.tracks);
            ungroupedGroup.tracks.sort((a, b) => a.index - b.index);
        }
        this.cachedContentList = disc;
        await (0, netmd_js_1.rewriteDiscGroups)(this.netmdInterface, convertDiscToNJS(disc));
    }
    async renameDisc(newName, newFullWidthName) {
        newName = sanitizeNetMDHalfWidthTitle(newName);
        if (newFullWidthName !== undefined) {
            newFullWidthName = sanitizeNetMDFullWidthTitle(newFullWidthName);
        }
        await (0, netmd_js_1.renameDisc)(this.netmdInterface, newName, newFullWidthName);
        const disc = await this.listContentUsingCache();
        disc.title = newName;
        if (newFullWidthName !== undefined) {
            disc.fullWidthTitle = newFullWidthName;
        }
        this.cachedContentList = disc;
    }
    async deleteTracks(indexes) {
        var _a, _b;
        try {
            // await this.netmdInterface!.stop();
        }
        catch (ex) { }
        indexes = indexes.sort((a, b) => a - b);
        indexes.reverse();
        let content = await this.listContentUsingCache();
        for (const index of indexes) {
            // Attempt to get panasonics working correctly (MyNameIsX)
            await ((_a = this.netmdInterface) === null || _a === void 0 ? void 0 : _a.getTrackTitle(index, false));
            await ((_b = this.netmdInterface) === null || _b === void 0 ? void 0 : _b.getTrackCount());
            content = (0, utils_2.recomputeGroupsAfterTrackMove)(content, index, -1);
            await this.netmdInterface.eraseTrack(index);
            await (0, utils_2.sleep)(100);
        }
        await (0, netmd_js_1.rewriteDiscGroups)(this.netmdInterface, convertDiscToNJS(content));
        this.dropCachedContentList();
    }
    async wipeDisc() {
        try {
            await this.netmdInterface.stop();
        }
        catch (ex) { /* empty */ }
        await this.netmdInterface.eraseDisc();
        this.dropCachedContentList();
    }
    async formatToHiMD() {
        await (0, netmd_js_1.formatToHiMD)(this.netmdInterface);
        this.dropCachedContentList();
    }
    async ejectDisc() {
        await this.netmdInterface.ejectDisc();
        this.dropCachedContentList();
    }
    async wipeDiscTitleInfo() {
        await this.netmdInterface.setDiscTitle('');
        await this.netmdInterface.setDiscTitle('', true);
        this.dropCachedContentList();
    }
    async applyEditBatch(batch) {
        const before = await this.listContentUsingCache();
        const discTitleRequest = batch === null || batch === void 0 ? void 0 : batch.discTitle;
        const expectedDiscTitle = discTitleRequest
            ? sanitizeNetMDHalfWidthTitle(discTitleRequest.title)
            : before.title;
        const expectedFullWidthDiscTitle = discTitleRequest
            ? sanitizeNetMDFullWidthTitle(discTitleRequest.fullWidthTitle)
            : before.fullWidthTitle;
        const discTitleChanged = expectedDiscTitle !== before.title ||
            expectedFullWidthDiscTitle !== before.fullWidthTitle;
        const trackCount = before.groups.reduce((count, group) => count + group.tracks.length, 0);
        const order = Array.isArray(batch === null || batch === void 0 ? void 0 : batch.order) ? batch.order.map(Number) : [];
        if (order.length !== trackCount ||
            new Set(order).size !== trackCount ||
            order.some(index => !Number.isInteger(index) || index < 0 || index >= trackCount)) {
            throw new Error('NetMD 편집 목록의 트랙 순서가 올바르지 않습니다.');
        }
        const currentOrder = Array.from({ length: trackCount }, (_, index) => index);
        const orderChanged = order.some((index, position) => index !== position);
        const groupShape = groups => JSON.stringify((groups !== null && groups !== void 0 ? groups : []).map(group => ({
            title: group.title,
            fullWidthTitle: group.fullWidthTitle,
            tracks: (group.tracks !== null && group.tracks !== void 0 ? group.tracks : []).map(track => track.index),
        })));
        const groupsChanged = Array.isArray(batch === null || batch === void 0 ? void 0 : batch.groups) &&
            groupShape(batch.groups) !== groupShape(before.groups);
        const originalTracks = before.groups
            .flatMap(group => group.tracks)
            .sort((a, b) => a.index - b.index);
        const editedTracks = originalTracks.map(track => ({ ...track }));
        const metadata = Array.isArray(batch === null || batch === void 0 ? void 0 : batch.metadata) ? batch.metadata : [];
        for (const edit of metadata) {
            const originalIndex = Number(edit.originalIndex);
            if (!Number.isInteger(originalIndex) || originalIndex < 0 || originalIndex >= trackCount) {
                throw new Error('NetMD 제목 편집 대상이 올바르지 않습니다.');
            }
            editedTracks[originalIndex].title = sanitizeNetMDHalfWidthTitle(edit.title);
            editedTracks[originalIndex].fullWidthTitle = sanitizeNetMDFullWidthTitle(edit.fullWidthTitle);
        }
        const trackSignature = track => JSON.stringify([
            track.title ?? '',
            track.fullWidthTitle ?? '',
            track.duration,
            track.encoding,
        ]);
        const expectedSignatures = order.map(originalIndex => trackSignature(editedTracks[originalIndex]));
        let writeStarted = false;
        try {
            if (discTitleChanged) {
                await this.netmdInterface.setDiscTitle(expectedDiscTitle);
                await this.netmdInterface.setDiscTitle(expectedFullWidthDiscTitle, true);
                writeStarted = true;
            }
            for (const edit of metadata) {
                const originalIndex = Number(edit.originalIndex);
                const title = sanitizeNetMDHalfWidthTitle(edit.title);
                const fullWidthTitle = sanitizeNetMDFullWidthTitle(edit.fullWidthTitle);
                await this.netmdInterface.setTrackTitle(originalIndex, title);
                await this.netmdInterface.setTrackTitle(originalIndex, fullWidthTitle, true);
                await (0, utils_2.sleep)(100);
                writeStarted = true;
            }
            if (!orderChanged && !groupsChanged) {
                const result = JSON.parse(JSON.stringify(before));
                result.title = expectedDiscTitle;
                result.fullWidthTitle = expectedFullWidthDiscTitle;
                const resultTracks = result.groups.flatMap(group => group.tracks);
                for (const edit of metadata) {
                    const track = resultTracks.find(candidate => candidate.index === Number(edit.originalIndex));
                    if (!track)
                        continue;
                    track.title = sanitizeNetMDHalfWidthTitle(edit.title);
                    track.fullWidthTitle = sanitizeNetMDFullWidthTitle(edit.fullWidthTitle);
                }
                this.cachedContentList = result;
                return JSON.parse(JSON.stringify(result));
            }
            for (let destination = 0; destination < order.length; destination++) {
                const source = currentOrder.indexOf(order[destination]);
                if (source === destination) {
                    continue;
                }
                await this.netmdInterface.moveTrack(source, destination);
                await (0, utils_2.sleep)(100);
                const [moved] = currentOrder.splice(source, 1);
                currentOrder.splice(destination, 0, moved);
                writeStarted = true;
            }
            this.dropCachedContentList();
            if (Array.isArray(batch === null || batch === void 0 ? void 0 : batch.groups)) {
                const refreshed = await this.listContentUsingCache();
                refreshed.groups = batch.groups.map(group => ({
                    ...group,
                    title: group.title === null ? null : sanitizeNetMDHalfWidthTitle(group.title),
                    fullWidthTitle: group.fullWidthTitle === null
                        ? null
                        : sanitizeNetMDFullWidthTitle(group.fullWidthTitle),
                }));
                this.cachedContentList = refreshed;
                await (0, netmd_js_1.rewriteDiscGroups)(this.netmdInterface, convertDiscToNJS(refreshed));
                writeStarted = true;
            }
            this.dropCachedContentList();
            const result = await this.listContentUsingCache();
            const resultCount = result.groups.reduce((count, group) => count + group.tracks.length, 0);
            if (resultCount !== trackCount) {
                throw new Error(`적용 후 트랙 수가 ${trackCount}개에서 ${resultCount}개로 달라졌습니다.`);
            }
            if (result.title !== expectedDiscTitle || result.fullWidthTitle !== expectedFullWidthDiscTitle) {
                throw new Error('적용 후 NetMD 디스크 이름이 요청한 결과와 다릅니다.');
            }
            const actualSignatures = result.groups
                .flatMap(group => group.tracks)
                .sort((a, b) => a.index - b.index)
                .map(trackSignature);
            if (actualSignatures.some((signature, index) => signature !== expectedSignatures[index])) {
                throw new Error('적용 후 트랙 순서 검증 결과가 요청한 순서와 다릅니다.');
            }
            return result;
        }
        catch (error) {
            this.dropCachedContentList();
            throw new Error(`${writeStarted ? 'NetMD 편집 적용 중 오류가 발생했습니다. 디스크를 다시 검색해 실제 제목과 순서를 확인해 주세요.\n' : ''}${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async moveTrack(src, dst, updateGroups) {
        await this.netmdInterface.moveTrack(src, dst);
        const content = await this.listContentUsingCache();
        if (updateGroups === undefined || updateGroups) {
            await (0, netmd_js_1.rewriteDiscGroups)(this.netmdInterface, convertDiscToNJS((0, utils_2.recomputeGroupsAfterTrackMove)(content, src, dst)));
        }
        for (const group of content.groups) {
            for (const track of group.tracks) {
                if (track.index === dst) {
                    track.index = src;
                }
                else if (track.index === src) {
                    track.index = dst;
                }
            }
            group.tracks.sort((a, b) => a.index - b.index);
        }
        this.cachedContentList = content;
    }
    async prepareUpload() {
        await (0, netmd_js_1.prepareDownload)(this.netmdInterface);
        this.currentSession = new netmd_js_1.MDSession(this.netmdInterface);
        await this.currentSession.init();
    }
    async finalizeUpload() {
        try {
            await this.currentSession?.close();
        }
        finally {
            try {
                await this.netmdInterface?.release();
            }
            finally {
                this.currentSession = undefined;
                this.dropCachedContentList();
            }
        }
    }
    getWorkerForUpload() {
        return [new Worker(), web_encrypt_worker_1.makeGetAsyncPacketIteratorOnWorkerThread];
    }
    async upload(title, fullWidthTitle, data, _format, progressCallback) {
        // This is NetMD - only 4 options supported.
        let format;
        if (_format.codec === 'AT3') {
            format = _format.bitrate === 66 ? 'LP4' : 'LP2';
        }
        else if (_format.codec == 'SPS' || _format.codec === 'SPM') {
            format = "SP";
        }
        else
            throw new Error('Invalid format for NetMD upload');
        if (this.currentSession === undefined) {
            throw new Error('Cannot upload without initializing a session first');
        }
        const total = data.byteLength;
        let written = 0;
        let encrypted = 0;
        function updateProgress() {
            progressCallback({ written, encrypted, total });
        }
        const [w, creator] = this.getWorkerForUpload();
        try {
            const webWorkerAsyncPacketIterator = creator(w, ({ encryptedBytes }) => {
                encrypted = encryptedBytes;
                updateProgress();
            });
            const halfWidthTitle = sanitizeNetMDHalfWidthTitle(title);
            fullWidthTitle = sanitizeNetMDFullWidthTitle(fullWidthTitle);
            const mdTrack = new netmd_js_1.MDTrack(halfWidthTitle, exports.WireformatDict[format], data, 0x400, fullWidthTitle, webWorkerAsyncPacketIterator);
            await this.currentSession.downloadTrack(mdTrack, ({ writtenBytes }) => {
                written = writtenBytes;
                updateProgress();
            }, _format.codec === 'SPM' ? netmd_js_1.DiscFormat.spMono : undefined);
            this.dropCachedContentList();
        }
        finally {
            await Promise.resolve(w.terminate()).catch(() => { });
        }
    }
    async download(index, progressCallback) {
        const [format, data] = await (0, netmd_js_1.upload)(this.netmdInterface, index, ({ readBytes, totalBytes }) => {
            progressCallback({ read: readBytes, total: totalBytes });
        });
        const extension = format === netmd_js_1.DiscFormat.spMono || format === netmd_js_1.DiscFormat.spStereo ? 'aea' : 'wav';
        return { extension, data };
    }
    async play() {
        await this.netmdInterface.play();
    }
    async pause() {
        await this.netmdInterface.pause();
    }
    async stop() {
        await this.netmdInterface.stop();
    }
    async next() {
        await this.netmdInterface.nextTrack();
    }
    async prev() {
        await this.netmdInterface.previousTrack();
    }
    async gotoTrack(index) {
        await this.netmdInterface.gotoTrack(index);
    }
    async gotoTime(index, h, m, s, f) {
        await this.netmdInterface.gotoTime(index, h, m, s, f);
    }
    async getPosition() {
        return await this.netmdInterface.getPosition();
    }
    async factory() {
        netmd_exploits_1.Assembler.setWASMUrl((0, utils_2.getPublicPathFor)('assembler.wasm'));
        try {
            await this.netmdInterface.stop();
        }
        catch (_) {
            /* Ignore */
        }
        const factoryInstance = await this.netmdInterface.factory();
        const esm = await netmd_exploits_1.ExploitStateManager.create(this.netmdInterface, factoryInstance, netmd_exploits_1.ConsoleLogger);
        return new NetMDFactoryUSBService(factoryInstance, this, this.mutex, esm);
    }
    isDeviceConnected(device) {
        var _a, _b;
        return (_b = (_a = this.netmdInterface) === null || _a === void 0 ? void 0 : _a.netMd.isDeviceConnected(device)) !== null && _b !== void 0 ? _b : false;
    }
}
exports.NetMDUSBService = NetMDUSBService;
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "getServiceCapabilities", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "listContent", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "getDeviceStatus", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "getDeviceName", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "finalize", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "finalizeForDisconnect", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "rewriteGroups", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "renameTrack", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "renameGroup", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "addGroup", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "deleteGroup", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "renameDisc", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "deleteTracks", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "wipeDisc", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "formatToHiMD", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "ejectDisc", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "wipeDiscTitleInfo", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "moveTrack", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "prepareUpload", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "finalizeUpload", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "upload", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "download", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "play", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "pause", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "stop", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "next", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "prev", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "gotoTrack", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "gotoTime", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "getPosition", null);
__decorate([
    utils_2.asyncMutex
], NetMDUSBService.prototype, "factory", null);
class NetMDFactoryUSBService {
    constructor(factoryInterface, parent, mutex, exploitStateManager) {
        this.factoryInterface = factoryInterface;
        this.parent = parent;
        this.mutex = mutex;
        this.exploitStateManager = exploitStateManager;
        this.fasterTransferEnabled = false;
    }
    async getExploitCapabilities() {
        const capabilities = [];
        const bind = (a, b) => (0, netmd_exploits_1.isCompatible)(a, this.exploitStateManager.device) && capabilities.push(b);
        bind(netmd_exploits_1.FirmwareDumper, ExploitCapability.readFirmware);
        bind(netmd_exploits_1.AtracRecovery, ExploitCapability.downloadAtrac);
        bind(netmd_exploits_1.Tetris, ExploitCapability.runTetris);
        bind(netmd_exploits_1.ForceTOCEdit, ExploitCapability.flushUTOC);
        bind(netmd_exploits_1.PCMFasterUpload, ExploitCapability.spUploadSpeedup);
        bind(netmd_exploits_1.SPUpload, ExploitCapability.uploadAtrac1);
        bind(netmd_exploits_1.HiMDUSBClassOverride, ExploitCapability.himdFullMode);
        bind(netmd_exploits_1.MonoSPUpload, ExploitCapability.uploadMonoSP);
        bind(netmd_exploits_1.DisableDiscDetection, ExploitCapability.disableDiscSwapDetection);
        bind(netmd_exploits_1.EnterServiceMode, ExploitCapability.enterServiceMode);
        if (!this.exploitStateManager.device.isHimd) {
            // Non-HiMD devices can read the RAM using normal commands
            capabilities.push(ExploitCapability.readRam);
        }
        if (window.interface) {
            Object.defineProperty(window, 'exploitStateManager', { value: this.exploitStateManager, configurable: true });
            Object.defineProperty(window, 'exploits', { value: netmd_exploits_2.default, configurable: true });
            Object.defineProperty(window, 'tocmanip', { value: netmd_tocmanip_1.default, configurable: true });
            Object.defineProperty(window, 'getToC', { value: async () => {
                    let sector0 = await this.readUTOCSector(0);
                    let sector1 = await this.readUTOCSector(1);
                    let sector2 = await this.readUTOCSector(2);
                    return netmd_tocmanip_1.default.parseTOC(sector0, sector1, sector2);
                }, configurable: true });
        }
        return capabilities;
    }
    async readUTOCSector(index) {
        return await (0, netmd_js_1.readUTOCSector)(this.factoryInterface, index);
    }
    async writeUTOCSector(index, data) {
        await (0, netmd_js_1.writeUTOCSector)(this.factoryInterface, index, data);
    }
    async flushUTOCCacheToDisc() {
        await (await this.exploitStateManager.require(netmd_exploits_1.ForceTOCEdit)).forceTOCEdit();
    }
    async runTetris() {
        await (await this.exploitStateManager.require(netmd_exploits_1.Tetris)).playTetris();
    }
    async getDeviceFirmware() {
        return (0, netmd_js_1.getDescriptiveDeviceCode)(this.factoryInterface);
    }
    async readRAM(callback) {
        const firmwareVersion = await (0, netmd_js_1.getDescriptiveDeviceCode)(this.factoryInterface);
        const ramSize = firmwareVersion.startsWith('R') ? 0x4800 : 0x9000;
        const readSlices = [];
        for (let i = 0; i < ramSize; i += 0x10) {
            readSlices.push(await (0, netmd_js_1.cleanRead)(this.factoryInterface, i + 0x02000000, 0x10, netmd_js_1.MemoryType.MAPPED));
            if (callback !== undefined)
                callback({ readBytes: i, totalBytes: ramSize });
        }
        return (0, utils_1.concatUint8Arrays)(...readSlices);
    }
    async readFirmware(callback) {
        const firmwareRipper = await this.exploitStateManager.require(netmd_exploits_1.FirmwareDumper);
        return await firmwareRipper.readFirmware(callback);
    }
    async prepareDownload(useSlowerExploit) {
        if (useSlowerExploit && !(0, netmd_exploits_1.isCompatible)(netmd_exploits_1.CachedSectorControlDownload, this.exploitStateManager.device)) {
            alert('Slower exploit is not compatible with this device. Falling back to default');
            useSlowerExploit = false;
        }
        const exploitConstructor = useSlowerExploit
            ? netmd_exploits_1.CachedSectorControlDownload
            : (0, netmd_exploits_1.getBestSuited)(netmd_exploits_1.AtracRecovery, this.exploitStateManager.device);
        this.atracDownloader = await this.exploitStateManager.require(exploitConstructor);
    }
    async finalizeDownload() {
        if (this.atracDownloader)
            await this.exploitStateManager.unload(this.atracDownloader);
    }
    async exploitDownloadTrack(track, nerawDownload, callback, config) {
        if (nerawDownload) {
            return {
                data: await this.atracDownloader.downloadTrackWithMarkers(track, callback, Object.assign(Object.assign({}, config), { includeMetadataSection: true, removeLPBytes: 'never' })),
                extension: 'neraw',
            };
        }
        else {
            return this.atracDownloader.downloadTrack(track, callback, config);
        }
    }
    async setSPSpeedupActive(newState) {
        if (this.fasterTransferEnabled === newState)
            return;
        this.fasterTransferEnabled = newState;
        if (newState) {
            await this.exploitStateManager.require(netmd_exploits_1.PCMFasterUpload);
        }
        else {
            await this.exploitStateManager.unload(netmd_exploits_1.PCMFasterUpload);
        }
    }
    async uploadSP(title, fullWidthTitle, mono, data, progressCallback) {
        // The patch memory is too small to accomodate for both ATRAC1Upload and PCMFasterUpload.
        if (this.fasterTransferEnabled) {
            await this.exploitStateManager.unload(netmd_exploits_1.PCMFasterUpload);
        }
        if (this.parent.currentSession === undefined) {
            throw new Error('Cannot upload without initializing a session first');
        }
        let total = data.byteLength;
        let written = 0;
        let encrypted = 0;
        function updateProgress() {
            progressCallback({ written, encrypted, total });
        }
        const [w, creator] = this.parent.getWorkerForUpload();
        let index = -1;
        try {
            const webWorkerAsyncPacketIterator = creator(w, ({ encryptedBytes }) => {
                encrypted = encryptedBytes;
                updateProgress();
            });
            const halfWidthTitle = sanitizeNetMDHalfWidthTitle(title);
            fullWidthTitle = sanitizeNetMDFullWidthTitle(fullWidthTitle);
            let mdTrack = new netmd_js_1.MDTrack(halfWidthTitle, netmd_js_1.Wireformat.l105kbps, data, 0x400, fullWidthTitle, webWorkerAsyncPacketIterator);
            await this.exploitStateManager.envelop(netmd_exploits_1.SPUpload, mono ? 1 : 2, async (spUpload) => {
                mdTrack = spUpload.prepareTrack(mdTrack);
                total = mdTrack.data.byteLength;
                [index] = (await this.parent.currentSession.downloadTrack(mdTrack, ({ writtenBytes }) => {
                    written = writtenBytes;
                    updateProgress();
                }));
            });
        }
        finally {
            await Promise.resolve(w.terminate()).catch(() => { });
        }
        if (this.fasterTransferEnabled) {
            await this.exploitStateManager.require(netmd_exploits_1.PCMFasterUpload);
        }
        return index;
    }
    async enableHiMDFullMode() {
        await this.exploitStateManager.require(netmd_exploits_1.HiMDUSBClassOverride);
    }
    async enableMonoUpload(enable) {
        if (enable) {
            await this.exploitStateManager.require(netmd_exploits_1.MonoSPUpload);
        }
        else {
            await this.exploitStateManager.unload(netmd_exploits_1.MonoSPUpload);
        }
    }
    async setDiscSwapDetection(enable) {
        if (enable) {
            await this.exploitStateManager.require(netmd_exploits_1.DisableDiscDetection);
        }
        else {
            await this.exploitStateManager.unload(netmd_exploits_1.DisableDiscDetection);
        }
    }
    async enterServiceMode() {
        await this.exploitStateManager.require(netmd_exploits_1.EnterServiceMode);
    }
}
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "readUTOCSector", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "writeUTOCSector", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "flushUTOCCacheToDisc", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "runTetris", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "getDeviceFirmware", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "readRAM", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "readFirmware", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "prepareDownload", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "finalizeDownload", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "exploitDownloadTrack", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "setSPSpeedupActive", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "uploadSP", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "enableHiMDFullMode", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "enableMonoUpload", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "setDiscSwapDetection", null);
__decorate([
    utils_2.asyncMutex
], NetMDFactoryUSBService.prototype, "enterServiceMode", null);
//# sourceMappingURL=netmd.js.map
