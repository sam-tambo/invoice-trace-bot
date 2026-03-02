import { useState } from "react";
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
  ChevronDown,
  Zap,
  BarChart3,
  Globe,
  Inbox,
  Mailbox,
  Users,
  ScanLine,
  Import,
  Link2,
  Search,
  Gift,
  Menu,
  X,
  Star,
  Clock,
  Lock,
  Sparkles,
  Eye,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const navLinks = [
    { href: "#features", label: "Funcionalidades" },
    { href: "#how-it-works", label: "Como Funciona" },
    { href: "#integrations", label: "Integrações" },
    { href: "#pricing", label: "Preços" },
    { href: "#faq", label: "FAQ" },
  ];

  const features = [
    {
      icon: ScanLine,
      title: "Digitalização OCR com IA",
      description:
        "Fotografe ou faça upload de faturas. A inteligência artificial extrai automaticamente número, NIF, valor, data e fornecedor com alta precisão.",
      highlight: true,
    },
    {
      icon: Mail,
      title: "Integração Gmail",
      description:
        "Ligação direta ao Gmail para varrimento automático de emails com faturas. Identificação e associação automática ao fornecedor correto.",
    },
    {
      icon: Mailbox,
      title: "Múltiplas Caixas de Email",
      description:
        "Conecte várias contas Gmail à sua empresa. Centralize todas as faturas de diferentes caixas de correio num só lugar.",
    },
    {
      icon: Inbox,
      title: "Inbox de Respostas",
      description:
        "Receba e visualize respostas dos fornecedores diretamente na aplicação. Sem trocar de ferramenta, tudo centralizado.",
    },
    {
      icon: Send,
      title: "Email em Massa",
      description:
        "Envie pedidos de faturas a múltiplos fornecedores de uma só vez com modelos de email personalizáveis e profissionais.",
    },
    {
      icon: Calendar,
      title: "Calendário de Faturas",
      description:
        "Visualize todas as suas faturas num calendário por data de emissão. Tenha uma visão clara do seu fluxo de faturação.",
    },
    {
      icon: Import,
      title: "Importação e-Fatura",
      description:
        "Importe PDFs diretamente do portal e-Fatura da Autoridade Tributária portuguesa. Dados extraídos automaticamente.",
      highlight: true,
    },
    {
      icon: Search,
      title: "Pesquisa NIF Automática",
      description:
        "Enriqueça automaticamente os dados dos fornecedores a partir do NIF — nome, morada, CAE, telefone e email.",
    },
    {
      icon: Link2,
      title: "Links de Partilha",
      description:
        "Partilhe faturas com o contabilista via link protegido por password. Acesso seguro, temporário e controlado.",
    },
    {
      icon: MessageSquare,
      title: "Contacto Automático",
      description:
        "Envie pedidos de faturas em falta com modelos personalizáveis e acompanhe respostas em tempo real.",
    },
    {
      icon: RefreshCw,
      title: "Sincronização TOConline",
      description:
        "Sincronize as suas faturas diretamente com o TOConline. Elimine a entrada manual na contabilidade.",
      highlight: true,
    },
    {
      icon: Shield,
      title: "Portal de Contabilidade",
      description:
        "O seu contabilista acede a um portal dedicado com todas as faturas organizadas e prontas para processar.",
    },
  ];

  const howItWorks = [
    {
      step: "01",
      icon: Camera,
      title: "Importe ou fotografe",
      description:
        "Importe faturas diretamente do e-Fatura, tire fotografias com o telemóvel, ou faça upload de PDFs. A IA extrai automaticamente todos os dados — número, NIF, valor e fornecedor.",
      details: [
        "Upload de PDF, imagem ou fotografia",
        "Importação direta do portal e-Fatura",
        "Extração automática de dados com IA",
        "Validação e revisão antes de guardar",
      ],
    },
    {
      step: "02",
      icon: Mail,
      title: "Recuperação automática",
      description:
        "O InvoiceTrace analisa o seu Gmail, identifica faturas em falta e envia pedidos automáticos aos fornecedores com modelos de email profissionais e personalizáveis.",
      details: [
        "Varrimento automático do Gmail",
        "Detecção de faturas em falta",
        "Envio de emails em massa",
        "Acompanhamento de respostas em tempo real",
      ],
    },
    {
      step: "03",
      icon: RefreshCw,
      title: "Organize e sincronize",
      description:
        "As faturas são organizadas por mês, dia e fornecedor. Sincronize diretamente com o TOConline e partilhe com a contabilidade em segundos.",
      details: [
        "Organização por data e fornecedor",
        "Sincronização com TOConline",
        "Links de partilha com contabilista",
        "Dashboard com visão completa",
      ],
    },
  ];

  const targetAudience = [
    {
      icon: Building2,
      title: "Pequenas e Médias Empresas",
      description:
        "Empresas que precisam de manter a faturação organizada sem contratar recursos adicionais.",
    },
    {
      icon: Users,
      title: "Departamentos de Contabilidade",
      description:
        "Equipas de contabilidade que perdem horas a procurar faturas em falta de fornecedores.",
    },
    {
      icon: BarChart3,
      title: "Contabilistas e TOCs",
      description:
        "Profissionais de contabilidade que gerem múltiplas empresas e precisam de acesso rápido às faturas.",
    },
    {
      icon: Sparkles,
      title: "Empreendedores",
      description:
        "Empresários em nome individual que querem simplificar a gestão fiscal sem complicações.",
    },
  ];

  const testimonials = [
    {
      quote:
        "Costumávamos perder dias a enviar emails atrás de faturas. Com o InvoiceTrace, recuperamos 94% das faturas em falta em menos de 48 horas.",
      author: "Maria Santos",
      role: "Diretora Financeira",
      company: "TechSolutions Lda.",
      rating: 5,
    },
    {
      quote:
        "A importação do e-Fatura e o envio automático de emails poupam-nos pelo menos 20 horas por mês. E o melhor — é completamente gratuito!",
      author: "João Ferreira",
      role: "Contabilista Certificado",
      company: "JF Contabilidade",
      rating: 5,
    },
    {
      quote:
        "Como empreendedor, não tenho tempo para perseguir fornecedores. O InvoiceTrace trata de tudo automaticamente. Recomendo a todas as PMEs.",
      author: "Ana Costa",
      role: "CEO",
      company: "DigitalCraft Unipessoal",
      rating: 5,
    },
  ];

  const faqs = [
    {
      q: "O InvoiceTrace é mesmo gratuito?",
      a: "Sim, 100% gratuito. Sem planos pagos, sem limites escondidos, sem período de teste. Todas as funcionalidades estão incluídas sem qualquer custo — faturas ilimitadas, fornecedores ilimitados, integrações incluídas.",
    },
    {
      q: "Preciso de cartão de crédito para me registar?",
      a: "Não. O registo é completamente gratuito e não pedimos qualquer informação de pagamento. Basta criar uma conta com email ou Google e começar a usar.",
    },
    {
      q: "Como funciona a digitalização de faturas com IA?",
      a: "Basta fotografar ou fazer upload da fatura. A nossa IA (powered by modelos avançados) extrai automaticamente o número da fatura, NIF do fornecedor, valor total, data de emissão e muito mais. Pode revisar e corrigir os dados antes de guardar.",
    },
    {
      q: "Posso importar faturas do e-Fatura?",
      a: "Sim! Pode exportar os seus documentos do portal e-Fatura da Autoridade Tributária em formato PDF e importá-los diretamente no InvoiceTrace. Os dados são extraídos automaticamente.",
    },
    {
      q: "A integração com Gmail é segura?",
      a: "Absolutamente. Utilizamos OAuth 2.0 para autenticação, o que significa que nunca armazenamos a sua password do Gmail. A ligação pode ser revogada a qualquer momento nas definições da sua conta Google.",
    },
    {
      q: "Posso usar com múltiplas empresas?",
      a: "Sim. Pode criar e gerir múltiplas empresas dentro da mesma conta. Cada empresa tem os seus próprios fornecedores, faturas e definições, completamente separados.",
    },
    {
      q: "Como partilho faturas com o meu contabilista?",
      a: "Pode gerar um link de partilha protegido por password que dá ao seu contabilista acesso a todas as faturas selecionadas. O link pode ser desativado a qualquer momento.",
    },
    {
      q: "O InvoiceTrace funciona apenas para empresas portuguesas?",
      a: "O InvoiceTrace foi desenhado especificamente para o mercado português, com integração e-Fatura, pesquisa NIF, e suporte para o TOConline. No entanto, pode ser usado por qualquer empresa que precise de gerir faturas.",
    },
  ];

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
          <div className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm font-medium">
                Entrar
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gap-1.5 text-sm font-semibold">
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          {/* Mobile menu button */}
          <button
            className="lg:hidden rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-6 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 border-t border-border mt-3 flex flex-col gap-2">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full justify-center">
                    Entrar
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full justify-center gap-1.5">
                    Começar Grátis
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/3 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary shadow-sm">
              <Gift className="h-4 w-4" />
              100% Gratuito — Para sempre
            </div>
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
              — tudo numa única plataforma, totalmente grátis.
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
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Faturas ilimitadas
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Configuração em 2 minutos
              </span>
            </div>
          </div>

          {/* Hero visual — dashboard mockup */}
          <div className="relative mx-auto mt-16 max-w-5xl lg:mt-20">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-primary/5">
              <div className="rounded-xl border border-border bg-muted/30 p-6 lg:p-10">
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
                <div className="space-y-2">
                  {[
                    { name: "Fornecedor A", status: "Recebida", color: "bg-[hsl(var(--success))]/15" },
                    { name: "Fornecedor B", status: "Recebida", color: "bg-[hsl(var(--success))]/15" },
                    { name: "Fornecedor C", status: "Contactada", color: "bg-[hsl(var(--warning))]/15" },
                    { name: "Fornecedor D", status: "Em falta", color: "bg-[hsl(var(--destructive))]/15" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10" />
                      <div className="flex-1">
                        <div className="h-3 w-32 rounded bg-foreground/10" />
                        <div className="mt-1.5 h-2.5 w-20 rounded bg-foreground/5" />
                      </div>
                      <div className={`h-6 w-20 rounded-full ${row.color}`} />
                      <div className="h-3 w-16 rounded bg-foreground/5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-b from-primary/10 via-transparent to-transparent blur-2xl" />
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-border bg-muted/30 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 sm:flex sm:items-center sm:justify-center sm:gap-16">
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
              Três passos simples para nunca mais perder uma fatura. Comece em minutos, sem configuração complexa.
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            <div className="absolute top-12 left-1/6 hidden h-0.5 w-2/3 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 md:block" />

            {howItWorks.map((item) => (
              <div key={item.step} className="relative">
                <div className="rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-lg hover:shadow-primary/5">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="mb-3 text-xl font-bold">{item.title}</h3>
                  <p className="mb-5 leading-relaxed text-muted-foreground">{item.description}</p>
                  <ul className="space-y-2">
                    {item.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                        <span className="text-muted-foreground">{detail}</span>
                      </li>
                    ))}
                  </ul>
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
              controlo total sobre a sua faturação — e tudo incluído gratuitamente.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`group relative rounded-2xl border p-7 transition-all hover:shadow-lg ${
                  feature.highlight
                    ? "border-primary/30 bg-card shadow-md shadow-primary/5"
                    : "border-border bg-card hover:shadow-primary/5"
                }`}
              >
                {feature.highlight && (
                  <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${
                    feature.highlight
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-bold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              Para quem é
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Feito para quem precisa de faturas organizadas
            </h2>
            <p className="text-lg text-muted-foreground">
              Seja qual for o tamanho da sua empresa, o InvoiceTrace adapta-se às suas necessidades.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {targetAudience.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card p-8 text-center transition-shadow hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="border-t border-border bg-muted/20 py-24 lg:py-32">
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
                    "Portal AT — Pesquisa de NIF e dados de fornecedores",
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

      {/* Testimonials */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-primary" />
              Testemunhos
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              O que dizem os nossos utilizadores
            </h2>
            <p className="text-lg text-muted-foreground">
              Centenas de empresas portuguesas já confiam no InvoiceTrace para gerir a sua faturação.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="mb-6 leading-relaxed text-muted-foreground italic">
                  "{testimonial.quote}"
                </p>
                <div>
                  <p className="font-bold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Free */}
      <section className="border-t border-border bg-muted/20 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
                <Gift className="h-4 w-4" />
                Porquê gratuito?
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Acreditamos que gerir faturas{" "}
                <span className="bg-gradient-to-r from-primary to-[hsl(230,80%,60%)] bg-clip-text text-transparent">
                  não deve custar dinheiro
                </span>
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
                O InvoiceTrace nasceu da frustração de perder horas à procura de faturas em falta.
                Criámos esta ferramenta para resolver um problema real de milhares de empresas portuguesas
                — e decidimos mantê-la gratuita para que todos possam beneficiar.
              </p>
              <div className="space-y-4">
                {[
                  {
                    icon: Lock,
                    title: "Sem truques, sem limites",
                    description: "Todas as funcionalidades estão disponíveis. Não há plano premium escondido.",
                  },
                  {
                    icon: Eye,
                    title: "Transparência total",
                    description: "Os seus dados são seus. Não vendemos informações a terceiros.",
                  },
                  {
                    icon: Clock,
                    title: "Para sempre gratuito",
                    description: "Não é um período de teste. O InvoiceTrace é e continuará a ser 100% gratuito.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="rounded-3xl border-2 border-primary/30 bg-card p-10 shadow-xl shadow-primary/5">
                  <div className="mb-2 text-center">
                    <span className="text-sm font-semibold text-primary uppercase tracking-wide">Plano único</span>
                  </div>
                  <div className="mb-6 text-center">
                    <span className="text-6xl font-extrabold">0€</span>
                    <span className="ml-2 text-lg text-muted-foreground">/mês</span>
                  </div>
                  <div className="mb-2 text-center text-sm text-muted-foreground">
                    Tudo incluído, sem exceções
                  </div>
                  <div className="my-6 h-px bg-border" />
                  <ul className="mb-8 space-y-3">
                    {[
                      "Faturas ilimitadas",
                      "Fornecedores ilimitados",
                      "Digitalização OCR com IA",
                      "Integração Gmail (múltiplas contas)",
                      "Importação e-Fatura",
                      "Email em massa",
                      "Inbox de respostas",
                      "Calendário de faturas",
                      "Pesquisa NIF automática",
                      "Links de partilha seguros",
                      "Sincronização TOConline",
                      "Portal de contabilidade",
                      "Suporte por email",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                        <span className="text-sm font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button size="lg" className="w-full h-13 gap-2 text-base font-semibold shadow-lg shadow-primary/25">
                      Começar Agora — É Grátis
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Sem cartão de crédito necessário
                  </p>
                </div>
                <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — 100% Free */}
      <section id="pricing" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <Gift className="h-4 w-4" />
              Preços
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              100% Gratuito.{" "}
              <span className="bg-gradient-to-r from-primary to-[hsl(230,80%,60%)] bg-clip-text text-transparent">
                Para sempre.
              </span>
            </h2>
            <p className="mb-12 text-lg text-muted-foreground">
              Sem planos pagos, sem limites escondidos, sem surpresas. Todas as funcionalidades incluídas, zero euros por mês.
            </p>

            <div className="mx-auto max-w-2xl">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {[
                  { icon: FileText, label: "Faturas ilimitadas" },
                  { icon: Building2, label: "Fornecedores ilimitados" },
                  { icon: ScanLine, label: "OCR com IA" },
                  { icon: Mail, label: "Integração Gmail" },
                  { icon: Import, label: "e-Fatura import" },
                  { icon: Send, label: "Email em massa" },
                  { icon: Inbox, label: "Inbox" },
                  { icon: Calendar, label: "Calendário" },
                  { icon: Search, label: "Pesquisa NIF" },
                  { icon: Link2, label: "Partilha segura" },
                  { icon: RefreshCw, label: "TOConline sync" },
                  { icon: Shield, label: "Portal contabilista" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-center">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link to="/auth">
                  <Button size="lg" className="h-13 gap-2 px-10 text-base font-semibold shadow-lg shadow-primary/25">
                    Começar Gratuitamente
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-muted/20 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              FAQ
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Perguntas frequentes
            </h2>
            <p className="text-lg text-muted-foreground">
              Tudo o que precisa de saber sobre o InvoiceTrace.
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
              >
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 -mt-1">
                    <p className="leading-relaxed text-muted-foreground">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5 px-8 py-16 text-center sm:px-16 lg:py-24">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Comece a recuperar faturas{" "}
                <span className="bg-gradient-to-r from-primary to-[hsl(230,80%,60%)] bg-clip-text text-transparent">
                  hoje
                </span>
              </h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
                Junte-se a centenas de empresas portuguesas que já utilizam o InvoiceTrace
                para eliminar faturas perdidas e simplificar a contabilidade — sem pagar nada.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to="/auth">
                  <Button size="lg" className="h-13 gap-2 px-10 text-base font-semibold shadow-lg shadow-primary/25">
                    Criar Conta Gratuita
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Sem cartão de crédito
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Configuração em 2 minutos
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  100% Gratuito para sempre
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold">InvoiceTrace</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground max-w-xs">
                A plataforma gratuita de gestão e recuperação de faturas para empresas portuguesas.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="mb-4 text-sm font-bold">Produto</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Funcionalidades", href: "#features" },
                  { label: "Como Funciona", href: "#how-it-works" },
                  { label: "Integrações", href: "#integrations" },
                  { label: "Preços", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                ].map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Features */}
            <div>
              <h4 className="mb-4 text-sm font-bold">Funcionalidades</h4>
              <ul className="space-y-2.5">
                {[
                  "Digitalização OCR",
                  "Integração Gmail",
                  "Importação e-Fatura",
                  "Pesquisa NIF",
                  "Email em massa",
                  "Calendário de faturas",
                ].map((item) => (
                  <li key={item}>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Get started */}
            <div>
              <h4 className="mb-4 text-sm font-bold">Começar</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/auth" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Criar conta gratuita
                  </Link>
                </li>
                <li>
                  <Link to="/auth" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Entrar
                  </Link>
                </li>
              </ul>
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-primary mb-1">100% Gratuito</p>
                <p className="text-xs text-muted-foreground">
                  Sem cartão de crédito. Sem limites. Para sempre.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} InvoiceTrace. Todos os direitos reservados.
            </p>
            <p className="text-xs text-muted-foreground">
              Feito com dedicação para empresas portuguesas
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
