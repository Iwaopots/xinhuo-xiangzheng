@echo off
REM 一键启动本地服务器（Windows）。需已安装 Python 3
cd /d %~dp0
start "" http://localhost:8000
python -m http.server 8000
