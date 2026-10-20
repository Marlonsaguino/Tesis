"""Motor de reglas explícito. Las propuestas nunca ejecutan operaciones de correo."""
import re
import uuid
import unicodedata
from email.utils import parseaddr
from app.schemas.agent import AgentChatRequest, AgentChatResponse, ProposedAction, CategoryMapping

def norm(value: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD',value.lower()) if unicodedata.category(c) != 'Mn')

CATEGORIES = [CategoryMapping(id=name,label=name,color=color,description=description) for name,color,description in [
    ('Trabajo','#0078d4','Laboral o académico'),('Personal','#107c41','Contactos personales'),
    ('Importante','#d83b01','Revisión prioritaria'),('Finanzas','#008272','Pagos y comprobantes'),('Boletines','#5c2d91','Novedades y suscripciones')]]

class AgentService:
    @classmethod
    def get_categories(cls): return CATEGORIES
    @classmethod
    def process_chat(cls, req: AgentChatRequest) -> AgentChatResponse:
        if req.use_llm:
            from app.services.llm_service import process_with_llm
            return process_with_llm(req)
        prompt=norm(req.message.strip())
        if re.search(r'\b(no|nunca|evita)\b.*\b(elimin|borr|envi|mand|mov|archiv|marc|clasif|categ)',prompt):
            return cls._response('No propuse cambios. Indica qué consulta deseas realizar o usa las acciones del correo para preparar una propuesta explícita.')
        emails=req.context_emails
        selected=next((e for e in emails if e.id==req.selected_email_id),None)
        targets=[e for e in emails if e.isRead is False] if 'no leidos' in prompt or 'sin leer' in prompt else ([selected] if selected else [])
        if any(w in prompt for w in ['clasifica','clasificar','categoriza','categorizar','etiqueta','asigna la categoria']):
            if not targets: return cls._response('Selecciona un correo o pide clasificar los no leídos. No modificaré un mensaje elegido por defecto.')
            explicit=next((c.id for c in CATEGORIES if norm(c.id) in prompt),None)
            actions=[]
            for email in targets:
                text=norm(email.subject+' '+email.preview)
                category=explicit or ('Finanzas' if any(w in text for w in ['pago','factura','comprobante']) else 'Boletines' if any(w in text for w in ['newsletter','novedades','suscripcion']) else 'Importante' if any(w in text for w in ['urgente','vence','plazo']) else 'Trabajo')
                actions.append(cls._action(req,'ADD_CATEGORY',f'Agregar {category}: {email.subject}',{'messageId':email.id,'category':category,'subject':email.subject}))
            return cls._response(f'Preparé {len(actions)} propuestas independientes con clasificación por reglas. Revísalas antes de aprobar.',actions)
        read_request=bool(re.search(r'\bmarca(?:r)?\b.*\b(?:leido|leida|leidos|leidas)\b',prompt))
        if read_request or any(w in prompt for w in ['elimina','eliminar','borra','borrar','papelera','archiva','mueve','restaura','destaca']):
            if not targets: return cls._response('Selecciona el correo que deseas modificar o indica los no leídos.')
            if any(w in prompt for w in ['elimina','eliminar','borra','borrar','papelera']): kind='DELETE_EMAIL'; extra={}; description='Mover a papelera'
            elif 'archiva' in prompt: kind='MOVE_EMAIL'; extra={'folder':'archive'}; description='Archivar'
            elif 'restaura' in prompt or 'bandeja' in prompt: kind='MOVE_EMAIL'; extra={'folder':'inbox'}; description='Mover a entrada'
            elif 'destaca' in prompt: kind='SET_FLAG'; extra={'flagged':True}; description='Destacar'
            elif 'mueve' in prompt: return cls._response('Elige la carpeta de destino desde los controles del correo.')
            else:
                unread='no leido' in prompt or 'no leida' in prompt
                kind='MARK_AS_UNREAD' if unread else 'MARK_AS_READ'; extra={}; description='Marcar no leído' if unread else 'Marcar leído'
            return cls._response('Propuestas listas para revisión. No se ejecutó ningún cambio.',[cls._action(req,kind,f'{description}: {e.subject}',{'messageId':e.id,'subject':e.subject,**extra}) for e in targets])
        if any(w in prompt for w in ['redacta','responde','responder','escribe','envia','enviar','manda','correo a']):
            found=re.findall(r'[^\s<>;,]+@[^\s<>;,]+\.[^\s<>;,]+',req.message)
            address=found[0].rstrip('.,') if found else parseaddr(selected.sender_address or selected.sender)[1] if selected else ''
            if not address: return cls._response('Indica el destinatario o selecciona el correo que deseas responder. No usaré una dirección de ejemplo.')
            subject=('Re: '+selected.subject if not selected.subject.lower().startswith('re:') else selected.subject) if selected else ''
            body=f'Estimado/a:\n\nGracias por su mensaje sobre «{selected.subject}».\n\n[Completa aquí tu respuesta antes de enviarla.]\n\nSaludos cordiales.' if selected else '[Escribe aquí el contenido del mensaje.]'
            action=cls._action(req,'SEND_EMAIL','Revisar borrador antes de preparar envío',{'to':address,'cc':'','bcc':'','subject':subject,'body':body,'replyToId':selected.id if selected else None})
            return cls._response('Abrí un borrador con una plantilla del motor de reglas. Edita el contenido y prepara la propuesta; después podrás aprobar el envío.',[action])
        if any(w in prompt for w in ['urgente','importante','prioridad']):
            matches=[e for e in emails if any(w in norm(e.subject+' '+e.preview) for w in ['urgente','vence','plazo','importante']) or 'Importante' in e.categories]
            return cls._response('Coincidencias por palabras clave (no es una evaluación semántica):\n'+'\n'.join(f'• {e.subject} — {e.sender}' for e in matches) if matches else 'No encontré indicadores de urgencia en los correos cargados.')
        if any(w in prompt for w in ['busca','buscar','tengo algo de']):
            terms=[w for w in re.findall(r'\w+',prompt) if len(w)>2 and w not in ['busca','buscar','correos','correo','tengo','algo','sobre','los','las','del','con']]
            matches=[e for e in emails if terms and all(w in norm(e.subject+' '+e.sender+' '+e.preview) for w in terms)]
            return cls._response('Resultados en los mensajes cargados:\n'+'\n'.join(f'• {e.subject} — {e.sender}' for e in matches) if matches else 'No hay coincidencias en los mensajes cargados. Prueba menos términos o carga más correos.')
        if any(w in prompt for w in ['resume','resumen','revisa','analiza','que tengo']):
            scope=([selected] if selected and ('seleccionado' in prompt or 'este correo' in prompt) else [e for e in emails if e.isRead is False] if 'pendiente' in prompt or 'sin leer' in prompt or 'no leidos' in prompt else emails)
            return cls._response('Vista previa por reglas; no es un resumen LLM:\n'+'\n\n'.join(f'• {e.subject} — {e.sender}\n{e.preview[:250]}' for e in scope[:20]) if scope else 'No hay mensajes en el conjunto solicitado.')
        return cls._response('Motor de reglas activo. Puedes buscar, ver un resumen de vistas previas, redactar un borrador o proponer cambios sobre un correo seleccionado. Usa Configuración si deseas autorizar un LLM configurado en el servidor.')
    @staticmethod
    def _action(req, kind, description, parameters):
        return ProposedAction(id=str(uuid.uuid4()),action_type=kind,description=description,mode=req.mode,parameters=parameters)
    @staticmethod
    def _response(reply,actions=None):
        return AgentChatResponse(reply=reply,proposed_actions=actions or [],suggested_prompts=['Resume mis correos pendientes','Ver acciones pendientes','Redactar un correo'],engine='rules')
