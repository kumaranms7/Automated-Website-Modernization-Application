; Site Modernizer portable launcher: one file, nothing to install.
; The first start unpacks the app to %LOCALAPPDATA%\Site Modernizer Portable\<build> (with a progress window).
; Every later start only opens it, so it is as quick as the installed app. Your websites and settings are never inside this folder.
; A "ready.txt" file is written last: a start that was cancelled part-way has none, so the next start unpacks again from clean.
; There is one folder per build, so a newer portable file always runs its own code, and the folders of older builds are removed.
; launchers.txt lists the portable files that were started, so the running app can tell when a newer one sits next to them.
Unicode true
!define NAME "Site Modernizer"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
Name "${NAME}"
OutFile "${OUT}"
Icon "${ICON}"
InstallDir "$LOCALAPPDATA\Site Modernizer Portable\${BUILD}"
AutoCloseWindow true
ShowInstDetails show
BrandingText "${NAME} ${VER}"
Page instfiles

!macro RecordLauncher
  CreateDirectory "$LOCALAPPDATA\Site Modernizer Portable"
  FileOpen $9 "$LOCALAPPDATA\Site Modernizer Portable\launchers.txt" a
  FileSeek $9 0 END
  FileWrite $9 "$EXEPATH$\r$\n"
  FileClose $9
!macroend

Function .onInit
  IfFileExists "$INSTDIR\ready.txt" 0 first
    !insertmacro RecordLauncher
    Exec '"$INSTDIR\Site Modernizer.exe"'
    Quit
  first:
FunctionEnd

Section
  DetailPrint "Preparing ${NAME} for its first start. This happens only once, please wait..."
  StrCpy $1 "$LOCALAPPDATA\Site Modernizer Portable"
  FindFirst $2 $3 "$1\*"
  old:
    StrCmp $3 "" oldDone
    StrCmp $3 "." next
    StrCmp $3 ".." next
    StrCmp $3 "${BUILD}" next
    StrCmp $3 "launchers.txt" next
    RMDir /r "$1\$3"
    next:
    FindNext $2 $3
    Goto old
  oldDone:
  FindClose $2
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  FileOpen $0 "$INSTDIR\ready.txt" w
  FileWrite $0 "${BUILD}"
  FileClose $0
  !insertmacro RecordLauncher
  DetailPrint "Starting ${NAME}..."
  Exec '"$INSTDIR\Site Modernizer.exe"'
SectionEnd
