Unicode True
SetCompressor /SOLID lzma
SetCompressorDictSize 32

!ifndef PRODUCT_VERSION
  !error "PRODUCT_VERSION is required"
!endif
!ifndef PAYLOAD_DIR
  !error "PAYLOAD_DIR is required"
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE is required"
!endif
!ifndef APP_ICON
  !error "APP_ICON is required"
!endif

Name "CDAC VCU Fault Analyser"
Caption "CDAC VCU Fault Analyser ${PRODUCT_VERSION} Setup"
BrandingText "Developed by ELS/ED"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\cdac-vcu-fault-analyser"
RequestExecutionLevel user
Icon "${APP_ICON}"
UninstallIcon "${APP_ICON}"
ShowInstDetails nevershow
AutoCloseWindow true

VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "CDAC VCU Fault Analyser"
VIAddVersionKey /LANG=1033 "CompanyName" "ELS/ED"
VIAddVersionKey /LANG=1033 "FileDescription" "CDAC VCU Fault Analyser Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "ELS/ED"

Page instfiles
UninstPage instfiles

Section "Install"
  SetShellVarContext current

  IfFileExists "$INSTDIR\CDAC VCU Fault Analyser.exe" 0 remove_previous
    ClearErrors
    FileOpen $0 "$INSTDIR\CDAC VCU Fault Analyser.exe" a
    IfErrors 0 +3
      MessageBox MB_ICONSTOP "Close CDAC VCU Fault Analyser, then run this setup again."
      Abort
    FileClose $0

  remove_previous:
  ClearErrors
  RMDir /r "$INSTDIR"
  IfErrors 0 +3
    MessageBox MB_ICONSTOP "Close CDAC VCU Fault Analyser, then run this setup again."
    Abort
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
!ifndef TEST_MODE
  CreateShortCut "$DESKTOP\CDAC VCU Fault Analyser.lnk" "$INSTDIR\CDAC VCU Fault Analyser.exe"
  CreateShortCut "$SMPROGRAMS\CDAC VCU Fault Analyser.lnk" "$INSTDIR\CDAC VCU Fault Analyser.exe"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CDAC VCU Fault Analyser"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "DisplayName" "CDAC VCU Fault Analyser"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "Publisher" "ELS/ED"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "DisplayIcon" "$INSTDIR\CDAC VCU Fault Analyser.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "EstimatedSize" 2600
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded" "NoRepair" 1

  IfSilent +2
  Exec '"$INSTDIR\CDAC VCU Fault Analyser.exe"'
!endif
SectionEnd

Section "Uninstall"
  SetShellVarContext current

  IfFileExists "$INSTDIR\CDAC VCU Fault Analyser.exe" 0 uninstall_remove
    ClearErrors
    FileOpen $0 "$INSTDIR\CDAC VCU Fault Analyser.exe" a
    IfErrors 0 +3
      MessageBox MB_ICONSTOP "Close CDAC VCU Fault Analyser, then uninstall it again."
      Abort
    FileClose $0

  uninstall_remove:
  ClearErrors
  RMDir /r "$INSTDIR"
  IfErrors 0 uninstall_metadata
    MessageBox MB_ICONSTOP "Some application files could not be removed. Close the analyser, then uninstall it again."
    Abort

  uninstall_metadata:
!ifndef TEST_MODE
  Delete "$DESKTOP\CDAC VCU Fault Analyser.lnk"
  Delete "$SMPROGRAMS\CDAC VCU Fault Analyser.lnk"
  Delete "$SMPROGRAMS\CDAC VCU Fault Analyser\CDAC VCU Fault Analyser.lnk"
  Delete "$SMPROGRAMS\CDAC VCU Fault Analyser\Uninstall.lnk"
  RMDir "$SMPROGRAMS\CDAC VCU Fault Analyser"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\486fdb98-f44c-5363-9132-f136cc44bded"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CDAC VCU Fault Analyser"
!endif
SectionEnd
