export function detectPlatform(raw) {
  try { const url=new URL(raw); if(url.protocol!=='https:') return null;
    if(url.hostname==='mail.google.com') return 'gmail';
    if(['outlook.live.com','outlook.office.com','outlook.office365.com','outlook.cloud.microsoft'].includes(url.hostname)) return 'outlook';
  } catch {} return null;
}
