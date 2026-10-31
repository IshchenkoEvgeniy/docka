@echo off
chcp 65001 >nul
rem Подписанный release-APK «Доски» (шаг 3.14). Сначала хотя бы раз — setup-android.cmd.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-android.ps1"
