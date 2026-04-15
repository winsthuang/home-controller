#!/bin/bash
# Persistent TCP proxy for Zehnder ComfoConnect Pro Modbus TCP
# Uses system nc (Apple-signed) to bypass macOS Local Network restriction
# Forwards localhost:10502 -> 192.168.4.28:502

REMOTE_HOST="192.168.4.28"
REMOTE_PORT="502"
LOCAL_PORT="10502"
FIFO="/tmp/modbus_proxy_fifo"

cleanup() {
  rm -f "$FIFO"
  exit 0
}
trap cleanup EXIT INT TERM

while true; do
  rm -f "$FIFO"
  mkfifo "$FIFO"
  # nc -l listens for one connection, proxies it, then exits
  # The while loop restarts it for the next connection
  nc -l "$LOCAL_PORT" < "$FIFO" | nc "$REMOTE_HOST" "$REMOTE_PORT" > "$FIFO" 2>/dev/null
  sleep 0.1
done
