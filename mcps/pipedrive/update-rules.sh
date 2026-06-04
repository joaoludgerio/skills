#!/usr/bin/env bash
# Atualiza as regras de preenchimento do MCP Pipedrive nesta maquina (Linux/VPS).
#
# O que faz:
#   1. git pull do repo (traz add-descriptions.js atualizado)
#   2. aplica as descricoes no config.js local (node add-descriptions.js)
#   3. avisa pra reiniciar o Claude Code
#
# Uso:
#   bash update-rules.sh [/caminho/do/expert-mcps]
#   (default: $HOME/expert-mcps)
set -euo pipefail

REPO="${1:-$HOME/expert-mcps}"
PD="$REPO/mcps/pipedrive"

echo "==> git pull em $REPO"
git -C "$REPO" pull --rebase

if [ -f "$PD/config.js" ]; then
  echo "==> aplicando descricoes dos campos (node add-descriptions.js)"
  ( cd "$PD" && node add-descriptions.js )
else
  echo "!! config.js nao existe nesta maquina."
  echo "   Abra o Claude Code e peca: 'roda sync_all do Pipedrive'. Depois rode este script de novo."
fi

echo ""
echo "OK. Agora REINICIE o Claude Code para o MCP recarregar as regras."
echo "Se algum campo foi RENOMEADO no Pipedrive, peca ao Claude (uma vez): 'roda sync_all'."
