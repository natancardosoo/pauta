' Pauta - gera a versao final e sobe o servidor em segundo plano (sem janela do CMD), depois abre o navegador.
' Uso: iniciar.vbs /fundo  -> inicia sem abrir o navegador (atalho da inicializacao do Windows).
' Para encerrar: parar.vbs. O registro do servidor fica em data\pauta.log.
Option Explicit
Dim sh, fso, dir, logFile, url, i, fundo
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
url = "http://127.0.0.1:4321"
fundo = (WScript.Arguments.Count > 0)
If fundo Then fundo = (LCase(WScript.Arguments(0)) = "/fundo")

' Ja esta no ar? So abre o navegador.
If Online() Then
  If Not fundo Then sh.Run url
  WScript.Quit
End If

If sh.Run("cmd /c where node >nul 2>nul", 0, True) <> 0 Then
  Avisar "Node.js nao encontrado. Instale o Node.js em https://nodejs.org"
  WScript.Quit 1
End If

' Primeira vez: a instalacao das dependencias aparece numa janela, para voce acompanhar.
If Not fso.FolderExists(dir & "\node_modules") Then
  If sh.Run("cmd /c title Pauta - instalando dependencias && npm install || (pause & exit /b 1)", 1, True) <> 0 Then
    Avisar "Falha ao instalar as dependencias."
    WScript.Quit 1
  End If
End If

If Not fso.FolderExists(dir & "\data") Then fso.CreateFolder dir & "\data"
logFile = dir & "\data\pauta.log"

If sh.Run("cmd /c npm run build > """ & logFile & """ 2>&1", 0, True) <> 0 Then
  Avisar "Falha ao gerar o app. Detalhes em:" & vbCrLf & logFile
  WScript.Quit 1
End If

' Servidor oculto (janela 0), sem esperar terminar.
sh.Run "cmd /c npm run serve >> """ & logFile & """ 2>&1", 0, False

For i = 1 To 60
  WScript.Sleep 1000
  If Online() Then
    If Not fundo Then sh.Run url
    WScript.Quit
  End If
Next
Avisar "O servidor nao respondeu a tempo. Detalhes em:" & vbCrLf & logFile

Function Online()
  Dim h
  On Error Resume Next
  Set h = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  h.setTimeouts 1000, 1000, 1000, 1000
  h.open "GET", url & "/api/health", False
  h.send
  Online = (Err.Number = 0)
  If Online Then Online = (h.status = 200)
  Err.Clear
  On Error GoTo 0
End Function

' Sem janela (inicializacao do Windows): registra o aviso em vez de abrir uma caixa que ninguem ve.
Sub Avisar(msg)
  If Not fundo Then
    MsgBox msg, vbExclamation, "Pauta"
    Exit Sub
  End If
  On Error Resume Next
  If Not fso.FolderExists(dir & "\data") Then fso.CreateFolder dir & "\data"
  Dim f
  Set f = fso.OpenTextFile(dir & "\data\pauta-inicio.log", 8, True)
  f.WriteLine Now & "  " & Replace(msg, vbCrLf, " ")
  f.Close
End Sub
