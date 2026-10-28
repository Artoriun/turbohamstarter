import { HamsterLawyer } from '../components/HamsterLawyer';
import { useT } from '../i18n';

export default function Privacy() {
  const t = useT();
  return (
    <div className="page prose">
      <h1 className="title-accent">{t.privacy.title}</h1>
      <p>{t.privacy.body}</p>
      <HamsterLawyer />
    </div>
  );
}
