"use strict";

const { ipcRenderer } = require("electron");

const state = {
    folder: "",
    tracks: [],
    albumGroups: [],
    activeAlbumKey: "",
    outputFolder: "",
};

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className)
        element.className = className;
    if (text !== undefined)
        element.textContent = text;
    return element;
}

function setBusy(button, busy, text) {
    if (busy) {
        button.dataset.originalText = button.textContent;
        button.textContent = text;
        button.disabled = true;
    }
    else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

function installStyles() {
    if (document.getElementById("md-squirrel-styles"))
        return;
    const style = document.createElement("style");
    style.id = "md-squirrel-styles";
    style.textContent = `
      #md-squirrel-launcher {
        position: fixed; z-index: 2147482000; width: 82px; height: 82px; padding: 0;
        display: block; border: 0; border-radius: 50%; overflow: visible; color: #f4d9e7;
        background: transparent; cursor: pointer; transition: transform .16s ease;
      }
      #md-squirrel-launcher:hover {
        transform: translateY(-2px);
      }
      #md-squirrel-launcher .mds-launcher-label {
        position: absolute; right: 91px; top: 50%; transform: translateY(-50%);
        display: block; color: #aaa3ad; font-size: 11px; font-weight: 400;
        letter-spacing: 0; line-height: 1; white-space: nowrap;
        text-shadow: 0 1px 4px rgba(0,0,0,.65);
      }
      #md-squirrel-launcher .mds-icon-frame {
        position: absolute; inset: 0; display: grid !important; place-items: center;
        width: 82px !important; height: 82px !important; overflow: hidden;
        border: 1px solid rgba(219,92,151,.62); border-radius: 50%; background: #17151a;
        box-sizing: border-box;
        box-shadow: 0 12px 32px rgba(0,0,0,.48), 0 0 0 5px rgba(219,92,151,.07);
        transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
      }
      #md-squirrel-launcher:hover .mds-icon-frame {
        transform: scale(1.04); border-color: #ee79af;
        box-shadow: 0 15px 38px rgba(0,0,0,.55), 0 0 0 6px rgba(219,92,151,.12);
      }
      #md-squirrel-launcher img {
        width: 100% !important; height: 100% !important; max-width: none !important;
        object-fit: cover; display: block; border-radius: 50%;
      }
      #md-squirrel-launcher .mds-fallback {
        display: none; width: 100%; height: 100%; place-items: center; font-size: 42px;
      }
      #md-squirrel-launcher .mds-launcher-tooltip {
        position: absolute; right: 0; bottom: 96px; width: 238px; padding: 10px 13px;
        color: #eee8ee; background: rgba(35,31,37,.98); border: 1px solid #634156;
        border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.48);
        font-size: 12px; font-weight: 400; line-height: 1.55; text-align: left;
        white-space: nowrap; pointer-events: none; opacity: 0;
        transform: translateY(0); transition: none;
      }
      #md-squirrel-launcher .mds-launcher-tooltip::after {
        content: ""; position: absolute; right: 28px; bottom: -7px; width: 12px; height: 12px;
        background: #231f25; border-right: 1px solid #634156; border-bottom: 1px solid #634156;
        transform: rotate(45deg);
      }
      #md-squirrel-launcher:hover .mds-launcher-tooltip,
      #md-squirrel-launcher:focus-visible .mds-launcher-tooltip {
        opacity: 1;
      }
      #md-squirrel-overlay {
        position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center;
        padding: 24px; background: rgba(4,4,7,.72); backdrop-filter: blur(7px);
      }
      .mds-modal {
        width: min(1050px, calc(100vw - 48px)); height: min(760px, calc(100vh - 48px));
        display: grid; grid-template-rows: auto 1fr; overflow: hidden;
        color: #f8f4f7; background: linear-gradient(145deg, #211e24, #17161a);
        border: 1px solid #46404a; border-radius: 22px; box-shadow: 0 32px 100px rgba(0,0,0,.72);
        font-family: "Segoe UI", "Malgun Gothic", sans-serif;
      }
      .mds-header {
        position: relative; display: flex; justify-content: space-between; align-items: center; padding: 18px 22px;
        border-bottom: 1px solid #39343c; background: rgba(15,14,17,.5);
      }
      .mds-brand { display: flex; align-items: center; gap: 13px; }
      .mds-brand img { width: 52px; height: 52px; object-fit: cover; border-radius: 50%; border: 1px solid #684257; }
      .mds-brand h2 { margin: 0; color: #fff; font-size: 22px; }
      .mds-brand p { margin: 3px 0 0; color: #aaa1ab; font-size: 12px; }
      .mds-header-folder {
        flex: 1 1 300px; min-width: 170px; max-width: 390px; margin: 0 20px;
        display: flex; align-items: center; gap: 10px; padding: 8px 10px;
        background: rgba(29,27,32,.7); border: 1px solid #39343f; border-radius: 10px;
      }
      .mds-header-folder .mds-folderinfo { flex: 1; min-width: 0; }
      .mds-header-folder .mds-button { flex: 0 0 auto; padding: 7px 9px; font-size: 11px; }
      .mds-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
      .mds-header-actions .mds-progress { width: min(220px, 22vw); margin: 0; }
      .mds-header-actions .mds-progress-text {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .mds-generate { min-width: 126px; white-space: nowrap; }
      .mds-close {
        width: 40px; height: 40px; padding: 0; color: #ddd5de; background: transparent;
        border: 1px solid #49434c; border-radius: 11px; font-size: 24px; cursor: pointer;
      }
      .mds-body { overflow: auto; padding: 20px 22px 24px; }
      .mds-card { padding: 18px; background: #1d1b20; border: 1px solid #39343f; border-radius: 15px; }
      .mds-start {
        min-height: 330px; display: grid; place-items: center; text-align: center;
        background: radial-gradient(circle at 50% 0%, rgba(219,92,151,.11), transparent 55%), #19171c;
      }
      .mds-start-inner { max-width: 600px; }
      .mds-start h3 { margin: 12px 0 10px; color: #fff; font-size: 28px; }
      .mds-start p { margin: 0 auto 22px; color: #b3abb5; line-height: 1.65; }
      .mds-safe { color: #7bd7bc; font-size: 13px; font-weight: 700; }
      .mds-button {
        padding: 11px 16px; color: #f8f3f6; background: #332830; border: 1px solid #644154;
        border-radius: 10px; font-weight: 700; cursor: pointer;
      }
      .mds-button.primary { background: linear-gradient(135deg, #d65b94, #b7467a); border-color: #db6a9e; }
      .mds-button.ghost { color: #ddd5df; background: transparent; border-color: #48424b; }
      .mds-button:disabled { opacity: .55; cursor: wait; }
      .mds-workspace { display: grid; gap: 14px; }
      .mds-folderbar { display: flex; justify-content: space-between; align-items: center; gap: 18px; }
      .mds-folderinfo { min-width: 0; display: grid; gap: 4px; }
      .mds-folderinfo span { color: #9e969f; font-size: 11px; }
      .mds-folderinfo strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
      .mds-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .mds-heading h3 { margin: 0; color: #fff; font-size: 16px; }
      .mds-heading span { color: #aaa2ac; font-size: 11px; }
      .mds-heading-actions { display: flex; align-items: center; gap: 9px; }
      .mds-button.mds-track-search { padding: 7px 10px; font-size: 11px; }
      .mds-group-row {
        display: grid; grid-template-columns: 1fr auto; gap: 12px;
        align-items: center; margin-bottom: 12px; padding: 10px 12px;
        background: #17151a; border: 1px solid #38333b; border-radius: 10px;
      }
      .mds-album-tabs { display: flex; gap: 7px; overflow-x: auto; padding: 1px; }
      .mds-album-tab {
        flex: 0 0 auto; max-width: 330px; overflow: hidden; text-overflow: ellipsis;
        padding: 8px 11px; color: #bcb4bd; background: #211e24;
        border: 1px solid #454048; border-radius: 9px; cursor: pointer; white-space: nowrap;
        font: inherit; font-size: 12px;
      }
      .mds-album-tab.active {
        color: #fff; border-color: #b34d7d; background: #3a2330;
        box-shadow: 0 0 0 2px rgba(179,77,125,.12);
      }
      .mds-group-note { align-self: center; color: #c9a8b8; font-size: 11px; }
      .mds-search { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
      .mds-label { display: grid; gap: 6px; color: #aaa2ac; font-size: 11px; }
      .mds-input {
        width: 100%; padding: 10px 11px; color: #f8f4f7; background: #111014;
        border: 1px solid #3b3740; border-radius: 9px; outline: none;
      }
      select.mds-input { cursor: pointer; }
      .mds-input:focus { border-color: #a94a76; box-shadow: 0 0 0 3px rgba(169,74,118,.16); }
      .mds-results { display: grid; gap: 7px; max-height: 150px; overflow: auto; margin-top: 12px; }
      .mds-release {
        display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center;
        padding: 10px 12px; background: #131216; border: 1px solid #312d34; border-radius: 9px;
      }
      .mds-release strong { display: block; margin-bottom: 3px; font-size: 13px; }
      .mds-release span { color: #9e969f; font-size: 11px; }
      .mds-table-wrap {
        height: min(520px, calc(100vh - 280px)); min-height: 300px;
        overflow: auto; border: 1px solid #343038; border-radius: 10px;
      }
      .mds-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .mds-table th, .mds-table td { padding: 8px 9px; text-align: left; border-bottom: 1px solid #2f2b32; font-size: 12px; }
      .mds-table th { position: sticky; top: 0; z-index: 1; color: #aaa2ac; background: #252229; }
      .mds-table th:nth-child(1) { width: 42px; }
      .mds-table th:nth-child(2) { width: 28%; }
      .mds-table th:nth-child(3) { width: 36%; }
      .mds-table tr.mds-active-track td { background: rgba(179,77,125,.045); }
      .mds-track-original { color: #f1ebf0; }
      .mds-track-album {
        display: block; max-width: 100%; margin-top: 3px; overflow: hidden;
        color: #8f8791; font-size: 10px; text-overflow: ellipsis; white-space: nowrap;
      }
      .mds-table input { padding: 8px 9px; font-size: 12px; }
      .mds-candidate-select {
        flex: 1 1 auto; min-width: 0; height: 34px; padding: 7px 9px; overflow: hidden;
        color: #f4dce7; background: #2c1c25; border: 1px solid #8d4567;
        border-radius: 8px; outline: none; font-size: 11px; text-overflow: ellipsis;
      }
      .mds-candidate-tools { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
      .mds-web-search {
        flex: 0 0 auto; height: 34px; padding: 0 9px; color: #d8cbd3;
        background: transparent; border: 1px solid #554b54; border-radius: 8px;
        cursor: pointer; font-size: 10px; white-space: nowrap;
      }
      .mds-web-search:hover { color: #fff; border-color: #b65381; background: #30212a; }
      .mds-progress { display: none; gap: 6px; margin-top: 12px; color: #aaa2ac; font-size: 11px; }
      .mds-progress.visible { display: grid; }
      .mds-progress-track { height: 6px; overflow: hidden; background: #342b33; border-radius: 99px; }
      .mds-progress-bar { width: 0; height: 100%; background: linear-gradient(90deg, #dc5c96, #7bd7bc); }
      .mds-toast {
        position: fixed; left: 50%; bottom: 36px; z-index: 2147483640; transform: translateX(-50%);
        max-width: 720px; padding: 12px 16px; color: #fff; background: #382630;
        border: 1px solid #824663; border-radius: 10px; box-shadow: 0 15px 40px rgba(0,0,0,.7);
      }
      .mds-hidden { display: none !important; }
      @media (max-width: 850px) {
        .mds-group-row { grid-template-columns: 1fr; }
        .mds-search { grid-template-columns: 1fr 1fr; }
        .mds-search button { grid-column: 1 / -1; }
      }
    `;
    document.head.append(style);
}

function showToast(message) {
    document.querySelector(".mds-toast")?.remove();
    const toast = createElement("div", "mds-toast", message);
    document.body.append(toast);
    setTimeout(() => toast.remove(), 4500);
}

function findWelcomePanel() {
    const heading = [...document.querySelectorAll("h1, h2, h3, p, div, span")]
        .find(element => (element.textContent || "").trim() === "사용할 디스크 모드를 선택하세요");
    if (!heading)
        return null;
    let candidate = heading.parentElement;
    while (candidate && candidate !== document.body) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width > 750 && rect.height > 500)
            return candidate;
        candidate = candidate.parentElement;
    }
    return heading.parentElement;
}

