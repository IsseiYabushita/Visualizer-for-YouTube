#!/usr/bin/env bash
set -euo pipefail

RENDER_URL=""
KOYEB_URL=""
PATH_SUFFIX="/"
COLD_WAIT_SEC=960
COLD_RUNS=3
WARM_RUNS=10
WARM_INTERVAL_SEC=2
QUICK_MODE=false

usage() {
  cat <<'EOF'
Render と Koyeb の待ち時間（TTFB/Total）を比較するスクリプト

Usage:
  ./scripts/compare_render_koyeb.sh --render <url> --koyeb <url> [options]

Required:
  --render <url>         Render 側のベースURL
  --koyeb <url>          Koyeb 側のベースURL

Options:
  --path <path>          計測対象パス (default: /)
  --cold-wait <sec>      cold 計測時の待機秒数 (default: 960)
  --cold-runs <n>        cold 計測回数 (default: 3)
  --warm-runs <n>        warm 計測回数 (default: 10)
  --warm-interval <sec>  warm 計測の間隔秒 (default: 2)
  --quick                すぐ試す簡易モード (cold-wait=60, cold-runs=2, warm-runs=5)
  -h, --help             ヘルプ表示

Examples:
  ./scripts/compare_render_koyeb.sh \
    --render https://your-api.onrender.com \
    --koyeb https://your-api.koyeb.app

  ./scripts/compare_render_koyeb.sh \
    --render https://your-api.onrender.com \
    --koyeb https://your-api.koyeb.app \
    --path / \
    --cold-wait 960 --cold-runs 3 --warm-runs 10
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --render)
      RENDER_URL="${2:-}"
      shift 2
      ;;
    --koyeb)
      KOYEB_URL="${2:-}"
      shift 2
      ;;
    --path)
      PATH_SUFFIX="${2:-}"
      shift 2
      ;;
    --cold-wait)
      COLD_WAIT_SEC="${2:-}"
      shift 2
      ;;
    --cold-runs)
      COLD_RUNS="${2:-}"
      shift 2
      ;;
    --warm-runs)
      WARM_RUNS="${2:-}"
      shift 2
      ;;
    --warm-interval)
      WARM_INTERVAL_SEC="${2:-}"
      shift 2
      ;;
    --quick)
      QUICK_MODE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$RENDER_URL" || -z "$KOYEB_URL" ]]; then
  echo "--render と --koyeb は必須です" >&2
  usage
  exit 1
fi

if [[ "$QUICK_MODE" == "true" ]]; then
  COLD_WAIT_SEC=60
  COLD_RUNS=2
  WARM_RUNS=5
fi

