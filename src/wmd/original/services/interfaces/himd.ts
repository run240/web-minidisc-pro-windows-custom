// This file has been auto-generated! DO NOT EDIT!
import { Mutex } from 'async-mutex';
import { TrackFlag } from 'netmd-js';
import { Logger } from 'netmd-js/dist/logger';
import { makeAsyncWorker, makeAsyncCryptoBlockProvider } from 'himd-js/dist/web-crypto-worker';
import {
    HiMD,
    FSAHiMDFilesystem,
    getGroups,
    renameTrack,
    renameDisc,
    renameGroup,
    addGroup,
    deleteGroup,
    moveTrack,
    dumpTrack,
    rewriteGroups,
    UMSCHiMDFilesystem,
    uploadMP3Track,
    HiMDFile,
    HiMDWriteStream,
    uploadStreamingMacDependent,
    HiMDSecureSession,
    generateCodecInfo,
    HiMDKBPSToFrameSize,
    HiMDError,
    getCodecName,
    HiMDFilesystem,
    DevicesIds,
    deleteTracks,
    HIMD_AUDIO_SIZE,
    BLOCK_SIZE,
} from 'himd-js';
import {
    Capability,
    Disc,
    NetMDFactoryService,
    NetMDService,
    Track,
    Group,
    MinidiscSpec,
    RecordingCodec,
    Codec,
    TitleParameter,
    DeviceStatus,
} from './netmd';
import { concatUint8Arrays } from 'netmd-js/dist/utils';
import { recomputeGroupsAfterTrackMove } from '../../utils';
import { CryptoBlockProvider, CryptoProvider } from 'himd-js/dist/workers';

const WorkerURL = null as any;

export class HiMDSpec implements MinidiscSpec {
    constructor() {
        this.specName = 'HiMD';
    }
    public availableFormats: RecordingCodec[] = [
        { codec: 'A3+', availableBitrates: [352, 256, 192, 64, 48], defaultBitrate: 256 },
        { codec: 'AT3', availableBitrates: [132, 105, 66], defaultBitrate: 132 },
        { codec: 'MP3', availableBitrates: [320, 256, 192, 128, 96, 64], defaultBitrate: 192 },
        { codec: 'PCM', availableBitrates: [1411], defaultBitrate: 1411 },
    ];
    public readonly measurementUnits = 'bytes';
    public defaultFormat = [0, 1] as [number, number];
    public specName: string;

    getRemainingCharactersForTitles(disc: Disc): { halfWidth: number; fullWidth: number } {
        const ALL_CHARACTERS = 0x1000 * 14;
        const t = (x: string) => Math.floor((x.length + 13) / 14) * 14;
        let amt = 0;
        // TODO: this can be integrated into himd-js at some point...
        for (let group of disc.groups) {
            if (group.title) {
                amt += t(group.title);
            }
            for (let track of group.tracks) {
                if (track.title) amt += t(track.title);
                if (track.album) amt += t(track.album);
                if (track.artist) amt += t(track.artist);
            }
        }
        if (disc.title) amt += t(disc.title);
        return { halfWidth: ALL_CHARACTERS - amt, fullWidth: 1 };
    }

    getCharactersForTitle(track: Track): { halfWidth: number; fullWidth: number } {
        const t = (x: string) => Math.floor((x.length + 13) / 14) * 14;
        let amt = 0;
        if (track.title) amt += t(track.title);
        if (track.album) amt += t(track.album);
        if (track.artist) amt += t(track.artist);
        return { halfWidth: amt, fullWidth: 0 };
    }

    translateDefaultMeasuringModeTo(codec: Codec, defaultMeasuringModeDuration: number): number {
        throw new Error('Illegal in bytes-measuring mode!');
    }

