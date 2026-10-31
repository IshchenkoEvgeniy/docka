@echo off
chcp 65001 >nul
rem Установка инструментов и первая сборка «Доски». Нужно подтвердить запрос администратора.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows.ps1"
