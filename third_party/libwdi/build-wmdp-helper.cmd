@echo off
setlocal

set "SRC=%~dp0"
set "TOOLCHAIN=%SRC%..\portable-msvc\msvc"
set "OUT=%SRC%build-x64"
set "HELPER_OUT=%SRC%x64\Release\helper"

if not defined VSCMD_VER (
  if not exist "%TOOLCHAIN%\setup_x64.bat" (
    echo Visual Studio C++ build tools were not found.
    echo Run this script from an x64 Native Tools Command Prompt,
    echo or provide ..\portable-msvc\msvc\setup_x64.bat.
    exit /b 1
  )
  call "%TOOLCHAIN%\setup_x64.bat"
  if errorlevel 1 exit /b %errorlevel%
)

if not exist "%OUT%" mkdir "%OUT%"
if not exist "%HELPER_OUT%" mkdir "%HELPER_OUT%"

cl /nologo /c /O1 /MT /TC /D_CRT_SECURE_NO_WARNINGS /D_WIN64 ^
  /I"%SRC%msvc" /Fo"%OUT%\installer.obj" "%SRC%libwdi\installer.c"
if errorlevel 1 exit /b %errorlevel%

link /nologo /out:"%HELPER_OUT%\installer_x64.exe" /subsystem:console /machine:x64 ^
  "%OUT%\installer.obj" newdev.lib setupapi.lib advapi32.lib ole32.lib
if errorlevel 1 exit /b %errorlevel%

cl /nologo /c /O2 /MT /TC /D_CRT_SECURE_NO_WARNINGS /D_WIN64 ^
  /I"%SRC%msvc" /I"%SRC%libwdi" /Fo"%OUT%\embedder.obj" "%SRC%libwdi\embedder.c"
if errorlevel 1 exit /b %errorlevel%

link /nologo /out:"%SRC%libwdi\embedder.exe" /subsystem:console /machine:x64 ^
  "%OUT%\embedder.obj"
if errorlevel 1 exit /b %errorlevel%

pushd "%SRC%libwdi"
embedder.exe embedded.h
set "EMBED_RESULT=%errorlevel%"
popd
if not "%EMBED_RESULT%"=="0" exit /b %EMBED_RESULT%

for %%F in (libwdi libwdi_dlg logging pki tokenizer vid_data) do (
  cl /nologo /c /O1 /MT /TC /D_WIN32 /D_WIN64 /D_LIB /D_WINDLL ^
    /D_CRT_SECURE_NO_WARNINGS /I"%SRC%msvc" /I"%SRC%libwdi" ^
    /Fo"%OUT%\%%F.obj" "%SRC%libwdi\%%F.c"
  if errorlevel 1 exit /b 1
)

lib /nologo /out:"%OUT%\libwdi.lib" ^
  "%OUT%\libwdi.obj" "%OUT%\libwdi_dlg.obj" "%OUT%\logging.obj" ^
  "%OUT%\pki.obj" "%OUT%\tokenizer.obj" "%OUT%\vid_data.obj"
if errorlevel 1 exit /b %errorlevel%

cl /nologo /c /O1 /MT /TC /D_CRT_SECURE_NO_WARNINGS /DHAVE_STRING_H=1 ^
  /I"%SRC%examples\getopt" /Fo"%OUT%\getopt.obj" "%SRC%examples\getopt\getopt.c"
if errorlevel 1 exit /b %errorlevel%

cl /nologo /c /O1 /MT /TC /D_CRT_SECURE_NO_WARNINGS /DHAVE_STRING_H=1 ^
  /I"%SRC%examples\getopt" /Fo"%OUT%\getopt1.obj" "%SRC%examples\getopt\getopt1.c"
if errorlevel 1 exit /b %errorlevel%

cl /nologo /c /O1 /MT /TC /D_CRT_SECURE_NO_WARNINGS /D_WIN32 /D_WIN64 ^
  /I"%SRC%msvc" /I"%SRC%libwdi" /I"%SRC%examples\getopt" ^
  /Fo"%OUT%\wdi-simple.obj" "%SRC%examples\wdi-simple.c"
if errorlevel 1 exit /b %errorlevel%

rc /nologo /fo "%OUT%\wdi-simple.res" "%SRC%examples\wdi-simple.rc"
if errorlevel 1 exit /b %errorlevel%

link /nologo /out:"%OUT%\wmdp-driver-helper.exe" /subsystem:console /machine:x64 ^
  "%OUT%\wdi-simple.obj" "%OUT%\getopt.obj" "%OUT%\getopt1.obj" "%OUT%\libwdi.lib" ^
  "%OUT%\wdi-simple.res" setupapi.lib newdev.lib ntdll.lib advapi32.lib ^
  user32.lib shell32.lib ole32.lib crypt32.lib
if errorlevel 1 exit /b %errorlevel%

mt /nologo -manifest "%SRC%examples\common_controls_and_elevation.manifest" ^
  -outputresource:"%OUT%\wmdp-driver-helper.exe";#1
if errorlevel 1 exit /b %errorlevel%

echo Built: %OUT%\wmdp-driver-helper.exe
