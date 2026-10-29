; ─── EcoLab · instalador Windows (Inno Setup 6.3+) ───────────────────────────
; No CI a versão é passada por parâmetro:
;   ISCC.exe /DAppVersion=0.2.0 /DAppVersionNumeric=0.2.0 EcoLab_Installer.iss
; Rodando local sem parâmetros, ele lê o arquivo VERSION da raiz.

#define AppName      "EcoLab"
#define AppPublisher "EcoToolBox · UTFPR"
#define AppExeName   "EcoLab.exe"
#define AppURL       "https://github.com/EcoToolBox/EcoLab"

#ifndef AppVersion
  #define VersionFile FileOpen(AddBackslash(SourcePath) + "VERSION")
  #define AppVersion Trim(FileRead(VersionFile))
  #expr FileClose(VersionFile)
#endif
#ifndef AppVersionNumeric
  #define AppVersionNumeric AppVersion
#endif

[Setup]
; NÃO mude o AppId: é ele que faz o Windows reconhecer atualizações
AppId={{B4E2A1C3-9F7D-4A2E-8B1D-3C5E6F7A8B9D}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/issues
AppUpdatesURL={#AppURL}/releases
VersionInfoVersion={#AppVersionNumeric}
VersionInfoProductName={#AppName}
VersionInfoDescription=Instalador do {#AppName}

; Instala só para o usuário atual, sem pedir senha de administrador.
; Quem quiser instalar para todos pode escolher na primeira tela.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableWelcomePage=no
DisableProgramGroupPage=yes
DisableDirPage=auto
DisableReadyPage=yes
AllowNoIcons=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; Fecha o EcoLab automaticamente se estiver aberto durante a atualização
CloseApplications=force
RestartApplications=no

; Visual
WizardStyle=modern
WizardSizePercent=110
SetupIconFile=EcoLab.ico
WizardImageFile=installer\windows\wizard.bmp,installer\windows\wizard@2x.bmp
WizardSmallImageFile=installer\windows\wizard-small.bmp,installer\windows\wizard-small@2x.bmp
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}

; Saída
OutputDir=installer_output
OutputBaseFilename=EcoLab-Windows-Setup
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

[Languages]
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
pt.Shortcuts=Atalhos:
en.Shortcuts=Shortcuts:
pt.DesktopIcon=Criar atalho na Área de Trabalho
en.DesktopIcon=Create a desktop shortcut
pt.LaunchApp=Abrir o EcoLab agora
en.LaunchApp=Launch EcoLab now
pt.RemoveData=Deseja apagar também os dados do EcoLab (mapas gerados e cache de downloads)?%n%nEscolha "Não" se pretende reinstalar e manter seus resultados.
en.RemoveData=Do you also want to delete EcoLab data (generated maps and download cache)?%n%nChoose "No" if you plan to reinstall and keep your results.
pt.WelcomeExtra=O EcoLab abre no seu navegador e fica com um ícone de folha perto do relógio. Para fechar, clique com o botão direito nesse ícone e escolha Sair.
en.WelcomeExtra=EcoLab opens in your web browser and shows a leaf icon next to the clock. To quit, right-click that icon and choose Sair (Quit).

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:Shortcuts}"

[Files]
Source: "dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "EcoLab.ico";         DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE";            DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\EcoLab.ico"; Comment: "Modelagem de distribuição de espécies"
Name: "{autodesktop}\{#AppName}";  Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\EcoLab.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchApp}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /T /IM {#AppExeName}"; Flags: runhidden; RunOnceId: "KillEcoLab"

[UninstallDelete]
Type: dirifempty; Name: "{app}"

[Code]
procedure InitializeWizard();
begin
  WizardForm.WelcomeLabel2.Caption :=
    WizardForm.WelcomeLabel2.Caption + #13#10#13#10 + CustomMessage('WelcomeExtra');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    { mesma pasta que platformdirs usa: %LOCALAPPDATA%\UTFPR\EcoLab }
    DataDir := ExpandConstant('{localappdata}\UTFPR\EcoLab');
    if DirExists(DataDir) and not UninstallSilent() then
      if MsgBox(CustomMessage('RemoveData'), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(DataDir, True, True, True);
  end;
end;
