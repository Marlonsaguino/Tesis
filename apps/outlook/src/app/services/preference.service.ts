import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  readonly theme = signal<'light' | 'dark'>('light');
  readonly strictMode = signal(false);
  readonly llmEnabled = signal(true);
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem('emailagent.preferences') || '{}');
      this.theme.set(saved.theme === 'dark' ? 'dark' : 'light');
      this.strictMode.set(saved.strictMode === true);
      this.llmEnabled.set(saved.llmEnabled !== false);
    } catch { /* Preferencias inválidas: valores iniciales. */ }
    this.apply();
  }
  update(theme: 'light' | 'dark', strictMode: boolean, llmEnabled: boolean): void {
    this.theme.set(theme); this.strictMode.set(strictMode); this.llmEnabled.set(llmEnabled);
    try { localStorage.setItem('emailagent.preferences', JSON.stringify({ theme, strictMode, llmEnabled })); }
    catch { /* El almacenamiento bloqueado no impide usar la sesión. */ }
    this.apply();
  }
  private apply(): void { document.documentElement.setAttribute('data-theme', this.theme()); }
}
