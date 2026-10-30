import { ArrowUpRight, Github, LockKeyhole } from "lucide-react";

const errors: Record<string, string> = {
  not_allowed: "Dieses GitHub-Konto hat keinen Zugriff. Bitte melde dich mit erikivanov an.",
  invalid_state: "Die Anmeldung ist abgelaufen oder ungültig. Bitte starte sie erneut.",
  cancelled: "Die GitHub-Anmeldung wurde abgebrochen. Du kannst es jederzeit erneut versuchen.",
  failed: "Die Anmeldung hat nicht geklappt. Bitte versuche es erneut.",
  not_configured: "Die GitHub-Anmeldung ist noch nicht eingerichtet.",
  required: "Bitte melde dich an, um deinen Arbeitsbereich zu öffnen.",
};
export default function LoginPage({ configured, error }: { configured: boolean; error?: string }) {
  return <main className="login-page">
    <header className="login-header"><a href="/" className="dashboard-brand" aria-label="Whiteboard Startseite">whiteboard</a><span><LockKeyhole size={14} /> Dein privater Arbeitsbereich</span></header>
    <div className="login-background" aria-hidden="true"><div className="login-note note-one">Platz für<br />einen Gedanken.</div><div className="login-note note-two">Und für den<br />nächsten.</div><span className="login-asterisk">✳</span></div>
    <section className="login-card" aria-labelledby="login-title">
      <h1 id="login-title">Dein Raum für Ideen.</h1>
      <p>Melde dich an, um deine Boards zu öffnen und neue Ideen festzuhalten.</p>
      {error && errors[error] && <div className="login-error" role="alert">{errors[error]}</div>}
      {configured ? <a className="github-login-button" href="/api/auth/github"><Github size={19} /><span>Mit GitHub anmelden</span><ArrowUpRight size={17} /></a> : <><button className="github-login-button" disabled><Github size={19} /><span>Mit GitHub anmelden</span></button><p className="login-setup" role="status">Die GitHub-Anmeldung wird gerade eingerichtet.</p></>}
    </section>
  </main>;
}
