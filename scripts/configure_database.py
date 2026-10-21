"""Interactive local configuration; never receives a password in command arguments."""
from pathlib import Path
import getpass,json,os,sys

root=Path(__file__).resolve().parents[1]
backend=root/'backend'
sys.path.insert(0,str(backend))

def main():
    env=backend/'.env'
    if not env.exists():
        print('Primero ejecuta CONFIGURAR_SERVIDOR.cmd. No se creó ni sustituyó tu configuración.')
        return 1
    print('PostgreSQL local para NexoMail. Usa la contraseña de nexomail_app, no la de postgres.')
    port_text=input('Puerto [5432]: ').strip() or '5432'
    if not port_text.isdigit() or not 1<=int(port_text)<=65535:
        print('Puerto no válido.');return 1
    password=getpass.getpass('Contraseña de nexomail_app (no se muestra): ')
    if not password or '\n' in password or '\r' in password:
        print('Contraseña vacía o no válida.');return 1
    os.chdir(backend)
    from app.core.config import settings
    from app.storage.database import initialize
    settings.DB_ENABLED=True;settings.DB_HOST='127.0.0.1';settings.DB_PORT=int(port_text)
    settings.DB_NAME='nexomail';settings.DB_USER='nexomail_app'
    from pydantic import SecretStr
    settings.DB_PASSWORD=SecretStr(password)
    try:
        initialize()
    except Exception:
        print('No se pudo preparar la base. Comprueba que PostgreSQL esté iniciado, el puerto, la contraseña de nexomail_app y los permisos del esquema. No se guardó la contraseña.')
        return 1
    current=env.read_text(encoding='utf-8-sig')
    values={'DB_ENABLED':'true','DB_HOST':'127.0.0.1','DB_PORT':port_text,'DB_NAME':'nexomail','DB_USER':'nexomail_app','DB_PASSWORD':json.dumps(password,ensure_ascii=False)}
    lines=[]
    for line in current.splitlines():
        key=line.split('=',1)[0].strip()
        if key not in values:lines.append(line)
    lines.extend(key+'='+value for key,value in values.items())
    temp=env.with_name('.env.database.tmp')
    temp.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    from dotenv import dotenv_values
    if dotenv_values(temp).get('DB_PASSWORD')!=password:
        temp.unlink()
        print('La contraseña contiene una expresión que .env interpreta como variable. No se modificó .env; configura otra contraseña para nexomail_app y vuelve a intentarlo.')
        return 1
    os.replace(temp,env)
    print('Base de datos preparada y configuración guardada. Las claves de IA y de enlace se conservaron.')
    print('Reinicia INICIAR_SERVIDOR.cmd y recarga NexoMail. No compartas backend/.env.')
    return 0

if __name__=='__main__':raise SystemExit(main())
