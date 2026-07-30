Windows Custom Build - Modified Source Snapshot
================================================

이 폴더는 배포본에서 직접 수정한 주요 읽을 수 있는 파일의 스냅샷입니다.
실행에 사용되는 실제 파일은 다음 위치에 있습니다.

- preload.js                  -> dist/preload.js
- main.js                     -> dist/main.js
- device-diagnostics.js       -> dist/device-diagnostics.js
- index.html                  -> renderer/index.html
- wmd-modern-theme.css        -> renderer/assets/wmd-modern-theme.css
- index-DdAyCQFX.js           -> renderer/assets/index-DdAyCQFX.js
- netmd.js                    -> dist/wmd/original/services/interfaces/netmd.js

Original source
---------------
ElectronWMD: https://github.com/asivery/ElectronWMD
Revision: a3f30f8ae3bb022aa8aa58776dc7e473c09ad066

Web MiniDisc Pro: https://github.com/asivery/webminidisc
Revision: 30c3045155a1c057171506aaf3ffee64552df679

License
-------
GNU General Public License version 2
See ../LICENSE-GPL-2.0.txt and ../MODIFIED-BUILD-NOTICE.txt.

주의: 실행 파일을 수정한 뒤 배포할 때는 이 폴더의 사본도 다시 갱신해야
실제 배포 파일과 스냅샷이 일치합니다.
