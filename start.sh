#!/bin/sh
# 一键启动本地服务器（macOS / Linux）。打开浏览器访问 http://localhost:8000
cd "$(dirname "$0")" && echo "打开 http://localhost:8000 （Ctrl+C 结束）" && python3 -m http.server 8000
