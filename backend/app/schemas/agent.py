"""Contratos del agente: propuestas tipadas y contexto limitado, sin credenciales de correo."""
from typing import Literal, Any
from pydantic import BaseModel, Field, model_validator

ActionType = Literal['SEND_EMAIL','DELETE_EMAIL','ADD_CATEGORY','MARK_AS_READ','MARK_AS_UNREAD','MOVE_EMAIL','SET_FLAG']
class EmailContextItem(BaseModel):
    id: str = Field(min_length=1,max_length=2048)
    subject: str = Field(default='',max_length=2000)
    sender: str = Field(default='',max_length=1000)
    sender_address: str = Field(default='',max_length=320)
    preview: str = Field(default='',max_length=10000)
    body_text: str = Field(default='',max_length=20000)
    date: str | None = None
    isRead: bool | None = None
    categories: list[str] = Field(default_factory=list,max_length=100)

class ProposedAction(BaseModel):
    id: str
    action_type: ActionType
    description: str = Field(max_length=2000)
    provider: Literal['microsoft'] = 'microsoft'
    mode: Literal['real','simulated'] = 'simulated'
    parameters: dict[str,Any] = Field(default_factory=dict)
    requires_approval: Literal[True] = True
    @model_validator(mode='after')
    def validate_parameters(self):
        required = {'SEND_EMAIL':('to','body'), 'DELETE_EMAIL':('messageId',), 'ADD_CATEGORY':('messageId','category'),
                    'MARK_AS_READ':('messageId',), 'MARK_AS_UNREAD':('messageId',), 'MOVE_EMAIL':('messageId','folder'), 'SET_FLAG':('messageId','flagged')}
        for key in required[self.action_type]:
            if key not in self.parameters: raise ValueError('Falta el parámetro '+key)
        if self.action_type == 'SET_FLAG' and not isinstance(self.parameters['flagged'],bool): raise ValueError('flagged debe ser booleano')
        return self

class ChatMessage(BaseModel):
    role: Literal['user','assistant']
    content: str = Field(max_length=20000)
class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1,max_length=4000)
    context_emails: list[EmailContextItem] = Field(default_factory=list,max_length=100)
    mode: Literal['real','simulated'] = 'simulated'
    history: list[ChatMessage] = Field(default_factory=list,max_length=12)
    selected_email_id: str | None = None
    use_llm: bool = False
class AgentChatResponse(BaseModel):
    reply: str = Field(max_length=40000)
    proposed_actions: list[ProposedAction] = Field(default_factory=list,max_length=100)
    suggested_prompts: list[str] = Field(default_factory=list,max_length=8)
    engine: Literal['rules','llm'] = 'rules'
    llm_provider: str | None = None
    model_name: str | None = None
class CategoryMapping(BaseModel):
    id: str
    label: str
    color: str
    description: str
