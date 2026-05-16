export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <svg viewBox="0 0 340 110" className="w-full h-auto mb-12" xmlns="http://www.w3.org/2000/svg" aria-label="Direct Desk Solutions">
          <polygon points="5,10 100,55 5,100 25,55" fill="#E5202A" />
          <polygon points="25,55 60,55 45,75" fill="#000" />
          <text x="115" y="68" fontFamily="system-ui, -apple-system, sans-serif" fontSize="58" fontWeight="900" fill="#fff" fontStyle="italic">Direct</text>
          <text x="115" y="98" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fontWeight="800" letterSpacing="3" fill="#fff">DESK SOLUTIONS</text>
        </svg>
        <div className="text-xs tracking-[0.22em] uppercase mb-4" style={{ color: "#E5202A" }}>
          Under construction
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-6">
          A smarter source for office furniture.
        </h1>
        <p className="text-stone-400 text-sm leading-relaxed mb-10">
          Our new home is being built. New and pre-owned office furniture, delivered across the UK.
        </p>
        <a href="mailto:info@directdesksolutions.com" className="inline-block text-xs tracking-[0.18em] uppercase font-bold border-b-2 border-white pb-1 hover:opacity-70 transition-opacity">
          info@directdesksolutions.com
        </a>
      </div>
      <footer className="absolute bottom-6 text-[10px] tracking-[0.2em] uppercase text-stone-600">
        © 2026 Direct Desk Solutions Ltd
      </footer>
    </main>
  );
}
