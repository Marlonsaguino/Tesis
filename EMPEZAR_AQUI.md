# Instalación inicial

1. Extrae el proyecto completo.
2. Abre `chrome://extensions`, `edge://extensions` o `brave://extensions`.
3. Activa **Modo de desarrollador** y pulsa **Cargar descomprimida**.
4. Selecciona la carpeta **extension**, la que contiene `manifest.json`.
5. Abre las **Opciones** de EmailAgent. Allí aparecen las direcciones de retorno que debes registrar en Google y Microsoft. Sigue el apartado 2 del README.
6. Ejecuta **CONFIGURAR_SERVIDOR.cmd**. Completa el proveedor en `backend/.env` y copia su `EXTENSION_ACCESS_TOKEN` al campo Clave de enlace de las opciones.
7. Ejecuta **INICIAR_SERVIDOR.cmd**. Déjalo abierto si vas a consultar a la IA.
8. Abre Gmail u Outlook, actualiza la página y pulsa la **burbuja azul de EmailAgent**.
9. Autoriza la cuenta dentro del asistente y comprueba que sea la que deseas utilizar.

Las dos interfaces ya están compiladas. No necesitas ejecutar los antiguos frontends ni recompilar para instalar esta entrega.

La instalación en tu navegador y las autorizaciones reales siguen pendientes de comprobar. La sesión abierta en Gmail/Outlook no autoriza automáticamente a la extensión.

Consulta `README.md` para los pasos de Google/Microsoft, las dependencias y la solución de errores.