function positionLauncher(launcher, panel) {
    const rect = panel.getBoundingClientRect();
    const heading = [...document.querySelectorAll("h1, h2, h3, p, div, span")]
        .find(element => (element.textContent || "").trim() === "사용할 디스크 모드를 선택하세요");
    const hiMDCard = [...document.querySelectorAll("a, button, [role='button']")]
        .filter(element => {
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        const bounds = element.getBoundingClientRect();
        return text.includes("Hi-MD로 연결") && bounds.width > 220 && bounds.height > 180;
    })
        .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (aRect.width * aRect.height) - (bRect.width * bRect.height);
    })[0];
    const cardRect = hiMDCard?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    const launcherSize = launcher.offsetWidth || 82;
    launcher.style.left = cardRect
        ? `${cardRect.right - launcherSize}px`
        : `${Math.max(rect.left + 24, rect.right - 245)}px`;
    launcher.style.top = headingRect
        ? `${headingRect.top + (headingRect.height - launcherSize) / 2}px`
        : `${Math.max(rect.top + 34, 72)}px`;
}

function createLauncher() {
    console.info("[MD Squirrel] Home launcher created");
    const launcher = createElement("button");
    launcher.id = "md-squirrel-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "MD Squirrel 열기");
    const label = createElement("span", "mds-launcher-label", "MD Squirrel");
    const tooltip = createElement("span", "mds-launcher-tooltip");
    tooltip.append(
        createElement("span", "", "한글 음원의 영문 제목을 찾아"),
        document.createElement("br"),
        createElement("span", "", "MiniDisc용 복사본을 만들어 드립니다!"),
    );
    const iconFrame = createElement("span", "mds-icon-frame");
    const image = document.createElement("img");
    image.src = "sandbox://assets/md-squirrel.png";
    image.alt = "";
    const fallback = createElement("span", "mds-fallback", "🐿️");
    image.addEventListener("error", () => {
        image.style.display = "none";
        fallback.style.display = "grid";
    });
    iconFrame.append(image, fallback);
    launcher.append(label, iconFrame, tooltip);
    launcher.addEventListener("click", openModal);
    document.body.append(launcher);
    return launcher;
}

