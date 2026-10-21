# PostgreSQL · NexoMail 1.8.0

## Configurar en la instalación existente

1. Mantén PostgreSQL iniciado. La base es `nexomail`, el esquema es `nexomail` y el usuario de la aplicación es `nexomail_app` con permiso de acceso y creación en ese esquema. No uses `postgres` desde la aplicación.
2. Ejecuta `CONFIGURAR_BASE_DATOS.cmd` en la carpeta principal de NexoMail. Instala el adaptador Psycopg en el entorno virtual del proyecto y solicita el puerto y la contraseña de `nexomail_app` sin mostrarla.
3. El configurador crea las tablas usando ese usuario y guarda los parámetros de PostgreSQL en `backend/.env`, conservando las claves de IA y de enlace existentes. No compartas ese archivo.
4. Detén FastAPI con Ctrl+C y vuelve a ejecutar `INICIAR_SERVIDOR.cmd`.
5. Recarga la extensión en la misma carpeta y recarga las pestañas de Gmail y Outlook. La versión es 1.8.0. No quites ni reinstales la extensión: conserva así su dirección de retorno OAuth y su configuración.
6. Conecta una cuenta real. La franja de PostgreSQL informa de la carga, los cambios pendientes y los fallos. Antes de recargar o cerrar, espera «Guardado en PostgreSQL».

## Tablas

| Tabla | Contenido |
|---|---|
| accounts | Identidad verificada, proveedor, correo y fechas de actividad. |
| chat_messages | Conversación visible reciente: rol, texto y fecha. |
| mail_drafts | Destinatarios, asunto, texto y referencia de respuesta de borradores. |
| user_preferences | Tema, revisión estricta, asistencia de IA y agrupación automática. |
| audit_events | Eventos comunicados por la extensión, con fecha del cliente y fecha de recepción del servidor. |
| workspace_versions | Revisión de cada sección para detectar cambios entre ventanas. |
| schema_migrations | Versiones del esquema. |

El esquema SQL está en `backend/app/storage/schema.sql`; el configurador lo ejecuta con `nexomail_app`. No es necesario pegarlo manualmente en pgAdmin.

## Separación por cuenta

Cada solicitud de almacenamiento requiere la clave de enlace de NexoMail y una autorización válida del proveedor de correo. El servidor verifica la identidad mediante el perfil de Gmail o Microsoft Graph. No acepta un correo o un identificador de cuenta elegido por el cliente para leer otro historial. La misma dirección en dos proveedores no vincula automáticamente las cuentas.

Los datos se almacenan en PostgreSQL local y se consultan únicamente mediante FastAPI en la dirección de bucle local. Esta versión no publica el servidor en Internet ni configura una plataforma SaaS. El equipo y las copias de seguridad deben protegerse mediante los controles de acceso del sistema operativo y PostgreSQL; el contenido almacenado no cuenta con cifrado adicional de la aplicación.

No se persisten contraseñas de Gmail/Outlook, tokens OAuth, claves de Gemini, adjuntos ni el contenido íntegro del buzón. Los textos del chat, borradores y descripciones de auditoría sí pueden contener información personal que el usuario o la aplicación hayan incluido; no deben pegarse secretos en ellos.

## Comportamiento y límites

- Gmail conserva como borradores los mensajes de envío propuestos en una cuenta real con almacenamiento conectado. Al recuperar uno, se crea una propuesta nueva para revisión. Antes de iniciar su envío se retira su registro guardado; si esa retirada no se confirma, no comienza el envío.
- Outlook conserva los borradores que el usuario guarda desde el editor. Los adjuntos permanecen en memoria; un borrador recuperado que tenía archivos muestra que deben adjuntarse nuevamente.
- Las propuestas ejecutables y autorizaciones no se restauran ni se ejecutan automáticamente. La auditoría restaurada es informativa. Las fechas y resultados procedentes del cliente son registros de la extensión, no una certificación independiente de entrega de correo.
- El chat mantiene hasta 100 mensajes recientes y reduce los más antiguos si se supera el límite de solicitud. Los borradores mantienen hasta 50 elementos y cada solicitud debe caber en el límite de 250 KB. Al consultar la auditoría se muestran los 500 eventos recientes; los anteriores permanecen en la base hasta vaciarla.
- No se guardan los pasos internos de las herramientas ni las propuestas de acción dentro del historial del modelo. Se recupera el texto de la conversación.
- Si otra ventana modificó una sección, se avisa y se impide sobrescribirla. Recarga para recuperar la última versión guardada. No se hace una fusión silenciosa.
- Si no hay conexión con PostgreSQL, el aviso indica «Sin persistencia» o «Cambios sin guardar». La sesión puede continuar en memoria, pero no se debe asumir que queda guardada. Reinicia o recarga después de resolver el fallo.
- Vaciar datos guardados elimina chat, borradores, preferencias y auditoría de la cuenta actual. Conserva su registro mínimo de identidad y las revisiones que impiden que una ventana antigua restaure datos borrados. Los correos del proveedor permanecen en su buzón.

## Configuración

Los parámetros son `DB_ENABLED`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. La versión actual admite PostgreSQL en el mismo equipo. El archivo `.env` mantiene las credenciales locales; no se incorpora a los paquetes de distribución.

## Estado de entrega

Se prepararon el esquema, el adaptador, los endpoints y la integración de ambas interfaces. La contraseña la introduce el propietario con el configurador local. La conexión real y la persistencia con sus cuentas deben comprobarse después de ese paso. No se han ejecutado suites de pruebas ni se han enviado correos de prueba en nombre del usuario.

La política de privacidad de la web se actualizó en el paquete `NexoMail-Web-Netlify.zip` para describir el almacenamiento persistente opcional. Debe volver a publicarse en el mismo proyecto de Netlify para que los usuarios consulten la versión actual.
