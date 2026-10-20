# EmailAgent AI

Asistente de correo con **LLM + tool calling**, guardrails human-in-the-loop, bandeja simulada o Gmail real.

---

## Modos de Ejecución del Agente

Puedes ejecutar el agente de **forma 100% local con Ollama** (sin costo de tokens, sin límite de cuotas y totalmente privado) o con proveedores en la nube (**Google Gemini** u **OpenAI**).

---

## 🦙 Opción 1: Ollama (100% Local y Sin Costo de Tokens) — Recomendado

Esta opción corre los modelos en tu máquina local mediante la API de Ollama:

### 1. Instalar Ollama en Windows
Puedes instalarlo mediante winget en PowerShell:
```powershell
winget install Ollama.Ollama
```
O descargando el instalador oficial desde [ollama.com/download](https://ollama.com/download).

### 2. Descargar un modelo con soporte de herramientas (Function Calling)
Abre una terminal PowerShell y descarga uno de los modelos recomendados:

```powershell
# Opción A: Llama 3.2 (Recomendado: ligero ~2 GB, rápido y con soporte nativo de tools)
ollama pull llama3.2

# Opción B: Qwen 2.5 7B (Excelente fluidez en español y gran precisión en tools)
ollama pull qwen2.5:7b

# Opción C: Llama 3.1 8B (Gran capacidad de razonamiento)
ollama pull llama3.1:8b
```

### 3. Configurar `.env`
En tu archivo `.env`:
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2
```

¡Listo! No necesitas ninguna API key ni tarjeta de crédito.

---

## ☁️ Opción 2: Google Gemini (Nube con Capa Gratuita)

Si prefieres usar los modelos de Gemini en la nube:
1. Obtén tu clave gratuita en [Google AI Studio](https://aistudio.google.com/apikey).
2. En `.env`:
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=tu_api_key_aqui
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
OPENAI_MODEL=gemini-2.0-flash
```

---

## ⚡ Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:5173/](http://localhost:5173/) en tu navegador.

---

## 🛡️ Guardrails y Seguridad (Human-in-the-Loop)

- El agente **nunca** envía ni borra correos automáticamente.
- Cualquier acción sensible (`prepare_send_email`, `prepare_bulk_cleanup`) crea una entrada en **Acciones Pendientes**.
- Tú debes revisar y hacer clic en **Autorizar y Ejecutar** o **Rechazar**.
- El **Modo Estricto** exige autorización incluso para cambios de etiquetas.

---

## 📬 Conexión con Gmail Real (Opcional)

Por defecto, la aplicación incluye una bandeja simulada interactiva con correos de prueba. Si deseas conectar tu Gmail real:
1. Crea credenciales OAuth en Google Cloud Console habilitando la API de Gmail.
2. En la barra superior, haz clic en **Modo Simulado (Conectar)**.
3. Ingresa tu Client ID o pega un access token de prueba.

---

## 🛠️ Variables de Entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `LLM_PROVIDER` | Proveedor activo (`ollama`, `gemini`, `openai`) | `ollama` |
| `OLLAMA_BASE_URL` | Endpoint OpenAI-compatible de Ollama | `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | Nombre del modelo local instalado | `llama3.2` |
| `GEMINI_API_KEY` | Clave API de Google AI Studio | (opcional) |
| `OPENAI_API_KEY` | Clave API de OpenAI | (opcional) |
# Módulo Gmail integrado

Esta carpeta contiene las fuentes React adaptadas a la extensión. Para instalar y usar esta entrega, sigue el README de la raíz del proyecto EmailAgent. El servidor de desarrollo Vite independiente ya no es el punto de entrada de la aplicación integrada.

La API de IA se sirve desde el backend compartido y las autorizaciones se configuran en las opciones de la extensión. No coloques claves de IA en esta carpeta ni en variables VITE.

---

## Documentación histórica del proyecto base

