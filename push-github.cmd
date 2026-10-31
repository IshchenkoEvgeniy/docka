@echo off
chcp 65001 >nul
rem Первая отправка проекта на GitHub: история по этапам из docka-history.bundle.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\push-github.ps1"
