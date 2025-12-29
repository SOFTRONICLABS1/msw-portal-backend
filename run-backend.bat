@echo off
REM === Navigate to your backend directory ===
cd /d "E:\MSWWebPortalSourcecode\Stable version with Refresh Tokens 9th jun 25\final web app\server"

REM === Start PM2 backend process ===
pm2 start server.js --name backend2

REM === (Optional) Save PM2 list to resurrect on reboot ===
pm2 save