function refreshLauncher() {
    if (!document.body)
        return;
    const pageText = document.body.innerText || document.body.textContent || "";
    const isWelcomeScreen =
        pageText.includes("사용할 디스크 모드를 선택하세요") ||
        /select (?:a )?disc mode/i.test(pageText) ||
        (pageText.includes("NetMD로 연결") && pageText.includes("Hi-MD로 연결"));
    const panel = findWelcomePanel();
    let launcher = document.getElementById("md-squirrel-launcher");
    if (!isWelcomeScreen || document.getElementById("md-squirrel-overlay")) {
        if (launcher)
            launcher.style.display = "none";
        return;
    }
    if (!launcher)
        launcher = createLauncher();
    launcher.style.display = "block";
    if (panel) {
        positionLauncher(launcher, panel);
    }
    else {
        launcher.style.left = "auto";
        launcher.style.right = "clamp(96px, 16vw, 220px)";
        launcher.style.top = "96px";
    }
}

function mostCommon(values) {
    const counts = new Map();
    for (const value of values.map(item => String(item || "").trim()).filter(Boolean))
        counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function buildAlbumGroups(tracks) {
    const groups = new Map();
    tracks.forEach((track, index) => {
        const album = String(track.album || "").trim();
        const sourceParts = String(track.sourcePath || "").split(/[\\/]/).filter(Boolean);
        const parentFolder = sourceParts.length > 1 ? sourceParts[sourceParts.length - 2] : "앨범 태그 없음";
        const key = album
            ? `album:${album.toLocaleLowerCase()}`
            : `folder:${parentFolder.toLocaleLowerCase()}`;
        if (!groups.has(key))
            groups.set(key, { key, album: album || "", fallbackName: parentFolder, indices: [] });
        groups.get(key).indices.push(index);
    });
    return [...groups.values()].map(group => {
        const groupTracks = group.indices.map(index => tracks[index]);
        const artist = mostCommon(groupTracks.map(track => track.albumArtist || track.artist));
        return {
            ...group,
            artist,
            label: `${artist || "아티스트 미상"} — ${group.album || `${group.fallbackName} (앨범 태그 없음)`}`,
        };
    }).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
}

function getActiveGroup() {
    return state.albumGroups.find(group => group.key === state.activeAlbumKey) || state.albumGroups[0] || null;
}

function getActiveTrackIndices() {
    const group = getActiveGroup();
    return (group?.indices || state.tracks.map((_, index) => index)).slice().sort((left, right) => {
        const a = state.tracks[left];
        const b = state.tracks[right];
        return (Number(a.discNumber || 1) - Number(b.discNumber || 1)) ||
            (Number(a.trackNumber || 0) - Number(b.trackNumber || 0)) ||
            String(a.filename).localeCompare(String(b.filename), undefined, { numeric: true, sensitivity: "base" });
    });
}

function normalizeComparableTitle(value) {
    return String(value || "")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/\([^)]*\)|（[^）]*）|\[[^\]]*\]|【[^】]*】/g, " ")
        .replace(/[^\p{L}\p{N}]+/gu, "")
        .trim();
}