if [[ "$PATH_SUFFIX" != /* ]]; then
  PATH_SUFFIX="/$PATH_SUFFIX"
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl が見つかりません。インストールしてから再実行してください。" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

join_url() {
  local base="$1"
  local path="$2"
  base="${base%/}"
  printf "%s%s" "$base" "$path"
}

measure_once() {
  local url="$1"
  local probe
  if [[ "$url" == *\?* ]]; then
    probe="${url}&bench_ts=${EPOCHSECONDS}_${RANDOM}"
  else
    probe="${url}?bench_ts=${EPOCHSECONDS}_${RANDOM}"
  fi

  curl -sS -o /dev/null \
    -w "%{http_code} %{time_starttransfer} %{time_total}" \
    "$probe"
}

avg_col() {
  local file="$1"
  local col="$2"
  awk -v c="$col" '{s += $c} END {if (NR > 0) printf "%.3f", s / NR; else print "NaN"}' "$file"
}

percentile_col() {
  local file="$1"
  local col="$2"
  local p="$3"

  awk -v c="$col" '{print $c}' "$file" | sort -n | awk -v p="$p" '
    { a[NR] = $1 }
    END {
      if (NR == 0) { print "NaN"; exit }
      rank = int((NR * p) + 0.999999)
      if (rank < 1) rank = 1
      if (rank > NR) rank = NR
      printf "%.3f", a[rank]
    }
  '
}

min_col() {
  local file="$1"
  local col="$2"
  awk -v c="$col" '{print $c}' "$file" | sort -n | head -n 1 | awk '{printf "%.3f", $1}'
}

max_col() {
  local file="$1"
  local col="$2"
  awk -v c="$col" '{print $c}' "$file" | sort -n | tail -n 1 | awk '{printf "%.3f", $1}'
}

count_non_2xx() {
  local file="$1"
  awk '$3 !~ /^2/ {e++} END {print e + 0}' "$file"
}

run_profile() {
  local label="$1"
  local url="$2"
  local runs="$3"
  local interval="$4"
  local outfile="$5"

  : > "$outfile"

  for ((i = 1; i <= runs; i++)); do
    if (( i > 1 && interval > 0 )); then
      printf "  [%s] wait %ss before run %d/%d...\n" "$label" "$interval" "$i" "$runs"
      sleep "$interval"
    fi

    local result
    result="$(measure_once "$url")"
    local http ttfb total
    http="$(awk '{print $1}' <<<"$result")"
    ttfb="$(awk '{print $2}' <<<"$result")"
    total="$(awk '{print $3}' <<<"$result")"
    printf "%s %s %s\n" "$ttfb" "$total" "$http" >> "$outfile"

    printf "  [%s] run %d/%d -> http=%s ttfb=%ss total=%ss\n" "$label" "$i" "$runs" "$http" "$ttfb" "$total"
  done
}

print_summary() {
  local label="$1"
  local file="$2"

  local ttfb_avg ttfb_p50 ttfb_p95 ttfb_min ttfb_max
  local total_avg total_p50 total_p95 total_min total_max
  local errors

  ttfb_avg="$(avg_col "$file" 1)"
  ttfb_p50="$(percentile_col "$file" 1 0.50)"
  ttfb_p95="$(percentile_col "$file" 1 0.95)"
  ttfb_min="$(min_col "$file" 1)"
  ttfb_max="$(max_col "$file" 1)"

  total_avg="$(avg_col "$file" 2)"
  total_p50="$(percentile_col "$file" 2 0.50)"
  total_p95="$(percentile_col "$file" 2 0.95)"
  total_min="$(min_col "$file" 2)"
  total_max="$(max_col "$file" 2)"

  errors="$(count_non_2xx "$file")"

  printf "\n[%s] Summary\n" "$label"
  printf "  TTFB  avg=%ss p50=%ss p95=%ss min=%ss max=%ss\n" "$ttfb_avg" "$ttfb_p50" "$ttfb_p95" "$ttfb_min" "$ttfb_max"
  printf "  Total avg=%ss p50=%ss p95=%ss min=%ss max=%ss\n" "$total_avg" "$total_p50" "$total_p95" "$total_min" "$total_max"
  printf "  Non-2xx responses: %s\n" "$errors"
}

compare_two() {
  local title="$1"
  local render_file="$2"
  local koyeb_file="$3"

  local r_avg k_avg
  r_avg="$(avg_col "$render_file" 1)"
  k_avg="$(avg_col "$koyeb_file" 1)"

  printf "\n[%s] TTFB avg comparison\n" "$title"
  printf "  Render: %ss\n" "$r_avg"
  printf "  Koyeb : %ss\n" "$k_avg"

  awk -v r="$r_avg" -v k="$k_avg" '
    BEGIN {
      diff = r - k
      if (diff > 0) {
        printf "  -> Koyeb is faster by %.3fs on average TTFB\n", diff
      } else if (diff < 0) {
        printf "  -> Render is faster by %.3fs on average TTFB\n", -diff
      } else {
        print "  -> Tie on average TTFB"
      }
    }
  '
}

RENDER_TARGET="$(join_url "$RENDER_URL" "$PATH_SUFFIX")"
KOYEB_TARGET="$(join_url "$KOYEB_URL" "$PATH_SUFFIX")"

echo "=== Benchmark Config ==="
echo "Render target : $RENDER_TARGET"
echo "Koyeb target  : $KOYEB_TARGET"
echo "Cold runs     : $COLD_RUNS"
echo "Cold wait     : ${COLD_WAIT_SEC}s"
echo "Warm runs     : $WARM_RUNS"
echo "Warm interval : ${WARM_INTERVAL_SEC}s"

if (( COLD_RUNS > 1 && COLD_WAIT_SEC >= 600 )); then
  estimated=$(( (COLD_RUNS - 1) * COLD_WAIT_SEC ))
  echo "Estimated cold-wait time: ${estimated}s"
fi

render_cold_file="$WORK_DIR/render_cold.txt"
koyeb_cold_file="$WORK_DIR/koyeb_cold.txt"
render_warm_file="$WORK_DIR/render_warm.txt"
koyeb_warm_file="$WORK_DIR/koyeb_warm.txt"

echo "\n=== Phase 1: COLD test (Render) ==="
run_profile "Render COLD" "$RENDER_TARGET" "$COLD_RUNS" "$COLD_WAIT_SEC" "$render_cold_file"

echo "\n=== Phase 2: COLD test (Koyeb) ==="
run_profile "Koyeb COLD" "$KOYEB_TARGET" "$COLD_RUNS" "$COLD_WAIT_SEC" "$koyeb_cold_file"

echo "\n=== Phase 3: WARM test (Render) ==="
run_profile "Render WARM" "$RENDER_TARGET" "$WARM_RUNS" "$WARM_INTERVAL_SEC" "$render_warm_file"

echo "\n=== Phase 4: WARM test (Koyeb) ==="
run_profile "Koyeb WARM" "$KOYEB_TARGET" "$WARM_RUNS" "$WARM_INTERVAL_SEC" "$koyeb_warm_file"

print_summary "Render COLD" "$render_cold_file"
print_summary "Koyeb COLD" "$koyeb_cold_file"
compare_two "COLD" "$render_cold_file" "$koyeb_cold_file"

print_summary "Render WARM" "$render_warm_file"
print_summary "Koyeb WARM" "$koyeb_warm_file"
compare_two "WARM" "$render_warm_file" "$koyeb_warm_file"

echo "\nDone."
