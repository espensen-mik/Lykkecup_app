export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-white text-black print:bg-white">{children}</div>;
}
