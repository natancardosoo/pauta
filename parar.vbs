' Pauta - encerra o servidor que esta rodando em segundo plano (porta 4321).
Option Explicit
Dim sh, rc
Set sh = CreateObject("WScript.Shell")
rc = sh.Run("powershell -NoProfile -ExecutionPolicy Bypass -Command ""$c = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue; if (-not $c) { exit 2 }; $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }""", 0, True)
If rc = 2 Then
  MsgBox "O Pauta nao estava rodando.", vbInformation, "Pauta"
ElseIf rc = 0 Then
  MsgBox "Pauta encerrado.", vbInformation, "Pauta"
Else
  MsgBox "Nao consegui encerrar o Pauta (codigo " & rc & ").", vbExclamation, "Pauta"
End If
