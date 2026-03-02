import { AssiAirWidget } from '@/widget/assiair-widget';

export default function Home() {
  return (
    <main
      className="flex min-h-[100dvh] items-start justify-center p-4 pt-8 max-sm:p-0 max-sm:pt-0 max-sm:items-stretch overflow-y-auto"
      style={{ background: '#e8e8ef' }}
    >
      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none max-sm:hidden"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Widget */}
      <div className="relative z-10 max-sm:w-full max-sm:h-[100dvh]">
        <AssiAirWidget
          apiEndpoint="/api"
          theme="light"
          defaultTab="chat"
          width="480px"
          height="700px"
          className="max-sm:!w-full max-sm:!h-[100dvh] max-sm:!rounded-none max-sm:!border-0 max-sm:!shadow-none"
        />
      </div>
    </main>
  );
}
