@echo off
rem Dublu-clic: porneste baza de date locala si aplicatia OptiFleet, apoi deschide browserul.
rem Oprire:  OptiFleet.cmd stop      Backup:  OptiFleet.cmd backup
set ACTION=%1
if "%ACTION%"=="" set ACTION=start
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\local\optifleet.ps1" %ACTION%
if errorlevel 1 pause