function hasEastAsianText(value) {
    return /[가-힣ㄱ-ㅎㅏ-ㅣぁ-ゟ゠-ヿ一-龯]/u.test(String(value || ""));
}

function isMostlyNonEnglishTrackList(details) {
    if (details.script && details.script !== "Latn" && details.language !== "eng")
        return true;
    const titles = (details.tracks || []).map(track => String(track.title || "")).filter(Boolean);
    if (!titles.length)
        return false;
    const nonEnglishOnly = titles.filter(title =>
        /[가-힣ぁ-ゟ゠-ヿ一-龯]/u.test(title) && !/[A-Za-z]/.test(title)).length;
    return nonEnglishOnly > titles.length / 2;
}

function matchReleaseTrack(track, releaseTracks, fallbackIndex, canUsePosition) {
    const trackNumber = Number(track.trackNumber);
    const discNumber = Number(track.discNumber || 1);
    if (track.trackNumberFromTag && Number.isFinite(trackNumber)) {
        const numbered = releaseTracks.find(candidate =>
            Number(candidate.number || candidate.position) === trackNumber &&
            Number(candidate.discNumber || 1) === discNumber);
        if (numbered)
            return numbered;
    }
    const normalizedTitle = normalizeComparableTitle(track.title);
    if (normalizedTitle) {
        const titled = releaseTracks.find(candidate =>
            normalizeComparableTitle(candidate.title) === normalizedTitle);
        if (titled)
            return titled;
    }
    return canUsePosition ? releaseTracks[fallbackIndex] : null;
}

