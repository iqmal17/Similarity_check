@echo off
echo Building SimCheck.exe ...
pyinstaller --noconfirm --clean --onefile --windowed --icon=assets/icon.ico --add-data "web;web" --add-data "assets;assets" --add-data "src;src" app.py -n SimCheck
echo Selesai. Cek folder dist/
pause
