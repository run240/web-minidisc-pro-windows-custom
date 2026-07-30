# Web MiniDisc Pro — Windows Custom Build

An unofficial, non-commercial Windows build of
[ElectronWMD](https://github.com/asivery/ElectronWMD) and
[Web MiniDisc Pro](https://github.com/asivery/webminidisc), focused on
NetMD/Hi-MD device support and an integrated WinUSB installation flow.

> This repository is not an official release of ElectronWMD, Web MiniDisc Pro,
> Sony, or MiniDisc.wiki. Back up important recordings before testing.

## Status

The source and GitHub Actions build pipeline are public. Windows release
binaries will be published after the open-source code-signing setup has been
approved and verified on Windows 11 with Smart App Control enabled.

Free code signing provided by
[SignPath.io](https://signpath.io/), certificate by
[SignPath Foundation](https://signpath.org/).

## Main changes

- Integrated WinUSB helper based on libwdi 1.5.1
- NetMD and Hi-MD connection and mode diagnostics
- Multiple connected-device selection
- Korean UI and filename romanization improvements
- Hi-MD and NetMD temporary metadata editing
- Transfer-stall diagnostics and troubleshooting information
- Windows-focused theme, icons, loading screen, and dialogs

## Source layout

- `src/`: ElectronWMD source
- `webminidisc/`: pinned Web MiniDisc Pro submodule
- `third_party/libwdi/`: complete corresponding source for the WinUSB helper
- `custom-overrides/`: exact V3 generated-file modifications
- `.github/workflows/build-signpath.yml`: Windows build and SignPath submission
- `signpath-artifact-configuration.xml`: Authenticode signing scope

Base revisions:

- ElectronWMD: `a3f30f8ae3bb022aa8aa58776dc7e473c09ad066`
- Web MiniDisc Pro: `30c3045155a1c057171506aaf3ffee64552df679`

The current V3 modifications were originally made against generated output.
They are kept as a transparent build overlay so the existing release can be
reproduced. Future changes should be moved into the TypeScript/React sources
where practical.

## Building on Windows

Requirements:

- Node.js 20
- Visual Studio 2022 Build Tools with Desktop development with C++
- Windows 10 or Windows 11 SDK

From an x64 Native Tools Command Prompt:

```powershell
npm ci
third_party\libwdi\build-wmdp-helper.cmd
npm run pack:custom
```

The unpacked application is written to `build\win-unpacked`.

For the signing workflow and SignPath configuration, see
[PUBLIC-SIGNING.md](PUBLIC-SIGNING.md).

## License and credits

ElectronWMD and Web MiniDisc Pro are distributed under the GNU General Public
License version 2. The embedded WinUSB helper is derived from
[libwdi](https://github.com/pbatard/libwdi), licensed under the GNU Lesser
General Public License version 3 or later.

Original work and contributions belong to Stefano Brilli, Asivery, Pete Batard,
and the respective upstream project contributors.

This software is provided without warranty.