function renderAlbumGroups(modal) {
    const tabs = modal.querySelector(".mds-album-tabs");
    tabs.replaceChildren();
    state.albumGroups.forEach(group => {
        const button = createElement("button", "mds-album-tab", `${group.album || group.fallbackName} · ${group.indices.length}곡`);
        button.type = "button";
        button.title = group.label;
        button.classList.toggle("active", group.key === state.activeAlbumKey);
        button.addEventListener("click", () => {
            syncTrackEdits(modal);
            state.activeAlbumKey = group.key;
            renderAlbumGroups(modal);
            inferAlbumInfo(modal);
            renderTrackTable(modal);
            modal.querySelector(".mds-results").replaceChildren();
        });
        tabs.append(button);
    });
    const note = modal.querySelector(".mds-group-note");
    note.textContent = state.albumGroups.length > 1
        ? `${state.albumGroups.length}개 앨범 · 선택한 앨범만 검색·적용`
        : "앨범 1개 감지";
}

function renderTrackTable(modal) {
    const body = modal.querySelector(".mds-track-body");
    body.replaceChildren();
    state.tracks.forEach((track, index) => {
        const row = document.createElement("tr");
        row.append(createElement("td", "", String(track.trackNumber || index + 1)));
        const original = document.createElement("td");
        original.title = track.filename;
        original.append(
            createElement("span", "mds-track-original", track.title),
            createElement("span", "mds-track-album",
                `${track.album || "앨범 태그 없음"}${track.appleMatchNote ? ` · ${track.appleMatchNote}` : ""}`),
        );
        row.append(original);
        const titleCell = document.createElement("td");
        const titleInput = createElement("input", "mds-input mds-title-edit");
        titleInput.value = track.englishTitle;
        titleInput.dataset.index = String(index);
        titleCell.append(titleInput);
        const showCandidateSelect = track.appleNeedsChoice && track.appleCandidates?.length;
        const hasRemainingAsianText =
            hasEastAsianText(track.englishTitle) || hasEastAsianText(track.englishArtist);
        const showWebSearch = track.appleSearchAttempted &&
            (track.appleNeedsChoice || !track.appleCandidates?.length || hasRemainingAsianText);
        if (showCandidateSelect || showWebSearch) {
            const candidateTools = createElement("div", "mds-candidate-tools");
            titleCell.append(candidateTools);
        }
        if (showCandidateSelect) {
            const candidateTools = titleCell.querySelector(".mds-candidate-tools");
            const candidateSelect = createElement("select", "mds-candidate-select");
            const placeholder = createElement("option", "", `후보 ${track.appleCandidates.length}개 — 직접 선택`);
            placeholder.value = "";
            candidateSelect.append(placeholder);
            track.appleCandidates.forEach((candidate, candidateIndex) => {
                const difference = candidate.durationDiff === null ? "시간 미상" : `${candidate.durationDiff}초 차이`;
                const option = createElement("option", "",
                    `${candidate.title} — ${candidate.artist} · ${difference}`);
                option.value = String(candidateIndex);
                candidateSelect.append(option);
            });
            candidateSelect.addEventListener("change", () => {
                if (candidateSelect.value === "")
                    return;
                const candidate = track.appleCandidates[Number(candidateSelect.value)];
                track.englishTitle = candidate.title || track.englishTitle;
                track.englishArtist = track.canonicalArtist || candidate.artist || track.englishArtist;
                track.englishAlbum = candidate.album || track.englishAlbum;
                track.appleMatchNote =
                    hasEastAsianText(track.englishTitle) || hasEastAsianText(track.englishArtist)
                        ? "사용자 선택 후보에 한글·일본어·한자 포함 · 확인 필요"
                        : "Apple 영문 후보 · 사용자 선택";
                track.appleNeedsChoice = false;
                renderTrackTable(modal);
            });
            candidateTools.append(candidateSelect);
        }
        if (showWebSearch) {
            const candidateTools = titleCell.querySelector(".mds-candidate-tools");
            const webSearch = createElement("button", "mds-web-search", "🌐 웹에서 직접 찾기");
            webSearch.type = "button";
            webSearch.title = `${track.title} ${track.albumArtist || track.artist || ""} 영어 제목`;
            webSearch.addEventListener("click", () => {
                void ipcRenderer.invoke("mdSquirrelOpenWebSearch", {
                    title: track.title,
                    artist: track.canonicalArtist || track.albumArtist || track.artist || "",
                }).catch(error => showToast(`웹 검색을 열지 못했습니다: ${error.message}`));
            });
            candidateTools.append(webSearch);
        }
        row.append(titleCell);
        const artistCell = document.createElement("td");
        const artistInput = createElement("input", "mds-input mds-artist-edit");
        artistInput.value = track.englishArtist;
        artistInput.dataset.index = String(index);
        artistCell.append(artistInput);
        row.append(artistCell);
        body.append(row);
    });
    modal.querySelector(".mds-track-count").textContent =
        `${state.tracks.length}곡 · ${state.albumGroups.length}개 앨범`;
}

