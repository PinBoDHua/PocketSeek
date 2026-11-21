@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo  PocketSeek 启动器
echo ============================================
if not exist node_modules (
  echo [1/2] 首次运行，安装依赖...
  call pnpm install
)
echo [1/2] 构建生产包...
call pnpm build || goto :error
echo
echo [2/2] 启动本地服务（关闭此窗口即停止）...
call pnpm serve
goto :eof

:error
echo 构建失败，请查看上方错误信息。
pause
