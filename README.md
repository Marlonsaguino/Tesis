## NexoMail 1.8.2

Conectar Gmail y Reautorizar con Google abren directamente el flujo de Google con el cliente configurado en la extensión. La configuración de la aplicación sigue accesible desde Configuración. Google decide las pantallas de selección, aviso y consentimiento que corresponden. Compilación comprobada; autorización real pendiente de comprobación en el navegador.

## NexoMail 1.8.1: recuperación de sesión al recargar

Consulta SESION_AL_RECARGAR.md. Después de actualizar, conecta una vez la cuenta para guardar la sesión temporal de la extensión.

## NexoMail 1.8.0: persistencia opcional con PostgreSQL

Ejecuta CONFIGURAR_BASE_DATOS.cmd después de preparar la base y el usuario nexomail_app. Consulta [BASE_DE_DATOS_POSTGRESQL.md](BASE_DE_DATOS_POSTGRESQL.md) para configuración, tablas y límites.

# EmailAgent: extensión para Gmail y Outlook

Integración de los dos proyectos de tesis en una extensión Manifest V3 para Chrome, Edge y Brave compatibles con las APIs de identidad de Chromium.

## Qué incluye

- Detección de Gmail y Outlook según la dirección de la pestaña.
- Botón EmailAgent dentro de los sitios compatibles y acceso desde el icono de la extensión.
- Chat flotante con la aplicación de Gmail o la de Outlook. El botón **Ampliar** abre el mismo módulo en una pestaña de la extensión.
- Aplicaciones React y Angular compiladas dentro de la extensión, sin ejecutar un servidor de desarrollo para las interfaces.
- Un único servidor local de IA en `127.0.0.1:8000` para ambos asistentes.
- Autorización Google independiente de Microsoft, propuestas revisables y sesiones separadas.
- Configuración pública desde las opciones de la extensión. Las claves del proveedor de IA se guardan solo en `backend/.env`.

Se incorpora PostgreSQL local opcional para guardar chat, borradores, preferencias y auditoría por cuenta. Los proyectos originales no se modificaron. Se conservan sus módulos y se integran mediante un contenedor y adaptadores; no se reescriben React y Angular como un único framework.

## 1. Cargar la extensión ya compilada

1. Extrae el ZIP en una carpeta que conservarás, por ejemplo `Documentos/EmailAgent`.
2. Abre la página de extensiones del navegador:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Activa **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta **extension** del proyecto. Es la que contiene `manifest.json`.
5. Fija el icono de EmailAgent a la barra del navegador.
6. Abre **Opciones** desde la ficha de la extensión o el engranaje de la ventana flotante.

No debes seleccionar la carpeta completa del proyecto ni instalar ambos proyectos por separado.

## 2. Preparar las autorizaciones de correo

Estar conectado a Gmail u Outlook en una pestaña no autoriza a la extensión. Cada módulo debe solicitar permiso. La cuenta autorizada dentro del asistente puede ser distinta de la cuenta abierta en el sitio: comprueba el nombre y el correo antes de aprobar una acción.

### Gmail

1. Activa Gmail API en tu proyecto Google Cloud.
2. Configura la pantalla de consentimiento y añade tu correo a los usuarios de prueba si la aplicación está en pruebas.
3. Crea o utiliza un cliente OAuth de **aplicación web**.
4. En las opciones de EmailAgent copia la dirección **Google · cliente de aplicación web**. Tiene una forma similar a `https://ID_EXTENSION.chromiumapp.org/google`.
5. Registra exactamente esa dirección entre los URI de redireccionamiento autorizados del cliente Google.
6. Guarda el **Client ID público** en las opciones de EmailAgent.
7. En Gmail pulsa EmailAgent y, dentro del módulo, **Conectar Gmail / Autorizar con Google**.

