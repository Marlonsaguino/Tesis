// Configuración de entorno para el Agente IA Outlook
export const environment = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000',
  azure: {
    // Application (client) ID registrado en Azure Portal para Agente IA Outlook
    clientId: '8e0d59dc-8a0f-4239-bab3-c82a0c145ac4',
    // Autoridad para cuentas personales y de cualquier organización
    authority: 'https://login.microsoftonline.com/common',
    // URI de redirección registrada en la plataforma SPA
    redirectUri: 'http://localhost:4200',
    // Permisos delegados solicitados para lectura y perfil
    scopes: ['User.Read', 'Mail.Read'],
    // Permisos necesarios para acciones aprobadas (Human-in-the-Loop)
    actionScopes: {
      send: ['Mail.Send'],
      write: ['Mail.ReadWrite']
    }
  },
  graph: {
    baseUrl: 'https://graph.microsoft.com/v1.0',
    messagesEndpoint: 'https://graph.microsoft.com/v1.0/me/messages?$top=25&$select=id,subject,from,receivedDateTime,isRead,bodyPreview,categories&$orderby=receivedDateTime desc',
    userEndpoint: 'https://graph.microsoft.com/v1.0/me'
  }
};