function syncTrackEdits(modal) {
    modal.querySelectorAll(".mds-title-edit").forEach(input => {
        state.tracks[Number(input.dataset.index)].englishTitle = input.value.trim();
    });
    modal.querySelectorAll(".mds-artist-edit").forEach(input => {
        state.tracks[Number(input.dataset.index)].englishArtist = input.value.trim();
    });
}

function inferAlbumInfo(modal) {
    const group = getActiveGroup();
    const groupTracks = (group?.indices || []).map(index => state.tracks[index]);
    modal.querySelector(".mds-artist-query").value =
        group?.artist ||
        groupTracks.find(track => track.albumArtist)?.albumArtist ||
        groupTracks.find(track => track.artist)?.artist || "";
    modal.querySelector(".mds-album-query").value =
        group?.album ||
        groupTracks.find(track => track.album)?.album || "";
}

async function chooseFolder(modal, button) {
    setBusy(button, true, "음원 읽는 중…");
    try {
        const folder = await ipcRenderer.invoke("mdSquirrelSelectFolder");
        if (!folder)
            return;
        const tracks = await ipcRenderer.invoke("mdSquirrelScanFolder", folder);
        if (!tracks.length) {
            showToast("선택한 폴더에서 지원하는 음원 파일을 찾지 못했습니다.");
            return;
        }
        state.folder = folder;
        state.tracks = tracks;
        state.albumGroups = buildAlbumGroups(tracks);
        state.activeAlbumKey = state.albumGroups[0]?.key || "";
        state.outputFolder = "";
        modal.querySelector(".mds-start").classList.add("mds-hidden");
        modal.querySelector(".mds-workspace").classList.remove("mds-hidden");
        modal.querySelector(".mds-header-folder").classList.remove("mds-hidden");
        const folderPath = modal.querySelector(".mds-folder-path");
        folderPath.textContent = folder;
        folderPath.title = folder;
        renderTrackTable(modal);
        const generate = modal.querySelector(".mds-generate");
        generate.classList.remove("mds-hidden");
        generate.textContent = "영문 복사본 만들기";
        generate.dataset.originalText = "영문 복사본 만들기";
    }
    catch (error) {
        showToast(`폴더를 읽지 못했습니다: ${error.message}`);
    }
    finally {
        setBusy(button, false);
    }
}

async function searchMusicBrainz(modal, button) {
    const artist = modal.querySelector(".mds-artist-query").value.trim();
    const album = modal.querySelector(".mds-album-query").value.trim();
    if (!artist && !album) {
        showToast("아티스트나 앨범 이름을 입력해 주세요.");
        return;
    }
    const resultsRoot = modal.querySelector(".mds-results");
    setBusy(button, true, "검색 중…");
    resultsRoot.replaceChildren(createElement("span", "", "MusicBrainz에서 앨범을 찾고 있습니다…"));
    try {
        const releases = await ipcRenderer.invoke("mdSquirrelSearchReleases", { artist, album });
        resultsRoot.replaceChildren();
        if (!releases.length) {
            resultsRoot.append(createElement("span", "",
                "등록된 영문 앨범판이 없습니다. 위의 ‘전체 곡 개별 검색’을 이용해 보세요."));
            return;
        }
        releases.forEach(release => {
            const item = createElement("div", "mds-release");
            const info = document.createElement("div");
            const edition = release.script === "Latn" || release.language === "eng"
                ? "영문판"
                : (release.country || "국가 미상");
            info.append(
                createElement("strong", "", release.title),
                createElement("span", "", `${release.artist} · ${release.date || "연도 미상"} · ${edition} · ${release.trackCount}곡 · 일치도 ${release.score}%`),
            );
            const apply = createElement("button", "mds-button", "이 정보 적용");
            apply.addEventListener("click", async () => {
                setBusy(apply, true, "불러오는 중…");
                try {
                    const details = await ipcRenderer.invoke("mdSquirrelGetReleaseTracks", release.id);
                    if (isMostlyNonEnglishTrackList(details)) {
                        showToast("이 판본은 한글·일본어 제목이 대부분이라 적용하지 않았습니다. 영문판을 선택해 주세요.");
                        return;
                    }
                    const activeIndices = getActiveTrackIndices();
                    const canUsePosition = activeIndices.length === details.tracks.length;
                    let count = 0;
                    for (let index = 0; index < activeIndices.length; index += 1) {
                        const track = state.tracks[activeIndices[index]];
                        const matched = matchReleaseTrack(track, details.tracks, index, canUsePosition);
                        if (!matched)
                            continue;
                        track.englishTitle = matched.title || track.englishTitle;
                        track.englishArtist = matched.artist || details.artist || track.englishArtist;
                        track.englishAlbum = details.title || track.englishAlbum;
                        count += 1;
                    }
                    renderTrackTable(modal);
                    showToast(count === activeIndices.length
                        ? `${count}곡에 MusicBrainz 정보를 적용했습니다. 제목을 확인해 주세요.`
                        : `${count}/${activeIndices.length}곡을 정확히 연결했습니다. 나머지는 제목을 직접 확인해 주세요.`);
                }
                catch (error) {
                    showToast(`앨범 정보를 불러오지 못했습니다: ${error.message}`);
                }
                finally {
                    setBusy(apply, false);
                }
            });
            item.append(info, apply);
            resultsRoot.append(item);
        });
    }
    catch (error) {
        resultsRoot.replaceChildren();
        showToast(`앨범 검색에 실패했습니다: ${error.message}`);
    }
    finally {
        setBusy(button, false);
    }
}