Esta versión recuerda la cuenta autorizada y reutiliza el acceso al abrir el panel. Antes de que caduque, intenta obtener una nueva autorización de Google sin mostrar una ventana, usando la cuenta recordada. Si Google necesita confirmación, se muestra el botón Reautorizar con Google. Nunca necesitas pegar un token. No solicita Client Secret ni almacena tokens de Gmail en almacenamiento local persistente: se guardan en el almacenamiento de sesión de la extensión. Solo el correo, Client ID e identificador de sesión se recuerdan entre reinicios. No se almacena un refresh token; la renovación depende de que Google pueda autorizar la sesión sin interacción.

### Outlook / Hotmail

1. Abre el registro de aplicación de Microsoft Entra que utilizas para la tesis.
2. Añade una plataforma **Single-page application (SPA)** si todavía no existe.
3. En las opciones de EmailAgent copia la dirección **Microsoft · plataforma SPA**, similar a `https://ID_EXTENSION.chromiumapp.org/microsoft`, y regístrala exactamente como URI de redirección SPA.
4. Comprueba el **Application (client) ID público** en las opciones. Se ha conservado el identificador público del proyecto de Outlook entregado; puedes sustituirlo.
5. Para tu Hotmail/Outlook personal deja seleccionado **Personal: Outlook / Hotmail**. Para cuentas de universidad o empresa, el registro debe permitirlas y puede requerir consentimiento del administrador.
6. Conserva los permisos delegados de lectura/perfil y los permisos de envío/cambios que ya usa el proyecto. No añadas un secreto de cliente al navegador.
7. Dentro del módulo de Outlook pulsa **Conectar Outlook** y completa la ventana de Microsoft.

El adaptador conserva MSAL y el flujo de código con PKCE, pero abre la autorización con `chrome.identity.launchWebAuthFlow`. El cierre de sesión del módulo limpia su sesión local; no cierra necesariamente la sesión de Outlook de tu pestaña ni revoca el consentimiento en Microsoft.

Si cargas la extensión en otro navegador o cambia su ID, registra las nuevas direcciones que muestran sus opciones. No reutilices una dirección de retorno inventada ni el antiguo `localhost:4200` para esta versión.

## 3. Iniciar la IA compartida

Se requiere Python 3.12 o compatible. Las interfaces compiladas no necesitan Node para usarse.

1. Ejecuta **CONFIGURAR_SERVIDOR.cmd**. Crea el entorno Python, instala las dependencias y prepara `backend/.env` si no existe. No sobrescribe una configuración existente.
2. Abre `backend/.env` y configura el proveedor:
   - Para Gemini: `LLM_PROVIDER=gemini`, `LLM_MODEL` con un modelo disponible en tu cuenta y `GEMINI_API_KEY` con tu clave.
   - Para Ollama: `LLM_PROVIDER=ollama`, `LLM_MODEL` con el modelo que descargaste y `OLLAMA_URL=http://127.0.0.1:11434`. Ollama debe estar iniciado y el modelo instalado.
3. Copia el valor **EXTENSION_ACCESS_TOKEN** de ese archivo al campo **Clave de enlace** de las opciones de EmailAgent. Esa clave se genera aleatoriamente al configurar el servidor y es distinta de la clave de Gemini.
4. Guarda las opciones, cierra el panel y vuelve a abrirlo.
5. Ejecuta **INICIAR_SERVIDOR.cmd** y conserva la ventana abierta.
6. En las opciones pulsa **Comprobar servidor**. La comprobación no genera texto con IA ni acredita que el modelo esté disponible.

No ejecutes al mismo tiempo el antiguo backend en el puerto 8000: esta versión utiliza ese mismo puerto. Las claves existentes de los proyectos originales no se copiaron al paquete.

Gmail y Outlook comparten el proveedor y el modelo de ese único archivo. No comparten el contenido de sus conversaciones. El adaptador común de Gmail admite Gemini y Ollama. La compatibilidad heredada con Claude del backend de Outlook no implica compatibilidad de Claude en Gmail.

Gemini está sujeto a los límites y al plan de tu proyecto; configurar esta extensión no garantiza gratuidad. Ollama procesa las consultas en tu equipo, con el consumo de memoria y recursos que requiera el modelo.

## 4. Usarlo

