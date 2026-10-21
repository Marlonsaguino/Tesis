# NexoMail 1.7.0 · Clasificación automática y avisos

## Uso en Gmail y Outlook

Abre NexoMail en tu correo. En pantalla completa, Correo incorpora «Agrupar automáticamente» y filtros de Trabajo, Personal, Importante, Finanzas, Boletines, Sin clasificar y Con alertas. Las categorías existentes se conservan. Un mensaje puede aparecer en varias categorías automáticas. Las reglas explican sus motivos en el detalle del mensaje; pueden equivocarse y no sustituyen una decisión del usuario.

La agrupación es local en NexoMail: no aplica automáticamente etiquetas o categorías al buzón del proveedor. Los cambios remotos, envíos y papelera conservan los flujos de aprobación existentes. No se han añadido permisos OAuth ni servicios de reputación externos.

## Revisión de nuevos mensajes

Se analizan los mensajes al cargarse. Gmail revisa los 15 mensajes recientes de Entrada y Outlook los 25 recientes, con revisión cada 60 segundos mientras la aplicación permanece cargada y el navegador la considera visible. No funciona como un servicio de vigilancia cuando el navegador está cerrado. En Outlook la revisión automática se realiza en Entrada; las otras carpetas se analizan al cargarlas. La revisión se pausa durante edición o acciones pendientes/en curso para evitar interferencias.

Los avisos se muestran en una franja accesible también desde Chat en la ventana pequeña. Despliega «Revisar avisos de seguridad» para ver los asuntos y motivos. En la vista de correo, el detalle muestra la evaluación y los dominios detectados.

## Qué detecta

- Enlaces con destino distinto a la URL mostrada, protocolos activos y credenciales ocultando un dominio.
- Direcciones IP, enlaces HTTP, acortadores y dominios internacionalizados que requieren revisión.
- Posibles imitaciones de marcas conocidas y diferencias entre remitente y dirección de respuesta.
- Solicitudes de contraseñas/códigos, presión por un cierre de cuenta o premios que piden pagos.
- Nombres de adjuntos ejecutables, scripts, dobles extensiones y archivos con contenido activo.

El contenido HTML se convierte a texto usando un contenedor inerte, sin insertar el correo en la página, ejecutar scripts ni cargar imágenes externas. El análisis no visita enlaces, no sigue redirecciones ni envía correos a Gemini. Los dominios se muestran como texto; no como enlaces que puedan abrirse accidentalmente.

## Límites que muestra la interfaz

«Sin indicios detectados» no significa «correo seguro». No se verifica la autenticación SPF/DKIM/DMARC ni la reputación de dominios en Internet, no se resuelven acortadores y no se ejecuta un antivirus sobre los archivos. Los datos incompletos o truncados se indican como análisis parcial. El análisis limita el contenido a 120 000 caracteres y 80 enlaces por mensaje. Algunos mensajes legítimos pueden producir avisos y algunas amenazas pueden no detectarse.

Ante una alerta, comprueba el remitente por un canal conocido y accede a los servicios desde sus sitios oficiales. No se eliminan mensajes ni se bloquean cuentas automáticamente.

## Actualización

La versión conserva la carpeta de instalación, los identificadores OAuth y la configuración del servidor. Recarga NexoMail desde la página de extensiones y recarga también las pestañas de Gmail y Outlook. El encabezado debe mostrar v1.7.0.

Compilación de producción realizada para ambas interfaces. No se han ejecutado suites de pruebas ni una prueba de entrega con las cuentas reales.