async function searchIndividualTracks(modal, button) {
    if (!state.tracks.length)
        return;
    syncTrackEdits(modal);
    setBusy(button, true, `${state.tracks.length}곡 검색 중…`);
    try {
        const matches = await ipcRenderer.invoke("mdSquirrelSearchITunesTracks",
            state.tracks.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                albumArtist: track.albumArtist,
                album: track.album,
                duration: track.duration,
            })));
        let applied = 0;
        let skipped = 0;
        let preserved = 0;
        matches.forEach(result => {
            const track = state.tracks.find(item => item.id === result.id);
            if (track && result.canonicalArtist) {
                track.canonicalArtist = result.canonicalArtist;
                track.englishArtist = result.canonicalArtist;
            }
            if (track && result.preserved) {
                track.appleCandidates = [];
                track.appleNeedsChoice = false;
                track.appleSearchAttempted = false;
                track.appleMatchNote = "영문·로마자 제목 유지";
                preserved += 1;
                return;
            }
            const match = result.match;
            if (track) {
                track.appleCandidates = result.candidates || [];
                track.appleNeedsChoice = false;
                track.appleSearchAttempted = true;
            }
            if (!track || !match) {
                if (track)
                    track.appleMatchNote = "영문 후보 없음 · 직접 입력 필요";
                skipped += 1;
                return;
            }
            if (match.durationDiff !== null && match.durationDiff > 20) {
                track.appleMatchNote = `후보 선택 필요 · 재생시간 ${match.durationDiff}초 차이`;
                track.appleNeedsChoice = Boolean(track.appleCandidates.length);
                skipped += 1;
                return;
            }
            track.englishTitle = match.title || track.englishTitle;
            track.englishArtist = result.canonicalArtist || match.artist || track.englishArtist;
            track.englishAlbum = match.album || track.englishAlbum;
            const hasRemainingAsianText =
                hasEastAsianText(track.englishTitle) || hasEastAsianText(track.englishArtist);
            track.appleMatchNote = hasRemainingAsianText
                ? "영문 후보에 한글·일본어·한자 포함 · 확인 필요"
                : (match.durationDiff === null
                    ? "Apple 영문 후보 · 시간 확인 필요"
                    : `Apple 영문 후보 · 시간 차 ${match.durationDiff}초`);
            track.appleNeedsChoice = false;
            applied += 1;
        });
        renderTrackTable(modal);
        showToast(skipped
            ? `${applied}곡 적용 · ${preserved}곡 원문 유지 · ${skipped}곡은 찾지 못했거나 시간이 달라 보류했습니다.`
            : `${applied}곡 적용 · ${preserved}곡은 기존 영문·로마자 제목을 유지했습니다. 제목을 확인해 주세요.`);
    }
    catch (error) {
        showToast(`곡별 영문 검색에 실패했습니다: ${error.message}`);
    }
    finally {
        setBusy(button, false);
    }
}

async function generateCopies(modal, button) {
    syncTrackEdits(modal);
    if (state.tracks.some(track => !track.englishTitle)) {
        showToast("비어 있는 영문 제목이 있습니다.");
        return;
    }
    const progress = modal.querySelector(".mds-progress");
    setBusy(button, true, "복사본 만드는 중…");
    progress.classList.add("visible");
    try {
        const result = await ipcRenderer.invoke("mdSquirrelCreateCopies", {
            sourceFolder: state.folder,
            tracks: state.tracks,
        });
        state.outputFolder = result.outputFolder;
        const warnings = result.results.filter(item => item.warning);
        showToast(warnings.length
            ? `${result.results.length}곡 완료 · ${warnings.length}곡은 파일명만 변경했습니다.`
            : `${result.results.length}곡의 영문 복사본을 만들었습니다.`);
        button.textContent = "완성 폴더 열기";
        button.dataset.originalText = "완성 폴더 열기";
    }
    catch (error) {
        showToast(`복사본 생성에 실패했습니다: ${error.message}`);
    }
    finally {
        progress.classList.remove("visible");
        setBusy(button, false);
    }
}

