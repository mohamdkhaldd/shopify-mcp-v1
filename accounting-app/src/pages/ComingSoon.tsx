import Icon from "../components/Icon";

interface ComingSoonProps {
  title: string;
  icon: string;
  note: string;
}

export default function ComingSoon({ title, icon, note }: ComingSoonProps) {
  return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-light text-primary flex items-center justify-center mb-4">
        <Icon name={icon} className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-extrabold text-slate-800">{title}</h1>
      <p className="text-sm text-slate-400 mt-2 max-w-sm">{note}</p>
    </div>
  );
}
