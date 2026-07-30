# Public build and SignPath signing

This repository combines the following open-source components:

- ElectronWMD at `a3f30f8ae3bb022aa8aa58776dc7e473c09ad066`
- Web MiniDisc Pro at `30c3045155a1c057171506aaf3ffee64552df679`
- libwdi 1.5.1, including the modified WinUSB helper source
- the Windows custom-build overrides in `custom-overrides`

The custom overrides are snapshots of the exact generated files used by the
existing V3 release. They are applied after building the two upstream projects,
so the distributed application can be reproduced from this repository. Future
changes should be made in the original TypeScript/React sources where practical.

## Local unsigned build

Prerequisites:

- Windows 11
- Node.js 20
- Visual Studio 2022 Build Tools with Desktop development with C++
- Windows 10 or 11 SDK

From an x64 Native Tools Command Prompt:

```powershell
npm ci --legacy-peer-deps
third_party\libwdi\build-wmdp-helper.cmd
npm run pack:custom
```

The unpacked application is written to `build\win-unpacked`.

## SignPath Foundation

1. Publish this repository publicly with its GPL-2.0 license and submodule.
2. Apply for a free open-source subscription at https://signpath.org/apply.html.
3. Install the SignPath GitHub App for the public repository.
4. In SignPath, create an artifact configuration using
   `signpath-artifact-configuration.xml`.
5. Create repository variables:
   - `SIGNPATH_ORGANIZATION_ID`
   - `SIGNPATH_PROJECT_SLUG`
   - `SIGNPATH_SIGNING_POLICY_SLUG`
   - `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`
6. Create the repository secret `SIGNPATH_API_TOKEN`.
7. Run the `Build Windows and submit to SignPath` workflow.

The workflow always publishes an unsigned build artifact. Once the SignPath
variables and secret are configured, it also submits the build for signing,
verifies the returned signatures, and publishes a signed artifact.

## Signature scope

The SignPath configuration signs the main executable, the WinUSB driver helper,
and top-level Electron DLLs. Native Node modules are third-party PE binaries
with a `.node` extension; confirm their handling with SignPath during project
onboarding. Microsoft recommends signing every executable binary loaded by an
app, so Smart App Control testing must exercise both NetMD and Hi-MD flows.