function createModal() {
    const overlay = createElement("div");
    overlay.id = "md-squirrel-overlay";
    overlay.innerHTML = `
      <section class="mds-modal" role="dialog" aria-modal="true" aria-label="MD Squirrel">
        <header class="mds-header">
          <div class="mds-brand">
            <img src="sandbox://assets/md-squirrel.png" alt="">
            <div><h2>MD Squirrel</h2><p>MiniDisc용 영문 음원 복사본 제작 도우미</p></div>
          </div>
          <div class="mds-header-folder mds-hidden">
            <div class="mds-folderinfo"><span>선택 폴더</span><strong class="mds-folder-path"></strong></div>
            <button class="mds-button ghost mds-select-again" type="button">폴더 변경</button>
          </div>
          <div class="mds-header-actions">
            <div class="mds-progress">
              <div class="mds-progress-track"><div class="mds-progress-bar"></div></div>
              <span class="mds-progress-text"></span>
            </div>
            <button class="mds-button ghost mds-generate mds-hidden" type="button">영문 복사본 만들기</button>
            <button class="mds-close" type="button" aria-label="닫기">×</button>
          </div>
        </header>
        <div class="mds-body">
          <section class="mds-start mds-card">
            <div class="mds-start-inner">
              <span class="mds-safe">원본 음원은 그대로 안전하게</span>
              <h3>음원 폴더를 골라 주세요</h3>
              <p>파일명과 태그를 읽고 영문 제목 후보를 찾은 뒤, 원본 옆에 <strong>[English]</strong> 폴더를 새로 만듭니다.</p>
              <button class="mds-button primary mds-select-first" type="button">폴더 선택</button>
            </div>
          </section>
          <section class="mds-workspace mds-hidden">
            <div class="mds-card">
              <div class="mds-heading">
                <h3>1. 영문 제목 확인 및 수정</h3>
                <div class="mds-heading-actions">
                  <span class="mds-track-count"></span>
                  <button class="mds-button primary mds-track-search" type="button">🔎 전체 곡 영문 제목 찾기</button>
                </div>
              </div>
              <div class="mds-table-wrap">
                <table class="mds-table">
                  <thead><tr><th>#</th><th>원래 제목</th><th>영문 제목</th><th>아티스트</th></tr></thead>
                  <tbody class="mds-track-body"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </section>
    `;
    const modal = overlay.querySelector(".mds-modal");
    const close = () => {
        overlay.remove();
        refreshLauncher();
    };
    modal.querySelector(".mds-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", event => {
        if (event.target === overlay)
            close();
    });
    document.addEventListener("keydown", function onKeydown(event) {
        if (event.key === "Escape" && document.body.contains(overlay)) {
            close();
            document.removeEventListener("keydown", onKeydown);
        }
    });
    modal.querySelector(".mds-select-first").addEventListener("click", event => chooseFolder(modal, event.currentTarget));
    modal.querySelector(".mds-select-again").addEventListener("click", event => chooseFolder(modal, event.currentTarget));
    modal.querySelector(".mds-track-search").addEventListener("click", event => searchIndividualTracks(modal, event.currentTarget));
    const generate = modal.querySelector(".mds-generate");
    generate.addEventListener("click", () => {
        if (state.outputFolder)
            void ipcRenderer.invoke("mdSquirrelOpenPath", state.outputFolder);
        else
            void generateCopies(modal, generate);
    });
    return overlay;
}

function openModal() {
    if (document.getElementById("md-squirrel-overlay"))
        return;
    state.folder = "";
    state.tracks = [];
    state.albumGroups = [];
    state.activeAlbumKey = "";
    state.outputFolder = "";
    document.getElementById("md-squirrel-launcher")?.style.setProperty("display", "none");
    document.body.append(createModal());
}

function install() {
    console.info("[MD Squirrel] Preload UI installed");
    const start = () => {
        installStyles();
        refreshLauncher();
        let pending = false;
        const observer = new MutationObserver(() => {
            if (pending)
                return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                refreshLauncher();
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        window.addEventListener("resize", refreshLauncher);
    };
    let started = false;
    const startWhenReady = () => {
        if (started)
            return;
        if (!document.body || !document.head) {
            setTimeout(startWhenReady, 20);
            return;
        }
        started = true;
        start();
    };
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", startWhenReady, { once: true });
    // A long-running async preload can resume just after DOMContentLoaded while
    // readyState still reports "loading" in Electron. Always schedule a second
    // idempotent start so the launcher cannot miss that event.
    setTimeout(startWhenReady, 0);
    ipcRenderer.on("mdSquirrelGenerateProgress", (_, progress) => {
        const modal = document.querySelector(".mds-modal");
        if (!modal)
            return;
        modal.querySelector(".mds-progress-bar").style.width = `${Math.round((progress.current / progress.total) * 100)}%`;
        modal.querySelector(".mds-progress-text").textContent = `${progress.current}/${progress.total} · ${progress.filename}`;
    });
}

module.exports = { install };
