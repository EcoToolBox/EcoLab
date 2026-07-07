; ─── EcoLab Installer ────────────────────────────────────────────────────────
; Gerado para Inno Setup 6.x  (https://jrsoftware.org/isinfo.php)
; Para compilar: abra este .iss no Inno Setup Compiler e clique em Build

#define AppName      "EcoLab"
#define AppVersion   "0.1.1"
#define AppPublisher "AneSimoes"
#define AppExeName   "EcoLab.exe"
#define AppURL       ""

[Setup]
AppId={{B4E2A1C3-9F7D-4A2E-8B1D-3C5E6F7A8B9D}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
; Ícone do instalador
SetupIconFile=EcoLab.ico
; Pasta onde o instalador final será gerado
OutputDir=installer_output
OutputBaseFilename=EcoLab_Setup_v{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; Requer admin para instalar em Program Files
PrivilegesRequired=admin
; Imagem lateral do wizard (opcional — 164x314 px .bmp)
; WizardImageFile=installer_banner.bmp

[Languages]
Name: "portuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon";    Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked
Name: "startmenuicon";  Description: "Criar atalho no Menu Iniciar";     GroupDescription: "Atalhos:"; Flags: checkedonce

[Files]
; Coloque o EcoLab.exe gerado pelo PyInstaller na mesma pasta deste .iss
; ou ajuste o caminho abaixo
Source: "dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; Ícone
Source: "EcoLab.ico"; DestDir: "{app}"; Flags: ignoreversion

; Se tiver outros arquivos junto do exe (mapas, configs, etc.), adicione aqui:
; Source: "dist\maps\*"; DestDir: "{app}\maps"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\{#AppName}";           Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\EcoLab.ico"; Tasks: startmenuicon
Name: "{commondesktop}\{#AppName}";   Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\EcoLab.ico"; Tasks: desktopicon
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Run]
; Abre o EcoLab após instalar (opcional)
Filename: "{app}\{#AppExeName}"; Description: "Abrir {#AppName}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Encerra o processo antes de desinstalar
Filename: "taskkill"; Parameters: "/F /IM {#AppExeName}"; Flags: runhidden

[UninstallDelete]
Type: dirifempty; Name: "{app}"

[Code]
// ── Verifica se o .NET / VC++ Redist está disponível (opcional) ──────────────

procedure InitializeWizard();
begin
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;
