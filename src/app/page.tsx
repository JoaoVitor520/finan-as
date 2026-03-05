import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span>💑</span>
            <span>Finanças para casais com IA</span>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Gerencie as finanças do<br />
            <span className="text-indigo-600">casal juntos</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            Registre gastos, defina metas individuais e conjuntas, e receba insights
            inteligentes com IA para melhorar sua saúde financeira.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Começar gratuitamente
            </Link>
            <Link
              href="/login"
              className="bg-white text-slate-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm"
            >
              Já tenho conta
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: "📸",
              title: "IA com Gemini",
              desc: "Fotografe comprovantes e a IA extrai automaticamente valor, categoria e data",
            },
            {
              icon: "🎯",
              title: "Metas Conjuntas",
              desc: "Crie metas individuais ou do casal e acompanhe o progresso em tempo real",
            },
            {
              icon: "💡",
              title: "Insights Inteligentes",
              desc: "Receba sugestões personalizadas baseadas nos seus padrões de gastos",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="bg-indigo-600 rounded-2xl p-8 text-white text-center">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: "100%", label: "Gratuito" },
              { value: "IA", label: "Gemini Vision" },
              { value: "∞", label: "Transações" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold mb-1">{s.value}</div>
                <div className="text-indigo-200 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
