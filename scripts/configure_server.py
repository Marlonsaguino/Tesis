from pathlib import Path
import secrets
root=Path(__file__).resolve().parents[1]
target=root/'backend/.env'
if not target.exists():
    text=(root/'backend/.env.example').read_text(encoding='utf-8')
    target.write_text(text.replace('EXTENSION_ACCESS_TOKEN=','EXTENSION_ACCESS_TOKEN='+secrets.token_urlsafe(32)),encoding='utf-8')
print('Configuración preparada en backend/.env.')
print('Añade tu clave y modelo de IA en ese archivo. Copia EXTENSION_ACCESS_TOKEN a las opciones de la extensión.')
print('Si el archivo ya existía, se conservó sin cambios.')
