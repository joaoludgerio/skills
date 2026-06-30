# sync-playbook.ps1
# Sincroniza os playbooks do Workspace (single source of truth do Eric)
# pra dentro do repo da skill fup-inteligente (consumido em runtime em qualquer maquina).
#
# Rodar ANTES de commit/push quando o Eric tiver editado algum playbook.
# Em PC/notebook do Eric, esse script tem acesso ao OneDrive.
# Em VPS/outras maquinas, a pasta playbook/ ja vem versionada via git pull.

$ErrorActionPreference = "Stop"

$SourceDir = "C:\Users\Eric Luciano\OneDrive\Workspace\Processo Comercial\Playbooks\Documentos MD"
$DestDir   = Join-Path $PSScriptRoot "..\playbook"
$DestDir   = (Resolve-Path $DestDir).Path

if (-not (Test-Path $SourceDir)) {
    Write-Host "FONTE nao encontrada: $SourceDir" -ForegroundColor Red
    Write-Host "Este script so funciona em maquinas com acesso ao OneDrive do Eric." -ForegroundColor Yellow
    exit 1
}

Write-Host "Sincronizando playbooks:" -ForegroundColor Cyan
Write-Host "  FONTE:  $SourceDir"
Write-Host "  DESTINO: $DestDir"
Write-Host ""

$Files = Get-ChildItem -Path $SourceDir -Filter "*.md"
$Changed = @()
$Same = @()

foreach ($file in $Files) {
    $destPath = Join-Path $DestDir $file.Name

    if (Test-Path $destPath) {
        $srcHash  = (Get-FileHash $file.FullName -Algorithm SHA256).Hash
        $destHash = (Get-FileHash $destPath      -Algorithm SHA256).Hash
        if ($srcHash -eq $destHash) {
            $Same += $file.Name
            continue
        }
    }

    Copy-Item $file.FullName $destPath -Force
    $Changed += $file.Name
}

if ($Changed.Count -eq 0) {
    Write-Host "Nenhuma mudanca. Playbook ja esta sincronizado." -ForegroundColor Green
} else {
    Write-Host "Arquivos atualizados:" -ForegroundColor Yellow
    $Changed | ForEach-Object { Write-Host "  + $_" }
}

if ($Same.Count -gt 0) {
    Write-Host ""
    Write-Host "Arquivos sem mudanca: $($Same.Count)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Proximo passo: git add playbook/ && git commit -m 'sync playbook DD/MM'" -ForegroundColor Cyan
