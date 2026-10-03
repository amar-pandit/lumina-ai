import { DemoControls } from "@/components/layout/DemoControls";

interface TopbarProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  workspace?: "Student" | "Faculty" | "Institution";
}

export function Topbar({ title, subtitle, workspace = "Student" }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-white/10 bg-[#0a1112]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase text-emerald-200/80">Lumina AI <span className="px-1.5 text-zinc-600">/</span> {workspace} workspace</p>
        <h1 className="mt-1.5 text-2xl font-semibold text-white sm:text-[28px]">{title}</h1>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      <DemoControls />
    </header>
  );
}