    translateToDefaultMeasuringModeFrom(codec: Codec, defaultMeasuringModeDuration: number): number {
        const imprecise = (defaultMeasuringModeDuration /*in seconds*/ * codec.bitrate * 1024) / 8;
        let frameSize;
        switch (codec.codec) {
            case 'A3+':
                frameSize = HiMDKBPSToFrameSize.atrac3plus[codec.bitrate]!;
                break;
            case 'AT3':
                frameSize = HiMDKBPSToFrameSize.atrac3[codec.bitrate]!;
                break;
            case 'PCM':
                frameSize = 64;
                break;
            default:
                return imprecise;
        }
        const framesPerBlock = Math.floor(HIMD_AUDIO_SIZE / frameSize);
        const frames = Math.ceil(imprecise / frameSize);
        const actual = (frames / framesPerBlock) * BLOCK_SIZE;
        return actual;
    }
    sanitizeFullWidthTitle(title: string) {
        return title;
    }
    sanitizeHalfWidthTitle(title: string) {
        return title;
    }
}

export class HiMDRestrictedService extends NetMDService {
    private logger?: Logger;
    public mutex = new Mutex();
    public himd?: HiMD;
    protected cachedDisc?: Disc;
    protected atdata: HiMDFile | null = null;
    protected fsDriver?: HiMDFilesystem;
    protected spec: MinidiscSpec;
    protected bypassFSCoherencyChecks = false;

    constructor({ debug = false }: { debug: boolean }) {
        super();
        if (debug) {
            // Logging a few methods that have been causing issues with some units
            const _fn = (...args: any) => {
                if (args && args[0] && args[0].method) {
                    console.log(...args);
                }
            };
            this.logger = {
                debug: _fn,
                info: _fn,
                warn: _fn,
                error: _fn,
                child: () => this.logger!,
            };
        }
        this.spec = new HiMDSpec();
    }
    getRemainingCharactersForTitles(disc: Disc): { halfWidth: number; fullWidth: number } {
        return { halfWidth: Number.MAX_SAFE_INTEGER, fullWidth: Number.MAX_SAFE_INTEGER };
    }
    getCharactersForTitle(track: Track): { halfWidth: number; fullWidth: number } {
        return {
            halfWidth: (track.album ?? '').length + (track.artist ?? '').length + (track.title ?? '').length,
            fullWidth: 0,
        };
    }
    getWorker(): any[] {
        return [new Worker(new URL(WorkerURL, window.location.href), { type: 'classic' }), makeAsyncWorker, makeAsyncCryptoBlockProvider];
    }

    async getDeviceStatus(): Promise<DeviceStatus> {
        return {
            discPresent: true,
            state: 'ready',
            time: {
                frame: 0,
                minute: 0,
                second: 0,
            },
            track: 0,
            canBeFlushed: this.atdata !== null || (this.himd?.isDirty() ?? false),
        };
    }

    protected async reloadCache() {
        if (this.cachedDisc === undefined) {
            let { left, total, used } = await this.himd!.filesystem.statFilesystem();

            if (left < 1048576) {
                // If we have less than a MiB left, make it seem the drive is 100% filled.
                used += left;
                left = 0;
            }

            const trackCount = this.himd!.getTrackCount();
            const groups = getGroups(this.himd!);
            // FIXME: When a group title is null in himd, it means it's titleless and the
            // group title index is unset (=0). In WMD it means the group is <ungrouped tracks>
            // NetMD should instead make sure the <ungrouped tracks> is just the 0th group, instead of all groups where title === null
            this.cachedDisc = {
                fullWidthTitle: '',
                title: this.himd!.getDiscTitle() || '',
                groups: groups.map((g, i) => ({
                    fullWidthTitle: '',
                    title: g.title ?? (i === 0 ? null : ''),
                    index: g.startIndex,
                    tracks: g.tracks.map((trk) => ({
                        index: trk.index,
                        title: trk.title ?? '',
                        album: trk.album ?? '',
                        artist: trk.artist ?? '',
                        encoding: { codec: trk.encoding, bitrate: trk.bitrate },
                        fullWidthTitle: '',
                        protected: TrackFlag.unprotected,
                        channel: 2,
                        duration: trk.duration,
                    })) as Track[],
                })),
                left,
                total,
                used,
                trackCount,
                writable: false,
                writeProtected: true,
            };
        }
    }

