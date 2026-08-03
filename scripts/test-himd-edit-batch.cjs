const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { HiMDRestrictedService } = require('../dist/wmd/original/services/interfaces/himd.js');

class MockHiMD {
  constructor() {
    this.order = [1, 2, 3];
    this.strings = new Map();
    this.nextString = 1;
    this.tracks = new Map();
    for (const [slot, title] of [[1, 'A'], [2, 'B'], [3, 'C']]) {
      this.tracks.set(slot, {
        titleIndex: this.addString(title),
        albumIndex: 0,
        artistIndex: 0,
        seconds: 60 + slot,
        firstFragment: 1,
        codec: 'MP3',
        bitrate: 128,
      });
    }
    this.groups = [{
      startTrackIndex: 0,
      endTrackIndex: 2,
      titleIndex: this.addString('Old Group'),
      groupIndex: 1,
    }];
    this.discTitleIndex = 0;
  }

  isDirty() { return false; }
  getTrackCount() { return this.order.length; }
  trackIndexToTrackSlot(index) { return this.order[index]; }
  writeTrackIndexToTrackSlot(index, slot) { this.order[index] = slot; }
  getTrack(slot) { return { ...this.tracks.get(slot) }; }
  writeTrack(slot, track) { this.tracks.set(slot, { ...track }); }
  addString(value) {
    const index = this.nextString++;
    this.strings.set(index, value);
    return index;
  }
  getString(index) { return this.strings.get(index); }
  removeString(index) { this.strings.delete(index); }
  getGroupCount() { return this.groups.length; }
  getGroup(index) {
    if (index === 0) return { titleIndex: this.discTitleIndex, groupIndex: 0 };
    return { ...this.groups[index - 1] };
  }
  writeGroup(index, group) {
    if (index === 0) {
      this.discTitleIndex = group.titleIndex;
      return;
    }
    this.groups[index - 1] = { ...group, groupIndex: index };
  }
  eraseGroup(index) { this.groups.splice(index - 1, 1); }
  async flush() {}
}

function discFrom(mock) {
  const allTracks = mock.order.map((slot, index) => {
    const track = mock.tracks.get(slot);
    return {
      index,
      title: track.titleIndex ? mock.getString(track.titleIndex) : '',
      album: track.albumIndex ? mock.getString(track.albumIndex) : '',
      artist: track.artistIndex ? mock.getString(track.artistIndex) : '',
      duration: track.seconds,
      encoding: { codec: track.codec, bitrate: track.bitrate },
      fullWidthTitle: '',
      protected: 0,
      channel: 2,
    };
  });
  const groupedIndexes = new Set();
  const namedGroups = mock.groups.map((rawGroup) => {
    const tracks = allTracks.slice(rawGroup.startTrackIndex, rawGroup.endTrackIndex);
    tracks.forEach((track) => groupedIndexes.add(track.index));
    return {
      index: rawGroup.startTrackIndex,
      title: mock.getString(rawGroup.titleIndex) || '',
      fullWidthTitle: '',
      tracks,
    };
  });
  const ungroupedTracks = allTracks.filter((track) => !groupedIndexes.has(track.index));
  const groups = [
    { index: 0, title: null, fullWidthTitle: null, tracks: ungroupedTracks },
    ...namedGroups,
  ].sort((a, b) => (a.tracks[0]?.index ?? Number.MAX_SAFE_INTEGER) - (b.tracks[0]?.index ?? Number.MAX_SAFE_INTEGER));
  return {
    title: mock.discTitleIndex ? mock.getString(mock.discTitleIndex) : '',
    fullWidthTitle: '',
    left: 1,
    total: 2,
    used: 1,
    trackCount: allTracks.length,
    writable: true,
    writeProtected: false,
    groups,
  };
}

