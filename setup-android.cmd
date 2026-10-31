@echo off
chcp 65001 >nul
rem Поиск и настройка Android-инструментов, сборка APK «Доски». Права администратора не нужны.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-android.ps1"
