Write-Host "Creating Virtual Environment..."
python -m venv venv
Write-Host "Activating Virtual Environment and Installing Dependencies..."
.\venv\Scripts\pip install --upgrade pip
.\venv\Scripts\pip install -r requirements.txt
Write-Host "Setup Complete!"
