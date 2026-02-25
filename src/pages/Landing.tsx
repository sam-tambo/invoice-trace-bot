import { Link } from "react-router-dom";
import {
  Camera,
  Calendar,
  Mail,
  Send,
  RefreshCw,
  Shield,
  ArrowRight,
  CheckCircle2,
  FileText,
  Building2,
  ChevronRight,
  Zap,
  BarChart3,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">InvoiceTrace</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Funcionalidades
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Como Funciona
            </a>
            <a href="#integrations" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Integrações
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm font-medium">
                Entrar
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gap-1.5 text-sm font-semibold">
                Começar Agora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-32">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/3 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Gestão inteligente de faturas para empresas portuguesas
            </div>
            <h1 className="mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Nunca mais perca{" "}
              <span className="bg-gradient-to-r from-primary to-[hsl(230,80%,60%)] bg-clip-text text-transparent">
                uma fatura
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Fotografe, organize e recupere todas as suas faturas automaticamente.
              Sincronize diretamente com o TOConline e partilhe com a sua contabilidade
              — tudo numa única plataforma.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/auth">
                <Button size="lg" className="h-13 gap-2 px-8 text-base font-semibold shadow-lg shadow-primary/25">
                  Começar Gratuitamente
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" className="h-13 px-8 text-base font-medium">
                  Ver Como Funciona
                </Button>
              </a>
            </div>
          </div>

          {/* Hero visual — abstract dashboard mockup */}
          <div className="relative mx-auto mt-16 max-w-5xl lg:mt-20">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-primary/5">
              <div className="rounded-xl border border-border bg-muted/30 p-6 lg:p-10">
                {/* Mock dashboard header */}
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <div className="h-4 w-36 rounded-md bg-foreground/10" />
                    <div className="mt-2 h-3 w-56 rounded-md bg-foreground/5" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 w-24 rounded-lg bg-primary/15" />
                    <div className="h-9 w-9 rounded-lg bg-primary/10" />
                  </div>
                </div>
                {/* Mock stats */}
                <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: "Faturas recuperadas", value: "1.247", icon: FileText },
                    { label: "Fornecedores", value: "89", icon: Building2 },
                    { label: "Emails enviados", value: "342", icon: Mail },
                    { label: "Taxa de resposta", value: "94%", icon: BarChart3 },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <stat.icon className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                      </div>
                      <span className="text-2xl font-bold">{stat.value}</span>
                    </div>
                  ))}
                </div>
                {/* Mock table rows */}
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10" />
                      <div className="flex-1">
                        <div className="h-3 w-32 rounded bg-foreground/10" />
                        <div className="mt-1.5 h-2.5 w-20 rounded bg-foreground/5" />
                      </div>
                      <div className={`h-6 w-20 rounded-full ${i <= 2 ? "bg-[hsl(var(--success))]/15" : i === 3 ? "bg-[hsl(var(--warning))]/15" : "bg-[hsl(var(--destructive))]/15"}`} />
                      <div className="h-3 w-16 rounded bg-foreground/5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-b from-primary/10 via-transparent to-transparent blur-2xl" />
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-border bg-muted/30 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-16">
            {[
              { value: "5.000+", label: "Faturas processadas" },
              { value: "200+", label: "Empresas ativas" },
              { value: "94%", label: "Taxa de recuperação" },
              { value: "< 48h", label: "Tempo médio de resposta" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              Processo simples
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Como funciona
            </h2>
            <p className="text-lg text-muted-foreground">
              Três passos para nunca mais perder uma fatura
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Connecting line */}
            <div className="absolute top-12 left-1/6 hidden h-0.5 w-2/3 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 md:block" />

            {[
              {
                step: "01",
                icon: Camera,
                title: "Importe ou fotografe",
                description:
                  "Importe faturas diretamente do e-Fatura, tire fotografias com o telemóvel, ou faça upload de PDFs. O sistema extrai automaticamente todos os dados.",
              },
              {
                step: "02",
                icon: Mail,
                title: "Recuperação automática",
                description:
                  "O InvoiceTrace analisa o seu Gmail, identifica faturas em falta e envia pedidos automáticos aos fornecedores com modelos personalizáveis.",
              },
              {
                step: "03",
                icon: RefreshCw,
                title: "Organize e sincronize",
                description:
                  "As faturas são organizadas por mês, dia e fornecedor. Sincronize diretamente com o TOConline e partilhe com a contabilidade em segundos.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-lg hover:shadow-primary/5">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="mb-3 text-xl font-bold">{item.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-muted/20 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Funcionalidades
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo o que precisa para gerir faturas
            </h2>
            <p className="text-lg text-muted-foreground">
              Uma plataforma completa desenhada para empresas portuguesas que querem
              controlo total sobre a sua faturação.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Camera,
                title: "Captura por Fotografia",
                description:
                  "Tire uma foto a qualquer fatura com o telemóvel. O OCR inteligente extrai automaticamente número, NIF, valor e data.",
                highlight: true,
              },
              {
                icon: Calendar,
                title: "Organização Inteligente",
                description:
                  "Faturas organizadas automaticamente por mês, dia e fornecedor. Pesquise e filtre com um clique.",
              },
              {
                icon: Mail,
                title: "Integração Gmail",
                description:
                  "Ligação direta ao Gmail para varrimento automático de emails com faturas. Identificação e associação automática.",
              },
              {
                icon: Send,
                title: "Contacto Automático",
                description:
                  "Envie pedidos de faturas em falta aos fornecedores com modelos personalizáveis. Acompanhe respostas em tempo real.",
              },
              {
                icon: RefreshCw,
                title: "Sincronização TOConline",
                description:
                  "Sincronize as suas faturas diretamente com o TOConline. Elimine a entrada manual de dados na contabilidade.",
                highlight: true,
              },
              {
                icon: Shield,
                title: "Portal de Contabilidade",
                description:
                  "Partilhe faturas com o seu contabilista através de um link protegido por password. Acesso seguro e controlado.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className={`group relative rounded-2xl border p-8 transition-all hover:shadow-lg ${
                  feature.highlight
                    ? "border-primary/30 bg-card shadow-md shadow-primary/5"
                    : "border-border bg-card hover:shadow-primary/5"
                }`}
              >
                {feature.highlight && (
                  <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${
                    feature.highlight
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-lg font-bold">{feature.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="grid items-center lg:grid-cols-2">
              <div className="p-10 lg:p-16">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm font-medium text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  Integrações
                </div>
                <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Integra-se com as ferramentas que já usa
                </h2>
                <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
                  Conecte o InvoiceTrace às plataformas que a sua empresa já utiliza.
                  Sem configurações complexas, sem mudanças de fluxo de trabalho.
                </p>
                <ul className="space-y-4">
                  {[
                    "TOConline — Sincronização bidirecional de faturas",
                    "Gmail — Varrimento automático da caixa de entrada",
                    "e-Fatura — Importação direta do portal da AT",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-center bg-muted/30 p-10 lg:p-16">
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { name: "TOConline", icon: RefreshCw },
                    { name: "Gmail", icon: Mail },
                    { name: "e-Fatura", icon: FileText },
                    { name: "Portal AT", icon: Building2 },
                  ].map((integration) => (
                    <div
                      key={integration.name}
                      className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:h-32 sm:w-32"
                    >
                      <integration.icon className="h-8 w-8 text-primary" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {integration.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/20 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Comece a recuperar faturas{" "}
              <span className="bg-gradient-to-r from-primary to-[hsl(230,80%,60%)] bg-clip-text text-transparent">
                hoje
              </span>
            </h2>
            <p className="mb-10 text-lg text-muted-foreground">
              Junte-se a centenas de empresas portuguesas que já utilizam o InvoiceTrace
              para eliminar faturas perdidas e simplificar a contabilidade.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/auth">
                <Button size="lg" className="h-13 gap-2 px-10 text-base font-semibold shadow-lg shadow-primary/25">
                  Criar Conta Gratuita
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Sem cartão de crédito · Configuração em 2 minutos
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">InvoiceTrace</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} InvoiceTrace. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
