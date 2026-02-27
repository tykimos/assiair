import { AssiAirWidget } from '@/widget/assiair-widget';

export default function Home() {
  return (
    <main
      className="flex min-h-screen items-start justify-center p-4 pt-8 overflow-y-auto"
      style={{ background: '#e8e8ef' }}
    >
      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Widget */}
      <div className="relative z-10">
        <AssiAirWidget
          apiEndpoint="/api"
          theme="light"
          defaultTab="chat"
          width="480px"
          height="700px"
        />
      </div>
    </main>
  );
}