    protected dropCachedContentList() {
        console.log('Cached TOC Dropped');
        this.cachedDisc = undefined;
    }

    async initHiMD() {
        this.himd = await HiMD.init(this.fsDriver!);
    }

    async listContent(dropCache?: boolean | undefined): Promise<Disc> {
        if (dropCache && this.himd?.isDirty()) {
            window.alert('You have changes not yet written to disc. Please apply changes first.');
            await this.reloadCache();
            return JSON.parse(JSON.stringify(this.cachedDisc!));
        }
        if (!this.himd || dropCache) {
            await this.initHiMD();
        }
        (window as any).himd = this.himd;
        if (dropCache) this.cachedDisc = undefined;
        await this.reloadCache();
        return JSON.parse(JSON.stringify(this.cachedDisc!));
    }
    async getDeviceName(): Promise<string> {
        return 'HiMD';
    }
    async finalize(): Promise<void> {}

    async renameTrack(index: number, newTitle: TitleParameter, newFullWidthTitle?: string | undefined) {
        if (typeof newTitle === 'string') {
            newTitle = { title: newTitle };
        }
        renameTrack(this.himd!, index, newTitle);
        this.dropCachedContentList();
    }

    async renameDisc(newName: string, newFullWidthName?: string | undefined) {
        renameDisc(this.himd!, newName);
        this.dropCachedContentList();
    }

    async renameGroup(groupIndex: number, newTitle: string, newFullWidthTitle?: string | undefined): Promise<void> {
        // groupIndex here is the index of the first track in the group
        // convert it to the actual group index
        const groups = getGroups(this.himd!);
        const index = groups.find((e) => e.startIndex === groupIndex && e.title !== null)!.groupIndex;
        renameGroup(this.himd!, index, newTitle);
        this.dropCachedContentList();
    }

    async addGroup(groupBegin: number, groupLength: number, name: string, fullWidthTitle?: string | undefined) {
        addGroup(this.himd!, name, groupBegin, groupLength);
        this.dropCachedContentList();
    }

    async deleteGroup(groupIndex: number) {
        const groups = getGroups(this.himd!);
        const index = groups.find((e) => e.startIndex === groupIndex && e.title !== null)!.groupIndex;
        deleteGroup(this.himd!, index);
        this.dropCachedContentList();
    }

    async rewriteGroups(groups: Group[]): Promise<void> {
        rewriteGroups(
            this.himd!,
            groups
                .filter((e) => e.title !== null)
                .map((e) => ({
                    title: e.title,
                    indices: e.tracks.map((q) => q.index),
                }))
        );
        this.dropCachedContentList();
    }

