@echo off
REM ========================================================================
REM  EVA - DASHBOARD - BUILD LOCAL WINDOWS (SETUP + PORTABLE)
REM  Execute este arquivo como ADMINISTRADOR!
REM  (botao direito -> Executar como administrador)
REM ========================================================================
title Eva - Dashboard - Build Setup + Portable

setlocal
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
set "ELECTRON_CACHE=%~dp0.electron-cache"
set "ELECTRON_BUILDER_CACHE=%~dp0.electron-builder-cache"

cd /d "%~dp0"

echo.
echo [1/5] Limpando build anterior...
rmdir /s /q release 2>nul
mkdir release

echo.
echo [2/5] Lint (TypeScript)...
call npm.cmd run lint
if errorlevel 1 (echo ERRO NO LINT & pause & exit /b 1)

echo.
echo [3/5] Build Renderer (Vite)...
call npm.cmd run build:renderer
if errorlevel 1 (echo ERRO NO BUILD RENDERER & pause & exit /b 1)

echo.
echo [4/5] Electron-Builder (Setup NSIS + Portable)...
REM  npmRebuild=true ja esta no package.json -> recompila @serialport/bindings-cpp
call node_modules\.bin\electron-builder.cmd --win --x64 --publish never
if errorlevel 1 (echo ERRO NO ELECTRON-BUILDER & pause & exit /b 1)

echo.
echo [5/5] Listando arquivos gerados em release\win\...
if exist release\win (dir /b release\win) else (echo (pasta release\win ainda nao existe))
echo.
echo ========================================================
echo  BUILD CONCLUIDO! Arquivos na pasta:  %~dp0release\win
echo ========================================================
echo  - Eva - Dashboard Setup X.Y.Z.exe   (Instalador cliente)
echo  - Eva - Dashboard X.Y.Z.exe         (Portatil)
echo  - latest.yml                          (Auto-Update)
echo  - *.blockmap                          (Delta Update)
echo ========================================================
pause
endlocal
