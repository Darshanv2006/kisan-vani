# 🌾 Kisan Vani - One-Command Launcher
Write-Host "==========================================" -ForegroundColor Green
Write-Host " 🌾 Starting Kisan Vani Voice Assistant... " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Green

npx concurrently --names "BACKEND,FRONTEND" --prefix-colors "blue,green" `
  "python -m uvicorn backend.main:app --port 8000 --reload" `
  "cd frontend; npm run dev"
