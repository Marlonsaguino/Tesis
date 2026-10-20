import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OutlookCategory, PendingAction } from '../models/outlook.model';

export interface AgentChatResponseDTO {
  reply: string;
  engine: 'rules' | 'llm';
  llm_provider?: string | null;
  model_name?: string | null;
  proposed_actions: PendingAction[];
  suggested_prompts: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AgentClientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/agent`;

  getConfiguration(): Observable<{provider:string;model:string;configured:boolean;verified:boolean;max_output_tokens:number;message_limit:number}> {
    return this.http.get<{provider:string;model:string;configured:boolean;verified:boolean;max_output_tokens:number;message_limit:number}>(`${this.baseUrl}/config`);
  }

  /**
   * Envía la consulta del usuario a FastAPI con el contexto de correos (sin tokens MSAL).
   */
  chat(payload: {
    message: string;
    context_emails: Array<{
      id: string;
      subject: string;
      sender: string;
      sender_address?: string;
      body_text?: string;
      preview: string;
      date?: string;
      isRead?: boolean;
      categories?: string[];
    }>;
    mode: 'real' | 'simulated';
    use_llm?: boolean;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    selected_email_id?: string | null;
  }): Observable<AgentChatResponseDTO> {
    return this.http.post<AgentChatResponseDTO>(`${this.baseUrl}/chat`, payload);
  }

  /**
   * Obtiene el catálogo de demostración de categorías de Outlook.
   */
  getCategories(): Observable<OutlookCategory[]> {
    return this.http.get<OutlookCategory[]>(`${this.baseUrl}/categories`);
  }
}