async function main() {
  const service = new HiMDRestrictedService({ debug: false });
  const mock = new MockHiMD();
  service.himd = mock;
  service.atdata = null;
  service.listContent = async () => discFrom(mock);
  service.initHiMD = async () => {};

  const result = await service.applyEditBatch({
    order: [2, 0, 1],
    discTitle: { title: '새 디스크' },
    metadata: [{ originalIndex: 1, title: '새 제목', album: '앨범', artist: '가수' }],
    groups: [
      { index: 0, title: '새 그룹', fullWidthTitle: '', tracks: [{ index: 0 }, { index: 1 }] },
      { index: 2, title: null, fullWidthTitle: null, tracks: [{ index: 2 }] },
    ],
  });
  const tracks = result.groups.flatMap((group) => group.tracks).sort((a, b) => a.index - b.index);
  assert.deepEqual(tracks.map((track) => track.title), ['C', 'A', '새 제목']);
  assert.equal(tracks[2].album, '앨범');
  assert.equal(tracks[2].artist, '가수');
  assert.equal(result.title, '새 디스크');
  assert.equal(result.groups.find((group) => group.title !== null).title, '새 그룹');

  const rendererBundle = readFileSync(
    join(__dirname, '..', 'custom-overrides', 'renderer', 'assets', 'index-DdAyCQFX.js'),
    'utf8'
  );
  assert.match(rendererBundle, /groupsChanged \? 1 : 0/);
  assert.match(rendererBundle, /discChanged \? 1 : 0/);
  assert.match(rendererBundle, /discTitle: n\.discTitle/);
  const preload = readFileSync(
    join(__dirname, '..', 'custom-overrides', 'dist', 'preload.js'),
    'utf8'
  );
  assert.match(preload, /button\[aria-label="편집 적용"\]/);
  assert.match(preload, /wmd-apply-pending-edits-request/);
  assert.match(preload, /편집 내용을 저장하고 연결을 종료하는 중/);
  assert.doesNotMatch(preload, /wmd-mode-exit-monitor-pause-request/);
  assert.doesNotMatch(preload, /connectionPreparationInProgress/);
  assert.match(preload, /const deadline = Date\.now\(\) \+ 60000/);
  assert.match(rendererBundle, /function clearPendingEditSession\(\)/);
  assert.match(rendererBundle, /clearPendingEditSession\(\), store\.dispatch\(actions\.setDisc\(null\)\)/);
  assert.match(rendererBundle, /기기가 편집 명령을 거부했습니다/);
  assert.match(rendererBundle, /let automaticDiscReadBlocked = !1/);
  assert.match(rendererBundle, /listContent\(!0, !0\)\(store\.dispatch\)/);
  assert.match(rendererBundle, /현재 디스크를 NetMD 모드에서 읽을 수 없습니다/);
  assert.match(rendererBundle, /디스크의 모든 곡을 삭제할까요\? 이 작업은 되돌릴 수 없습니다/);
  assert.doesNotMatch(rendererBundle, /Proceed with Wipe Disc\? This operation cannot be undone/);
  assert.match(rendererBundle, /디스크 전체 삭제가 완료되지 않았습니다/);
  assert.doesNotMatch(rendererBundle, /miniDiscModeExitInProgress/);
  assert.doesNotMatch(rendererBundle, /wmd-mode-exit-monitor-paused/);
  assert.match(rendererBundle, /skipConfirmation: true/);
  const netmdBatch = readFileSync(
    join(__dirname, '..', 'custom-overrides', 'dist', 'wmd', 'original', 'services', 'interfaces', 'netmd.js'),
    'utf8'
  );
  assert.match(netmdBatch, /discTitleChanged/);
  assert.match(netmdBatch, /if \(!orderChanged && !groupsChanged\)/);
  assert.match(netmdBatch, /this\.cachedContentList = result/);
  assert.doesNotMatch(netmdBatch, /const before = await this\.listContent\(true\)/);
  assert.match(netmdBatch, /적용 후 NetMD 디스크 이름이 요청한 결과와 다릅니다/);
  const mainProcess = readFileSync(
    join(__dirname, '..', 'custom-overrides', 'dist', 'main.js'),
    'utf8'
  );
  assert.match(mainProcess, /NETMD_EDIT_TIMEOUT/);
  assert.match(mainProcess, /HIMD_WIPE_TIMEOUT/);
  assert.match(mainProcess, /Hi-MD 디스크 삭제 완료 확인/);
  assert.match(mainProcess, /recentHiMDMediaMismatchAt/);
  assert.match(mainProcess, /Hi-MD media refresh retry started/);
  assert.match(mainProcess, /await withTimeout\(targetObject\.pair\(\), 10000/);
  assert.match(mainProcess, /switchHiMDInterfaceToNetMD\(hiMDDevice\)/);
  assert.match(rendererBundle, /A\.title = \(t \?\? ""\)\.normalize\("NFC"\)/);
  const batchPatch = readFileSync(
    join(__dirname, '..', 'custom-overrides', 'patches', 'himd-apply-edit-batch.ts.txt'),
    'utf8'
  );
  assert.doesNotMatch(batchPatch, /const result = await this\.listContent\(true\)/);
  console.log('Hi-MD batch edit regression test: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
