interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
}

export default function EmptyState({ icon = "✈️", title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-5 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="mt-2 font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
