#!/usr/bin/env bash
# Captura una pantalla del emulador o dispositivo Android conectado y la guarda en docs/evidence/.
#
# Uso:  tools/capture.sh 03-inicio
#
# Se usa para dejar evidencia fotografica de lo verificado. Nombrar los archivos por orden de
# recorrido permite leer la carpeta como el guion del flujo.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: tools/capture.sh <nombre-sin-extension>" >&2
  exit 1
fi

NAME="$1"
ADB="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}/platform-tools/adb.exe"

# Con mas de un dispositivo conectado (emulador + telefono real) `adb` no elige: falla. El serial
# se pasa explicito para que la evidencia diga en que aparato se tomo y no en el que quedo primero.
DEVICE_ARGS=()
if [ -n "${ATLAS_DEVICE:-}" ]; then
  DEVICE_ARGS=(-s "$ATLAS_DEVICE")
fi
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/evidence"
mkdir -p "$OUT_DIR"

"$ADB" "${DEVICE_ARGS[@]}" exec-out screencap -p > "$OUT_DIR/$NAME.png"
echo "capturado: docs/evidence/$NAME.png"
