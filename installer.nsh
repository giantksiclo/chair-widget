!macro customInit
  ; 설치 전 실행 중인 프로세스 종료
  nsExec::ExecToLog 'taskkill /F /IM "Chair Widget.exe"'
!macroend

!macro customInstall
  ; 추가 설치 작업이 필요하면 여기에
!macroend

!macro customUnInstall
  ; 제거 전 실행 중인 프로세스 종료
  nsExec::ExecToLog 'taskkill /F /IM "Chair Widget.exe"'
!macroend
