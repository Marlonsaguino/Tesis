# NexoMail 1.8.1 · Recuperar la sesión al recargar

## Actualizar

1. Recarga NexoMail desde la página de extensiones del navegador.
2. Recarga también las pestañas de Gmail y Outlook.
3. Conecta una vez la cuenta después de instalar esta actualización. Se creará la sesión temporal privada.
4. Espera el guardado de PostgreSQL y recarga la pestaña del correo. La extensión recuperará la cuenta recordada para esa pestaña sin abrir un selector interactivo mientras su autorización siga siendo válida.

No hay cambios en la base de datos ni en las direcciones de retorno OAuth.

## Qué cambió

Outlook mantiene una copia de los registros estables de MSAL en `chrome.storage.session`, en memoria privada de la extensión. Se conservan la cuenta, los índices y las credenciales de esa aplicación. No se copian solicitudes PKCE ni indicadores de interacción en curso. Los registros se recuperan antes de inicializar MSAL y se actualizan tras una autorización o renovación correcta.

Gmail ya guardaba sus credenciales temporales en esa memoria. Se añadió la asociación entre pestaña, plataforma, posición de cuenta y la identidad autorizada. Esto evita perder la cuenta recordada cuando el encabezado de Gmail aún no muestra el correo al comenzar a cargar.

Si la página proporciona una dirección de cuenta distinta, se utiliza esa identidad como referencia y no se recupera la anterior. Cuando no se puede leer la cuenta del sitio, solo se usa la asociación previamente autorizada en esa misma pestaña y posición, nunca la primera cuenta global disponible. La identidad conectada se muestra en NexoMail; si cambias de cuenta y el sitio no expone ese cambio, comprueba que coincida antes de trabajar. Una pestaña nueva sin identidad detectable ni asociación previa requiere conexión explícita.

Los registros de Microsoft y los tokens de Google no se guardan en PostgreSQL ni se publican en páginas de correo. Solo las páginas internas de la extensión pueden solicitar su recuperación. Desconectar expresamente una cuenta impide que se vuelva a conectar automáticamente.

## Cuándo puede pedir autorización de nuevo

La memoria privada se limpia al cerrar el navegador o desactivar, actualizar o recargar la extensión. Tras ello se intenta la recuperación silenciosa cuando se conoce la identidad de la página, pero Google o Microsoft pueden exigir una nueva autorización por expiración, revocación, cambio de contraseña o políticas de la organización. No se abren ventanas interactivas de autorización automáticamente durante la carga.

La sesión de la página del proveedor y la autorización de NexoMail siguen siendo independientes. La copia de sesión mejora la continuidad de la extensión, sin leer contraseñas ni copiar cookies del sitio.

## Comprobación pendiente con la cuenta del usuario

La compilación y la sintaxis de los archivos nativos se comprueban durante la entrega. La restauración de credenciales reales al recargar debe confirmarse desde el navegador con las cuentas del usuario; no se han ejecutado suites de pruebas ni solicitudes de correo en su nombre.