    async applyEditBatch(batch: {
        order?: number[];
        metadata?: Array<{
            originalIndex: number;
            title?: string;
            album?: string;
            artist?: string;
        }>;
        discTitle?: {
            title?: string;
        } | null;
        groups?: Group[];
    }): Promise<Disc> {
        if (!this.himd) {
            throw new Error('Hi-MD 디스크가 연결되어 있지 않습니다.');
        }
        if (this.atdata !== null || this.himd.isDirty()) {
            throw new Error('Hi-MD에 아직 저장되지 않은 다른 작업이 있습니다. 먼저 변경 사항을 저장하거나 디스크를 다시 연결해 주세요.');
        }

        const before = await this.listContent();
        const originalTracks = before.groups
            .flatMap((group) => group.tracks)
            .sort((a, b) => a.index - b.index);
        const trackCount = originalTracks.length;
        const order = Array.isArray(batch?.order) ? batch.order.map(Number) : [];
        if (
            order.length !== trackCount ||
            new Set(order).size !== trackCount ||
            order.some((index) => !Number.isInteger(index) || index < 0 || index >= trackCount)
        ) {
            throw new Error('Hi-MD 편집 목록의 트랙 순서가 올바르지 않습니다.');
        }

        const sanitize = (value: unknown) => String(value ?? '').normalize('NFC').replace(/\0/g, '');
        const expectedDiscTitle = batch?.discTitle ? sanitize(batch.discTitle.title) : before.title;
        const discTitleChanged = expectedDiscTitle !== before.title;
        const metadata = Array.isArray(batch?.metadata) ? batch.metadata : [];
        const metadataIndexes = new Set<number>();
        const editedTracks = originalTracks.map((track) => ({ ...track }));
        for (const edit of metadata) {
            const originalIndex = Number(edit.originalIndex);
            if (
                !Number.isInteger(originalIndex) ||
                originalIndex < 0 ||
                originalIndex >= trackCount ||
                metadataIndexes.has(originalIndex)
            ) {
                throw new Error('Hi-MD 제목 편집 대상이 올바르지 않습니다.');
            }
            metadataIndexes.add(originalIndex);
            editedTracks[originalIndex].title = sanitize(edit.title);
            editedTracks[originalIndex].album = sanitize(edit.album);
            editedTracks[originalIndex].artist = sanitize(edit.artist);
        }

        const requestedGroups = Array.isArray(batch?.groups) ? batch.groups : before.groups;
        const normalizedGroups = requestedGroups.map((group) => ({
            ...group,
            title: group.title === null ? null : sanitize(group.title),
            tracks: [...group.tracks].sort((a, b) => a.index - b.index),
        }));
        const groupedIndexes = normalizedGroups.flatMap((group) => group.tracks.map((track) => Number(track.index)));
        if (
            groupedIndexes.length !== trackCount ||
            new Set(groupedIndexes).size !== trackCount ||
            groupedIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= trackCount)
        ) {
            throw new Error('Hi-MD 그룹 편집 목록에 누락되거나 중복된 트랙이 있습니다.');
        }
        for (const group of normalizedGroups.filter((item) => item.title !== null && item.tracks.length > 0)) {
            const indexes = group.tracks.map((track) => track.index).sort((a, b) => a - b);
            if (indexes[indexes.length - 1] - indexes[0] !== indexes.length - 1) {
                throw new Error(`Hi-MD 그룹 "${group.title}"의 트랙이 연속되어 있지 않습니다.`);
            }
        }

        const trackSignature = (track: Track) =>
            JSON.stringify([
                track.title ?? '',
                track.album ?? '',
                track.artist ?? '',
                track.duration,
                track.encoding,
            ]);
        const expectedTrackSignatures = order.map((originalIndex) => trackSignature(editedTracks[originalIndex]));
        const groupSignature = (groups: Group[]) =>
            JSON.stringify(
                groups
                    .filter((group) => group.tracks.length > 0)
                    .map((group) => ({
                        title: group.title === null ? null : sanitize(group.title),
                        indices: group.tracks.map((track) => track.index).sort((a, b) => a - b),
                    }))
                    .sort((a, b) => a.indices[0] - b.indices[0])
            );
        const expectedGroupSignature = groupSignature(normalizedGroups);
        const groupsChanged = expectedGroupSignature !== groupSignature(before.groups);
        const currentOrder = Array.from({ length: trackCount }, (_, index) => index);
        let writeStarted = false;
        let flushStarted = false;