1. Abre Gmail u Outlook web.
2. Pulsa la **burbuja azul de EmailAgent** o su icono de la barra. Puedes arrastrar la burbuja antes de abrirla.
3. La plataforma se elige por el sitio de esa pestaña.
4. La ventana se abre en Chat. Autoriza tu cuenta y utiliza Correo para seleccionar el mensaje con el que trabajarás.
5. Revisa las propuestas antes de aprobarlas. La selección de un correo en el sitio original no se copia automáticamente al panel.

La extensión detecta Gmail en `mail.google.com` y Outlook en `outlook.live.com`, `outlook.office.com`, `outlook.office365.com` y `outlook.cloud.microsoft`. No lee páginas de otros sitios ni extrae mensajes del DOM de Gmail/Outlook. Los correos se consultan mediante sus APIs autorizadas.

Arrastra la burbuja para colocarla donde prefieras. Al pulsarla se abre directamente el chat. Arrastra su cabecera para mover la ventana y su esquina inferior derecha para cambiar el tamaño. El botón **−** minimiza la ventana sin destruirla ni perder la conversación mientras permanezcas en esa página. La posición y el tamaño se recuerdan por plataforma; los mensajes no se guardan por este cambio.

Dentro de la ventana puedes cambiar entre **Chat, Correo, Acciones, Historial y Ajustes**. El engranaje de la cabecera abre las opciones de la extensión. El icono de EmailAgent en la barra del navegador abre o minimiza la misma ventana; ya no utiliza Side Panel API.

## Estado de la entrega

Se incluyen las dos interfaces compiladas. Se completaron las compilaciones TypeScript/Vite y Angular de producción. Las advertencias de tamaño de Angular y el selector Bootstrap omitido se documentan en `docs/ARQUITECTURA.md`.

**Pendiente de comprobación en el navegador del usuario:** instalación como extensión, autorización real de Google y Microsoft con sus URI registrados, consultas de IA con su configuración y acciones reales de correo. No se han enviado correos ni accedido a sus cuentas durante esta integración. No se considera una versión publicada ni validada por Chrome Web Store.

Con PostgreSQL conectado se recuperan el chat reciente, los borradores guardados y la auditoría. Espera la confirmación de guardado antes de recargar. Las propuestas ejecutables y los archivos adjuntos de la sesión no se restauran. Si PostgreSQL falla o está desactivado, el aviso de la interfaz indica que los datos pueden perderse. La configuración pública y la clave de enlace se guardan en el almacenamiento local de la extensión; las autorizaciones de correo tienen su propio almacenamiento de sesión.

## Reconstruir después de cambiar código

Solo para desarrollo: instala Node.js 24 y ejecuta **RECOMPILAR.cmd**. Instala las dependencias de ambas aplicaciones y reconstruye la carpeta `extension/apps`. Luego pulsa **Recargar** en la página de extensiones y actualiza las pestañas de Gmail/Outlook.

## Problemas frecuentes

| Mensaje o situación | Qué revisar |
|---|---|
| No aparece el botón | Recarga Gmail/Outlook después de instalar o actualizar. Verifica que el dominio esté en la lista compatible. |
| No abre el panel desde el botón | Pulsa el icono de EmailAgent de la barra; recarga la pestaña de correo después de actualizar la extensión. |
| `redirect_uri_mismatch` / error de dirección de retorno | Copia la dirección exacta desde las opciones al cliente Google o registro SPA Microsoft. |
| Microsoft se queda esperando | Revisa el Client ID, el tipo de cuenta, la dirección SPA y la ventana de autorización. |
| Google pide confirmar la sesión | Pulsa Reautorizar con Google. No pegues tokens. La renovación sin ventana depende de la sesión y de los permisos de Google; no se cambia al simulador para ocultar el error. |
| Servidor sin conexión | Inicia INICIAR_SERVIDOR.cmd, verifica el puerto 8000 y copia la clave de enlace correcta. |
| El modelo rechaza la consulta | Revisa el modelo disponible, clave, cuota o instalación local de Ollama. |
| Correo aceptado pero no recibido | Aceptación de envío no equivale a entrega. Revisa avisos de entrega fallida en Entrada. |
