/* config.h.  Manual config for MSVC.  */

#ifndef _MSC_VER
#warn "msvc/config.h shouldn't be included for your development environment."
#error "Please make sure the msvc/ directory is removed from your build path."
#endif

#if defined(_PREFAST_)
/* Disable "Banned API Usage:" errors when using WDK's OACR/Prefast */
#pragma warning(disable:28719)
#endif
#if defined(_MSC_VER)
// Disable some VS2012 Code Analysis warnings
#pragma warning(disable:6258)		// We'll use TerminateThread() regardless
#pragma warning(disable:6387)
#endif

/*
 * Embed WinUSB driver files from the following WDK location.
 * If needed, you can obtain the WDK redistributable components from:
 * https://go.microsoft.com/fwlink/p/?LinkID=253170
 * NB: You must also make sure the WDF_VER, COINSTALLER_DIR and X64_DIR
 * match your WinUSB redist directories.
 */
/* WinUSB is supplied by all Windows versions supported by this application. */

/* WDK WDF coinstaller version */
#define WDF_VER 1011

/* CoInstaller subdirectory for WinUSB redist files ("winusb" or "wdf") */
#define COINSTALLER_DIR "wdf"

/* 64bit subdirectory for WinUSB redist files ("x64" or "amd64") */
#define X64_DIR "x64"

/* embed libusb0 driver files from the following location */

/* embed libusbK driver files from the following location */

/* embed user defined driver files from the following location */
#ifndef USER_DIR
// #define USER_DIR "C:/signed-driver"
#endif

/* 32 bit support */
/* This helper is distributed only with the x64 Windows build. */

/* 64 bit support */
#define OPT_M64

/* ARM64 support */

/* Debug message logging */
//#define ENABLE_DEBUG_LOGGING

/* Debug message logging (toggable) */
#define INCLUDE_DEBUG_LOGGING

/* Message logging */
#define ENABLE_LOGGING 1