        try {
            if (discTitleChanged) {
                renameDisc(this.himd, expectedDiscTitle);
                writeStarted = true;
            }
            for (const edit of metadata) {
                const originalIndex = Number(edit.originalIndex);
                renameTrack(this.himd, originalIndex, {
                    title: sanitize(edit.title),
                    album: sanitize(edit.album),
                    artist: sanitize(edit.artist),
                });
                writeStarted = true;
            }
            for (let destination = 0; destination < order.length; destination++) {
                const source = currentOrder.indexOf(order[destination]);
                if (source === destination) continue;
                moveTrack(this.himd, source, destination);
                const [moved] = currentOrder.splice(source, 1);
                currentOrder.splice(destination, 0, moved);
                writeStarted = true;
            }
            if (groupsChanged) {
                rewriteGroups(
                    this.himd,
                    normalizedGroups
                        .filter((group) => group.title !== null && group.tracks.length > 0)
                        .map((group) => ({
                            title: group.title,
                            indices: group.tracks.map((track) => track.index),
                        }))
                );
                writeStarted = true;
            }
            if (!writeStarted) {
                return before;
            }

            flushStarted = true;
            await this.himd.flush();
            this.dropCachedContentList();
            // The UMSC filesystem is already initialized and open. Calling
            // listContent(true) here reinitializes the same USB mass-storage
            // session and can leave libusb transferIn waiting indefinitely.
            // Flush has completed, so validate against the current HiMD model
            // without reopening the USB filesystem.
            const result = await this.listContent();
            const actualTracks = result.groups
                .flatMap((group) => group.tracks)
                .sort((a, b) => a.index - b.index);
            if (actualTracks.length !== trackCount) {
                throw new Error(`적용 후 트랙 수가 ${trackCount}개에서 ${actualTracks.length}개로 달라졌습니다.`);
            }
            if (actualTracks.map(trackSignature).some((signature, index) => signature !== expectedTrackSignatures[index])) {
                throw new Error('적용 후 Hi-MD 트랙 제목 또는 순서가 요청한 결과와 다릅니다.');
            }
            if (result.title !== expectedDiscTitle) {
                throw new Error('적용 후 Hi-MD 디스크 이름이 요청한 결과와 다릅니다.');
            }
            if (groupSignature(result.groups) !== expectedGroupSignature) {
                throw new Error('적용 후 Hi-MD 그룹 구성이 요청한 결과와 다릅니다.');
            }
            return result;
        } catch (error) {
            this.dropCachedContentList();
            if (!flushStarted) {
                try {
                    await this.initHiMD();
                } catch {
                    // The original error below is more useful to the user.
                }
            }
            throw new Error(
                `${flushStarted ? 'Hi-MD 편집 내용을 기록한 뒤 검증 중 오류가 발생했습니다. 디스크를 다시 검색해 실제 제목과 순서를 확인해 주세요.\n' : ''}${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
    async deleteTracks(indexes: number[]): Promise<void> {
        window.alert('Unavailable in restricted mode');
    }

    async wipeDisc(): Promise<void> {
        window.alert('Unavailable in restricted mode');
    }

    async moveTrack(src: number, dst: number, updateGroups?: boolean) {
        if (updateGroups) {
            this.rewriteGroups(recomputeGroupsAfterTrackMove(await this.listContent(), src, dst).groups);
        }
        moveTrack(this.himd!, src, dst);
        this.dropCachedContentList();
    }

    async prepareUpload() {
        if (this.atdata !== null) throw new Error('Already prepared');
        this.atdata = await this.himd!.openAtdataForWriting();
    }

    async finalizeUpload(): Promise<void> {
        // Close and flush everything
        await this.atdata!.close();
        await this.flush();
        this.atdata = null;
        this.dropCachedContentList();
    }

    async upload(
        title: TitleParameter,
        fullWidthTitle: string,
        data: ArrayBuffer,
        format: Codec,
        progressCallback: (progress: { written: number; encrypted: number; total: number }) => void
    ) {
        throw new Error('Unavailable in restricted mode');
    }
    async download(
        index: number,
        progressCallback: (progress: { read: number; total: number }) => void
    ): Promise<{ extension: string; data: Uint8Array<ArrayBuffer> } | null> {
        const trackNumber = this.himd!.trackIndexToTrackSlot(index);
        const [w, creator, _] = this.getWorker();
        const webWorker = await creator(w);
        const info = dumpTrack(this.himd!, trackNumber, webWorker);
        const blocks: Uint8Array[] = [];
        for await (const { data, total } of info.data) {
            blocks.push(data);
            progressCallback({ read: blocks.length, total });
        }
        webWorker.close();
        w.terminate();
        return { extension: info.format.toLowerCase(), data: concatUint8Arrays(...blocks) };
    }

    async getServiceCapabilities() {
        return [Capability.contentList, Capability.metadataEdit, Capability.trackDownload, Capability.himdTitles];
    }

    async pair() {
        this.fsDriver = await FSAHiMDFilesystem.init();
        return true;
    }

    async connect() {
        return false;
    }

    async flush() {
        await this.himd!.flush();
    }

    //////////////////////////////STUBS//////////////////////////////

    ejectDisc(): Promise<void> {
        throw new Error('Method impossible to implement.');
    }

    factory(): Promise<NetMDFactoryService | null> {
        throw new Error('Method impossible to implement.');
    }

    async wipeDiscTitleInfo(): Promise<void> {}

    isDeviceConnected(device: USBDevice) {
        return false;
    }

    ///////////////////////UNRESTRICTED ONLY/////////////////////////

    play(): Promise<void> {
        return Promise.resolve();
    }
    pause(): Promise<void> {
        return Promise.resolve();
    }
    stop(): Promise<void> {
        return Promise.resolve();
    }
    next(): Promise<void> {
        return Promise.resolve();
    }
    prev(): Promise<void> {
        return Promise.resolve();
    }
    gotoTrack(index: number): Promise<void> {
        return Promise.resolve();
    }
    gotoTime(index: number, hour: number, minute: number, second: number, frame: number): Promise<void> {
        return Promise.resolve();
    }
    getPosition(): Promise<number[] | null> {
        return Promise.resolve(null);
    }
}

export class HiMDFullService extends HiMDRestrictedService {
    protected worker: CryptoProvider | null = null;
    protected streamingWorker: CryptoBlockProvider | null = null;
    protected session: HiMDSecureSession | null = null;
    protected fsDriver?: UMSCHiMDFilesystem;
    constructor(p: { debug: boolean }) {
        super(p);
        this.spec = new HiMDSpec();
    }
    async getDeviceName(): Promise<string> {
        if (!this.himd) await this.initHiMD();
        return `HiMD (${this.himd!.getDeviceName()})`;
    }

    async getServiceCapabilities() {
        return [Capability.contentList, Capability.metadataEdit, Capability.trackDownload, Capability.trackUpload, Capability.himdTitles];
    }

    async pair() {
        // A service instance is reused when the renderer returns to the mode
        // selection screen. Never carry a previous disc across a new pairing.
        this.himd = undefined;
        this.cachedDisc = undefined;
        this.atdata = null;
        const device = await navigator.usb.requestDevice({ filters: DevicesIds });
        await device.open();
        try {
            await device.reset();
        } catch (ex) {
            console.log(ex);
        }
        this.fsDriver = new UMSCHiMDFilesystem(device);
        return true;
    }

    async initHiMD(): Promise<void> {
        await this.fsDriver!.init(this.bypassFSCoherencyChecks);
        this.himd = await HiMD.init(this.fsDriver!);
        Object.defineProperty(globalThis, 'signHiMDDisc', {
            configurable: true,
            writable: true,
            value: async () => {
                // Regenerate all MACs, rewrite track index, rewrite MCLIST
                console.log(
                    "NOTICE: It's impossible to re-sign MP3 audio.\nMP3s need to instead be re-encrypted.\nPlease download the MP3 files from the working disc, and reupload them here"
                );
                const session = new HiMDSecureSession(this.himd!, this.fsDriver!.driver);
                await session.performAuthentication();
                console.log('Authenticated');
                for (let i = 0; i < this.himd!.getTrackCount(); i++) {
                    const slot = this.himd!.trackIndexToTrackSlot(i);
                    const track = this.himd!.getTrack(slot);
                    if (getCodecName(track) === 'MP3') {
                        track.mac.fill(0);
                        session.allMacs!.set(track.mac, (slot - 1) * 8);
                    } else {
                        const mac = session.createTrackMac(track);
                        track.mac = mac;
                    }
                    track.trackNumber = slot;
                    this.himd!.writeTrack(slot, track);
                    console.log(`Rewritten MAC for track ${slot}@${i}`);
                }
                console.log('All MACs rewritten. Finalizing the session');
                await session.finalizeSession();
                console.log('Session finalized! The disc should now be signed.');
                await this.himd!.flush();
            },
        });
    }

    async listContent(dropCache?: boolean): Promise<Disc> {
        if (dropCache) {
            await this.fsDriver!.init();
        }
        return super.listContent(dropCache);
    }

    async finalizeUpload(): Promise<void> {
        await super.finalizeUpload();
        if (this.session) {
            await this.session!.finalizeSession();
            this.session = null;
        }
        await this.himd!.flush();
        this.streamingWorker?.close();
        this.streamingWorker = null;
    }

    async finalize(): Promise<void> {
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
    }

    async prepareUpload(): Promise<void> {
        await super.prepareUpload();
        const [w, _, creator] = this.getWorker();
        this.streamingWorker = creator(w);
    }

    async deleteTracks(indexes: number[]): Promise<void> {
        const allTrackSlots = indexes.map((e) => this.himd!.trackIndexToTrackSlot(e));
        let content = await this.listContent();
        for (const index of indexes) {
            content = recomputeGroupsAfterTrackMove(content, index, -1);
        }
        await deleteTracks(this.himd!, indexes);
        this.rewriteGroups(content.groups);
        // Re-sign the disc
        const session = new HiMDSecureSession(this.himd!, this.fsDriver!.driver);
        await session.performAuthentication();
        for (let trackSlot of allTrackSlots) {
            session.allMacs!.set(new Uint8Array(8).fill(0), (trackSlot - 1) * 8);
        }
        await session.finalizeSession();
        this.dropCachedContentList();
    }

    async upload(
        title: TitleParameter,
        fullWidthTitle: string,
        data: ArrayBuffer,
        format: Codec,
        progressCallback: (progress: { written: number; encrypted: number; total: number }) => void
    ): Promise<void> {
        if (format.codec === 'MP3') {
            const stream = new HiMDWriteStream(this.himd!, this.atdata!, true);
            let firstByteOffset = -1;
            await uploadMP3Track(
                this.himd!,
                stream,
                data,
                title as { title?: string | undefined; album?: string | undefined; artist?: string | undefined },
                (obj) => {
                    if (firstByteOffset === -1) {
                        firstByteOffset = obj.byte;
                    }
                    progressCallback({
                        written: obj.byte - firstByteOffset,
                        encrypted: obj.byte - firstByteOffset,
                        total: obj.totalBytes - firstByteOffset,
                    });
                },
                true
            );
        } else {
            if (!this.session) {
                this.session = new HiMDSecureSession(this.himd!, this.fsDriver!.driver);
                await this.session.performAuthentication();
            }
            const stream = new HiMDWriteStream(this.himd!, this.atdata!, true);
            const titleObject = title as { title?: string; album?: string; artist?: string };
            let frameSize;
            switch (format.codec) {
                case 'A3+':
                    frameSize = HiMDKBPSToFrameSize.atrac3plus[format.bitrate!];
                    break;
                case 'AT3':
                    frameSize = HiMDKBPSToFrameSize.atrac3[format.bitrate!];
                    break;
                case 'PCM':
                    frameSize = 0;
                    break;
                default:
                    throw new HiMDError('Invalid format');
            }
            const codecInfo = generateCodecInfo(format.codec, frameSize);
            let written = 0;
            let encrypted = 0;
            const total = data.byteLength;
            const runCallback = () => progressCallback({ written, encrypted, total });
            await uploadStreamingMacDependent(
                this.himd!,
                this.session!,
                stream,
                data,
                codecInfo,
                titleObject,
                this.streamingWorker!,
                ({ encryptedBytes }) => {
                    encrypted = encryptedBytes;
                    runCallback();
                },
                ({ writtenBytes }) => {
                    written = writtenBytes;
                    runCallback();
                },
                true
            );
        }
    }

    isDeviceConnected(device: USBDevice) {
        return this.fsDriver?.driver.isDeviceConnected(device) ?? false;
    }

    async wipeDisc(): Promise<void> {
        const space = await this.fsDriver!.getTotalSpace();
        // Recreate FS only on the 1GB discs
        await this.himd!.wipe(space > 500000000);
        this.dropCachedContentList();
    }
}
