# Atualiza as regras de preenchimento do MCP Pipedrive nesta maquina (Windows).
#
# O que faz:
#   1. git pull do repo (traz add-descriptions.js atualizado)
#   2. aplica as descricoes no config.js local (node add-descriptions.js)
#   3. avisa pra reiniciar o Claude Code
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File update-rules.ps1
#   (opcional) -RepoPath "C:\caminho\do\expert-mcps"

param(
  [string]$RepoPath = "C:\MCPs\expert-mcps"
)

$ErrorActionPreference = "Stop"
$pd = Join-Path $RepoPath "mcps\pipedrive"

Write-Host "==> git pull em $RepoPath"
git -C $RepoPath pull --rebase

if (Test-Path (Join-Path $pd "config.js")) {
  Write-Host "==> aplicando descricoes dos campos (node add-descriptions.js)"
  Push-Location $pd
  try { node add-descriptions.js } finally { Pop-Location }
} else {
  Write-Host "!! config.js nao existe nesta maquina."
  Write-Host "   Abra o Claude Code e peca: 'roda sync_all do Pipedrive'. Depois rode este script de novo."
}

Write-Host ""
Write-Host "OK. Agora REINICIE o Claude Code para o MCP recarregar as regras."
Write-Host "Se algum campo foi RENOMEADO no Pipedrive, peca ao Claude (uma vez): 'roda sync_all'."
