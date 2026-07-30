# Code signing policy

Free code signing provided by
[SignPath.io](https://signpath.io/), certificate by
[SignPath Foundation](https://signpath.org/).

## Team roles

- Committer and reviewer: [run240](https://github.com/run240)
- Signing-request approver: [run240](https://github.com/run240)

Changes from outside contributors must be reviewed before they are merged.
Production signing requests require manual approval by the signing-request
approver.

## Build and release origin

Release candidates are built from this public repository by GitHub-hosted
GitHub Actions runners. The SignPath GitHub connector verifies the workflow
origin before a signing request is accepted. Release binaries are not built or
uploaded from a maintainer workstation.

Only project-owned binaries are submitted for signing. Unsigned upstream
open-source libraries may be included in the application without being signed
by this project's certificate.

## Privacy

This program will not transfer any information to other networked systems
unless specifically requested by the user or the person installing or
operating it.

Device information used for NetMD and Hi-MD operation is processed locally.
The project does not operate a telemetry or analytics service.

## Windows system changes

The optional WinUSB helper changes the selected MiniDisc device's Windows
driver only after an explicit user action and a Windows elevation prompt.
Users should back up important recordings before testing.

To remove the application, delete its extracted application directory. To undo
the optional WinUSB driver change, use Windows Device Manager to uninstall the
device/driver and then reconnect the device so Windows can select another
available driver.
