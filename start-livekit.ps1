# 🚀 LiveKit Murf Starter - One-Command Launcher
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 🚀 Starting Murf LiveKit Starter...      " -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Cyan

npx concurrently --names "AGENT,FRONTEND" --prefix-colors "yellow,cyan" `
  "cd murf-livekit-starter/backend; uv run src/agent.py dev" `
  "cd murf-livekit-starter/frontend; pnpm dev"
