# Actualización 1.1: Gmail sin copiar tokens

1. Conserva la carpeta actual de tu proyecto y su backend/.env.
2. Extrae el proyecto actualizado y copia la carpeta extension nueva sobre la carpeta extension actual. Si editas fuentes, copia también apps/gmail.
3. En la página de extensiones del navegador pulsa Recargar sobre EmailAgent. No necesitas quitar la extensión ni cambiar su ID.
4. Actualiza la pestaña de Gmail. La primera vez con esta versión pulsa Autorizar con Google para recordar tu cuenta.
5. Después, al abrir el panel, recuperará la cuenta y tratará de renovar el acceso sin mostrar una ventana.
6. Si Google exige confirmación, pulsa Reautorizar con Google. No tienes que copiar ningún token.

Si cambiaste la carpeta desde la que cargas la extensión y cambió su ID, revisa el retorno OAuth en las opciones. No elimines tu backend/.env ni reemplaces tus claves.

Desconectar esta cuenta elimina la sesión recordada de Gmail en la extensión. No cierra Gmail en el navegador ni revoca por sí mismo el consentimiento de Google.

La compilación y la sintaxis se comprobaron. Queda pendiente comprobar la autorización y renovación reales en tu navegador.
