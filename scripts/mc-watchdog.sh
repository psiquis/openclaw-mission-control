#!/usr/bin/env bash
# =============================================================================
# mc-watchdog.sh — Mission Control Watchdog
# Comprueba si MC responde y lo levanta si está caído.
# Uso: bash mc-watchdog.sh [--force-restart]
# Cron recomendado: */5 * * * * bash /home/ola3/openclaw-mission-control/scripts/mc-watchdog.sh
# =============================================================================

MC_NAME="mission-control"
MC_PORT=3000
MC_URL="http://localhost:${MC_PORT}/"
LOG_FILE="/home/ola3/.pm2/logs/mc-watchdog.log"
MAX_WAIT=30   # segundos máximos esperando que arranque
FORCE_RESTART="${1:-}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Rotar log si pasa de 1MB
if [[ -f "$LOG_FILE" ]] && [[ $(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 1048576 ]]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
fi

# ── Comprobar si PM2 tiene el proceso ────────────────────────────────────────
pm2_status() {
    pm2 list 2>/dev/null | grep "$MC_NAME" | grep -q "online"
}

# ── Comprobar si responde HTTP ────────────────────────────────────────────────
http_ok() {
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$MC_URL" 2>/dev/null)
    [[ "$code" == "200" || "$code" == "307" || "$code" == "302" || "$code" == "301" ]]
}

# ── Arrancar MC ───────────────────────────────────────────────────────────────
start_mc() {
    log "Arrancando $MC_NAME via pm2..."
    pm2 start "$MC_NAME" 2>/dev/null || pm2 restart "$MC_NAME" 2>/dev/null
    
    # Esperar a que responda
    local waited=0
    while ! http_ok && [[ $waited -lt $MAX_WAIT ]]; do
        sleep 2
        waited=$((waited + 2))
    done
    
    if http_ok; then
        log "✅ $MC_NAME arrancado correctamente (esperé ${waited}s)"
        return 0
    else
        log "❌ $MC_NAME no responde tras ${MAX_WAIT}s — revisar logs: pm2 logs $MC_NAME"
        return 1
    fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
if [[ "$FORCE_RESTART" == "--force-restart" ]]; then
    log "🔄 Force-restart solicitado"
    pm2 restart "$MC_NAME" 2>/dev/null
    sleep 5
fi

if ! pm2_status; then
    log "⚠️  $MC_NAME no está en pm2 como 'online' — intentando arrancar..."
    start_mc
elif ! http_ok; then
    log "⚠️  $MC_NAME está en pm2 pero no responde HTTP — reiniciando..."
    pm2 restart "$MC_NAME" 2>/dev/null
    sleep 5
    if http_ok; then
        log "✅ $MC_NAME reiniciado y responde OK"
    else
        log "❌ $MC_NAME sigue sin responder tras reinicio — revisar: pm2 logs $MC_NAME"
    fi
else
    log "✅ $MC_NAME OK (pm2: online, HTTP: ok)"
fi
