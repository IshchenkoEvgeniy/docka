@echo off
chcp 65001 >nul
rem Сборка установщика «Доски» для Windows (шаг 3.14).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows.ps1"
