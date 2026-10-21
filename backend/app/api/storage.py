"""All account identifiers come from a provider-verified access token, never a client email."""
from datetime import datetime, timezone
from typing import Literal, Any
import hashlib,json,time,uuid,threading
from urllib.request import Request,urlopen,HTTPRedirectHandler,build_opener
from urllib.error import HTTPError,URLError
from fastapi import APIRouter,Header,HTTPException
from pydantic import BaseModel,ConfigDict,Field,ValidationError
from app.storage.database import database

router=APIRouter(prefix='/storage',tags=['PostgreSQL'])
Provider=Literal['gmail','microsoft']
Section=Literal['chat','drafts','preferences']
_profiles:dict[tuple[str,str],tuple[float,dict]]={}
_profile_lock=threading.Lock()

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def identity(provider:Provider,authorization:str):
    if not authorization.startswith('Bearer ') or len(authorization)>16000:
        raise HTTPException(401,'Autoriza tu cuenta antes de utilizar el almacenamiento.')
    token=authorization[7:]
    if not token or any(c in token for c in '\r\n'):
        raise HTTPException(401,'La autorización de la cuenta no es válida.')
    key=(provider,hashlib.sha256(token.encode()).hexdigest())
    with _profile_lock:
        cached=_profiles.get(key)
        if cached and cached[0]>time.monotonic():return cached[1]
    url='https://gmail.googleapis.com/gmail/v1/users/me/profile' if provider=='gmail' else 'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName'
    try:
        with build_opener(NoRedirect()).open(Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/json'}),timeout=10) as response:
            profile=json.loads(response.read(32000))
    except HTTPError as error:
        raise HTTPException(401 if error.code in (401,403) else 503,'No se pudo verificar la cuenta con el proveedor. Renueva la autorización o vuelve a intentarlo.') from None
    except (URLError,TimeoutError,ValueError):
        raise HTTPException(503,'El proveedor no respondió al verificar la cuenta. No se accedió a otros historiales.') from None
    email=(profile.get('emailAddress') if provider=='gmail' else profile.get('mail') or profile.get('userPrincipalName') or '').strip().lower()
    subject=email if provider=='gmail' else profile.get('id','')
    if not email or not subject or len(email)>320 or len(subject)>512:
        raise HTTPException(401,'El proveedor no devolvió una identidad de cuenta válida.')
    value={'provider':provider,'subject':subject,'email':email,'name':str(profile.get('displayName',''))[:300]}
    with _profile_lock:
        # Cache only fingerprints and public identity, not the bearer token.
        now=time.monotonic()
        for existing in list(_profiles):
            if _profiles[existing][0]<=now:_profiles.pop(existing,None)
        if len(_profiles)>=256:_profiles.clear()
        _profiles[key]=(now+45,value)
    return value

class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid')
class ChatRecord(Strict):
    id:str=Field(min_length=1,max_length=150)
    role:Literal['user','assistant']
    content:str=Field(max_length=20000)
    created_at:datetime
class DraftRecord(Strict):
    id:str=Field(min_length=1,max_length=150)
    to:str=Field(default='',max_length=2000)
    cc:str=Field(default='',max_length=2000)
    bcc:str=Field(default='',max_length=2000)
    subject:str=Field(default='',max_length=998)
    body:str=Field(default='',max_length=30000)
    reply_to_id:str|None=Field(default=None,max_length=1024)
    attachments_omitted:bool=False
    created_at:datetime
class Preferences(Strict):
    theme:Literal['light','dark']='light'
    strict_mode:bool=True
    llm_enabled:bool=True
    auto_grouping:bool=True
class WriteSection(Strict):
    revision:int=Field(ge=0,le=2147483646)
    data:Any
class AuditRecord(Strict):
    id:str=Field(min_length=1,max_length=150)
    action_type:str=Field(min_length=1,max_length=80)
    status:str=Field(min_length=1,max_length=80)
    description:str=Field(default='',max_length=2000)
    details:str=Field(default='',max_length=4000)
    occurred_at:datetime
class AuditBatch(Strict):
    events:list[AuditRecord]=Field(max_length=100)

def account(connection,profile):
    return connection.execute('''INSERT INTO nexomail.accounts(id,provider,provider_subject,email,display_name)
        VALUES(%s,%s,%s,%s,%s) ON CONFLICT(provider,provider_subject) DO UPDATE
        SET email=excluded.email,display_name=excluded.display_name,last_seen_at=now() RETURNING id''',
        (uuid.uuid4(),profile['provider'],profile['subject'],profile['email'],profile['name'])).fetchone()['id']

def utc(value:datetime):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

@router.get('/{provider}/workspace')
def load_workspace(provider:Provider,authorization:str=Header(default='')):
    profile=identity(provider,authorization)
    with database() as connection:
        aid=account(connection,profile)
        versions={row['section']:row['revision'] for row in connection.execute('SELECT section,revision FROM nexomail.workspace_versions WHERE account_id=%s',(aid,))}
        chat=[{'id':row['message_id'],'role':row['role'],'content':row['content'],'created_at':row['created_at']} for row in connection.execute('SELECT * FROM nexomail.chat_messages WHERE account_id=%s ORDER BY position',(aid,))]
        drafts=[{'id':row['draft_id'],'to':row['recipient'],'cc':row['cc'],'bcc':row['bcc'],'subject':row['subject'],'body':row['body'],'reply_to_id':row['reply_to_id'],'attachments_omitted':row['attachments_omitted'],'created_at':row['created_at']} for row in connection.execute('SELECT * FROM nexomail.mail_drafts WHERE account_id=%s ORDER BY updated_at DESC',(aid,))]
        preferences=connection.execute('SELECT theme,strict_mode,llm_enabled,auto_grouping FROM nexomail.user_preferences WHERE account_id=%s',(aid,)).fetchone()
        audits=[{'id':row['event_id'],'action_type':row['action_type'],'status':row['status'],'description':row['description'],'details':row['details'],'occurred_at':row['occurred_at']} for row in connection.execute('SELECT * FROM nexomail.audit_events WHERE account_id=%s ORDER BY occurred_at DESC LIMIT 500',(aid,))]
        return {'account':{'provider':provider,'email':profile['email']},'sections':{
            name:{'revision':versions.get(name,0),'data':data} for name,data in [('chat',chat),('drafts',drafts),('preferences',preferences)]},'audit':audits}

@router.post('/{provider}/workspace/{section}')
def write_section(provider:Provider,section:Section,body:WriteSection,authorization:str=Header(default='')):
    try:
        if section=='preferences':data=Preferences.model_validate(body.data)
        else:
            if not isinstance(body.data,list) or len(body.data)>(100 if section=='chat' else 50):raise ValueError()
            model=ChatRecord if section=='chat' else DraftRecord
            data=[model.model_validate(item) for item in body.data]
            if len({item.id for item in data})!=len(data):raise ValueError()
    except (ValueError,ValidationError):
        raise HTTPException(422,'El contenido del historial o borrador no tiene un formato válido o supera el límite.') from None
    profile=identity(provider,authorization)
    with database() as connection:
        aid=account(connection,profile)
        connection.execute('INSERT INTO nexomail.workspace_versions(account_id,section) VALUES(%s,%s) ON CONFLICT DO NOTHING',(aid,section))
        revision=connection.execute('SELECT revision FROM nexomail.workspace_versions WHERE account_id=%s AND section=%s FOR UPDATE',(aid,section)).fetchone()['revision']
        if revision!=body.revision:
            raise HTTPException(409,'Otra ventana cambió estos datos. Recarga NexoMail para recuperar la versión guardada; no se sobrescribieron los cambios.')
        if section=='chat':
            connection.execute('DELETE FROM nexomail.chat_messages WHERE account_id=%s',(aid,))
            for position,item in enumerate(data):connection.execute('INSERT INTO nexomail.chat_messages(account_id,message_id,role,content,created_at,position) VALUES(%s,%s,%s,%s,%s,%s)',(aid,item.id,item.role,item.content,utc(item.created_at),position))
        elif section=='drafts':
            connection.execute('DELETE FROM nexomail.mail_drafts WHERE account_id=%s',(aid,))
            for item in data:connection.execute('INSERT INTO nexomail.mail_drafts(account_id,draft_id,recipient,cc,bcc,subject,body,reply_to_id,attachments_omitted,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(aid,item.id,item.to,item.cc,item.bcc,item.subject,item.body,item.reply_to_id,item.attachments_omitted,utc(item.created_at)))
        else:
            connection.execute('''INSERT INTO nexomail.user_preferences(account_id,theme,strict_mode,llm_enabled,auto_grouping) VALUES(%s,%s,%s,%s,%s)
                ON CONFLICT(account_id) DO UPDATE SET theme=excluded.theme,strict_mode=excluded.strict_mode,llm_enabled=excluded.llm_enabled,auto_grouping=excluded.auto_grouping''',(aid,data.theme,data.strict_mode,data.llm_enabled,data.auto_grouping))
        connection.execute('UPDATE nexomail.workspace_versions SET revision=revision+1,updated_at=now() WHERE account_id=%s AND section=%s',(aid,section))
        return {'revision':revision+1,'saved':True}

@router.post('/{provider}/audit')
def append_audit(provider:Provider,body:AuditBatch,authorization:str=Header(default='')):
    profile=identity(provider,authorization)
    with database() as connection:
        aid=account(connection,profile)
        for event in body.events:
            connection.execute('''INSERT INTO nexomail.audit_events(account_id,event_id,action_type,status,description,details,occurred_at)
                VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING''',(aid,event.id,event.action_type,event.status,event.description,event.details,utc(event.occurred_at)))
    return {'saved':True}

@router.post('/{provider}/erase')
def erase_workspace(provider:Provider,authorization:str=Header(default='')):
    profile=identity(provider,authorization)
    with database() as connection:
        # An exclusive account lock prevents a concurrent save interleaving with deletion.
        aid=account(connection,profile)
        connection.execute('DELETE FROM nexomail.chat_messages WHERE account_id=%s',(aid,))
        connection.execute('DELETE FROM nexomail.mail_drafts WHERE account_id=%s',(aid,))
        connection.execute('DELETE FROM nexomail.user_preferences WHERE account_id=%s',(aid,))
        connection.execute('DELETE FROM nexomail.audit_events WHERE account_id=%s',(aid,))
        for section in ('chat','drafts','preferences'):
            connection.execute('''INSERT INTO nexomail.workspace_versions(account_id,section,revision) VALUES(%s,%s,1)
                ON CONFLICT(account_id,section) DO UPDATE SET revision=nexomail.workspace_versions.revision+1,updated_at=now()''',(aid,section))
    return {'erased':True}
