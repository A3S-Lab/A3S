import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Box,
  Cpu,
  Eye,
  Globe,
  Layers,
  Monitor,
  Search,
  Database,
  Github,
  Package,
  PanelTop,
  Lock,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Workflow,
  Zap,
  Puzzle,
} from 'lucide-react';

import { SiteNav } from '@/components/site-nav';

// ─── i18n ─────────────────────────────────────────────────────────────────────

const t = {
  en: {
    badge: 'Open Source · MIT License · Built in Rust',
    heroTitle1: 'Run AI Agents',
    heroGradient: 'Inside MicroVM Sandboxes',
    heroSub:
      'A3S is a modular Rust ecosystem for production AI agents — VM-isolated execution, opt-in hardware attestation on capable hosts, privacy-aware security, and a full agent framework in one coherent stack.',
    getStarted: 'Get Started',
    viewGithub: 'View on GitHub',

    // Why A3S
    whyLabel: 'Why A3S',
    whyHeading: 'The problems A3S solves',
    whySub: 'Most agent frameworks ignore the hard parts. A3S is built around them.',
    pillars: [
      {
        icon: Lock,
        title: 'VM isolation by default',
        body: 'Run sensitive agents inside MicroVMs, and use SEV-SNP attestation when the host can prove it. Isolation is explicit instead of assumed.',
      },
      {
        icon: Zap,
        title: 'Production-grade performance',
        body: 'Lane provides high-throughput priority scheduling, Box focuses on fast MicroVM startup, and Power can run local LLMs with RA-TLS-aware integration. All in Rust.',
      },
      {
        icon: Puzzle,
        title: 'Composable, not monolithic',
        body: 'Use Code standalone, add Box for isolation, and compose only the modules you need. Every module has a trait interface — swap any piece without touching the rest.',
      },
    ],

    frameworkLabel: 'Framework',
    frameworkHeading: 'Build agents, not boilerplate',
    appsLabel: 'Applications',
    appsHeading: 'Infrastructure that runs agents safely',
    distributionLabel: 'Distribution',
    distributionHeading: 'Install, package, and update the stack',
    middlewareLabel: 'Middleware',
    middlewareHeading: 'Request policy at the gateway edge',
    libsLabel: 'Libraries',
    libsHeading: 'Composable primitives',
    obsLabel: 'Observability And Control',
    obsHeading: 'See and govern what agents really do',
    installTitle: 'Quick Install',
    installSub: 'Available on crates.io, PyPI, npm, and Homebrew',
    ctaHeading: 'Ready to build?',
    ctaSub: 'Start with the Code framework and add modules as you need them.',
    readDocs: 'Read the Docs',
    starGithub: 'Star on GitHub',
    docsLink: 'Documentation',
    footerLicense: '· MIT License · ©',
  },
  cn: {
    badge: '开源 · MIT 协议 · Rust 构建',
    heroTitle1: '在 MicroVM 隔离环境中',
    heroGradient: '安全运行 AI Agent',
    heroSub:
      'A3S 是面向生产环境的模块化 Rust 生态 — VM 隔离执行、在能力宿主机上可选硬件证明、隐私感知安全和完整的 Agent 框架，构成一套连贯的技术栈。',
    getStarted: '快速开始',
    viewGithub: '查看 GitHub',

    whyLabel: '为什么选 A3S',
    whyHeading: 'A3S 解决的核心问题',
    whySub: '大多数 Agent 框架回避了最难的部分，A3S 恰恰围绕它们而构建。',
    pillars: [
      {
        icon: Lock,
        title: '默认 VM 隔离',
        body: '把敏感 Agent 放进 MicroVM；当宿主机能证明 SEV-SNP 能力时再启用硬件证明。隔离能力明确可见，而不是默认假设。',
      },
      {
        icon: Zap,
        title: '生产级性能',
        body: 'Lane 提供高吞吐优先级调度，Box 聚焦快速 MicroVM 启动，Power 可集成 RA-TLS 感知的本地 LLM 推理，全部由 Rust 构建。',
      },
      {
        icon: Puzzle,
        title: '可组合，非单体',
        body: '单独使用 Code，加入 Box 获得隔离，只组合当前需要的模块。每个模块都有 trait 接口——替换任意组件无需改动其余部分。',
      },
    ],

    frameworkLabel: '框架',
    frameworkHeading: '构建 Agent，而非样板代码',
    appsLabel: '应用',
    appsHeading: '安全运行 Agent 的基础设施',
    distributionLabel: '分发',
    distributionHeading: '安装、打包和更新整套技术栈',
    middlewareLabel: '中间件',
    middlewareHeading: '网关边缘的请求策略',
    libsLabel: '库',
    libsHeading: '可组合的基础原语',
    obsLabel: '可观测性与控制',
    obsHeading: '看见并治理 Agent 的真实行动',
    installTitle: '快速安装',
    installSub: '支持 crates.io、PyPI、npm 和 Homebrew',
    ctaHeading: '准备好了吗？',
    ctaSub: '从 Code 框架开始，按需添加模块。',
    readDocs: '阅读文档',
    starGithub: 'GitHub Star',
    docsLink: '文档',
    footerLicense: '· MIT 协议 · ©',
  },
} as const;

type Lang = keyof typeof t;

// ─── Module data ──────────────────────────────────────────────────────────────

function getModules(lang: Lang) {
  const base = lang === 'cn' ? '/cn' : '';

  const frameworks = [
    {
      name: 'Code',
      tag: lang === 'cn' ? 'Agent 框架' : 'Agent Framework',
      description:
        lang === 'cn'
          ? 'v3.1 驾驭式编程 Agent 运行时：ACL 配置、PTC、自动 subagent 委派、.a3s/agents、验证证据、Hooks、MCP。'
          : 'v3.1 harness-driven coding agent runtime: ACL config, PTC, automatic subagent delegation, .a3s/agents, verification evidence, hooks, MCP.',
      href: `${base}/docs/code`,
      icon: Bot,
      lightColor: 'bg-indigo-50 text-indigo-600',
      darkColor: 'dark:bg-indigo-900/40 dark:text-indigo-400',
    },
    {
      name: 'Flow',
      tag: lang === 'cn' ? '工作流引擎' : 'Workflow Engine',
      description:
        lang === 'cn'
          ? '事件溯源 durable workflow SDK：replay-safe steps、waits、hooks、retries、workers、SQLite/Postgres durability。'
          : 'Event-sourced durable workflow SDK: replay-safe steps, waits, hooks, retries, workers, SQLite/Postgres durability.',
      href: `${base}/docs/flow`,
      icon: Workflow,
      lightColor: 'bg-cyan-50 text-cyan-600',
      darkColor: 'dark:bg-cyan-900/40 dark:text-cyan-400',
    },
  ];

  const applications = [
    {
      name: 'CLI',
      tag: lang === 'cn' ? '终端应用' : 'Terminal App',
      description:
        lang === 'cn'
          ? '`a3s code` 交互式 TUI、session resume、/top、/update、Box 代理和工具发现。'
          : '`a3s code` interactive TUI, session resume, /top, /update, Box proxying, and tool discovery.',
      href: `${base}/docs/cli`,
      icon: Terminal,
      lightColor: 'bg-slate-100 text-slate-700',
      darkColor: 'dark:bg-slate-800 dark:text-slate-300',
    },
    {
      name: 'Box',
      tag: lang === 'cn' ? 'MicroVM 运行时' : 'MicroVM Runtime',
      description:
        lang === 'cn'
          ? 'VM 隔离沙箱 — OCI 镜像、类 Docker CLI、WarmPool、实验性 CRI、硬件依赖 TEE。'
          : 'VM-isolated sandbox — OCI images, Docker-like CLI, WarmPool, experimental CRI, hardware-gated TEE.',
      href: `${base}/docs/box`,
      icon: Box,
      lightColor: 'bg-violet-50 text-violet-600',
      darkColor: 'dark:bg-violet-900/40 dark:text-violet-400',
    },
    {
      name: 'Power',
      tag: lang === 'cn' ? 'LLM 推理' : 'LLM Inference',
      description:
        lang === 'cn'
          ? '隐私保护 LLM 推理 — OpenAI 兼容 API、TEE 支持、多后端、多 GPU、工具调用。'
          : 'Privacy-preserving LLM inference — OpenAI-compatible API, TEE support, multi-backend, multi-GPU, tool calling.',
      href: `${base}/docs/power`,
      icon: Cpu,
      lightColor: 'bg-emerald-50 text-emerald-600',
      darkColor: 'dark:bg-emerald-900/40 dark:text-emerald-400',
    },
    {
      name: 'Gateway',
      tag: lang === 'cn' ? 'API 网关' : 'API Gateway',
      description:
        lang === 'cn'
          ? '15 个中间件、Knative 自动扩缩容、HCL 配置热重载、TLS/ACME。'
          : '15 middlewares, Knative autoscaling, HCL hot-reload, TLS/ACME.',
      href: `${base}/docs/gateway`,
      icon: Globe,
      lightColor: 'bg-sky-50 text-sky-600',
      darkColor: 'dark:bg-sky-900/40 dark:text-sky-400',
    },
    {
      name: 'GUI',
      tag: lang === 'cn' ? '原生 UI' : 'Native UI',
      description:
        lang === 'cn'
          ? 'Rust RSX 与 semantic_ui 到 native IR 的原生 UI renderer 原型，覆盖 AppKit、WinUI、GTK 规划路径。'
          : 'Native UI renderer prototype that lowers Rust RSX and semantic_ui trees into native IR for AppKit, WinUI, and GTK planning paths.',
      href: `${base}/docs/gui`,
      icon: Monitor,
      lightColor: 'bg-fuchsia-50 text-fuchsia-600',
      darkColor: 'dark:bg-fuchsia-900/40 dark:text-fuchsia-400',
    },
    {
      name: 'WebView',
      tag: lang === 'cn' ? '弹窗 Helper' : 'Popup Helper',
      description:
        lang === 'cn'
          ? '供 A3S Code TUI 打开 RemoteUI viewUrl 的原生 WebView helper，支持 auth bootstrap 和跨平台窗口。'
          : 'Native WebView helper for A3S Code RemoteUI viewUrls, with auth bootstrap and cross-platform popup windows.',
      href: `${base}/docs/webview`,
      icon: PanelTop,
      lightColor: 'bg-blue-50 text-blue-600',
      darkColor: 'dark:bg-blue-900/40 dark:text-blue-400',
    },
  ];

  const distribution = [
    {
      name: 'Homebrew',
      tag: lang === 'cn' ? '安装渠道' : 'Install Channel',
      description:
        lang === 'cn'
          ? 'A3S Homebrew tap：formulae、cask、release archive、checksum、platform branch 和维护流程。'
          : 'A3S Homebrew tap for formulae, casks, release archives, checksums, platform branches, and maintenance flow.',
      href: `${base}/docs/homebrew`,
      icon: Package,
      lightColor: 'bg-orange-50 text-orange-600',
      darkColor: 'dark:bg-orange-900/40 dark:text-orange-400',
    },
    {
      name: 'Updater',
      tag: lang === 'cn' ? '自更新' : 'Self Update',
      description:
        lang === 'cn'
          ? 'CLI release 自更新库，覆盖 GitHub Releases、资产选择、安装安全和验证流程。'
          : 'CLI self-update library for GitHub Releases, asset selection, installation safety, and verification flow.',
      href: `${base}/docs/updater`,
      icon: RefreshCw,
      lightColor: 'bg-rose-50 text-rose-600',
      darkColor: 'dark:bg-rose-900/40 dark:text-rose-400',
    },
  ];

  const middleware = [
    {
      name: 'Gateway Middleware',
      tag: lang === 'cn' ? '请求管道' : 'Request Pipeline',
      description:
        lang === 'cn'
          ? '15 个内置中间件能力：认证、限流、熔断、重试、CORS、headers、路径改写、压缩、IP/TCP 过滤。'
          : '15 built-in middleware capabilities: auth, rate limiting, circuit breaking, retry, CORS, headers, path rewrite, compression, IP/TCP filtering.',
      href: `${base}/docs/gateway/middleware`,
      icon: SlidersHorizontal,
      lightColor: 'bg-cyan-50 text-cyan-700',
      darkColor: 'dark:bg-cyan-900/40 dark:text-cyan-400',
    },
  ];

  const libraries = [
    {
      name: 'ACL',
      tag: lang === 'cn' ? '配置语言' : 'Config Language',
      description:
        lang === 'cn'
          ? '类 HCL Agent Configuration Language：parser、AST、generator、Rust API 和 Node SDK。'
          : 'HCL-like Agent Configuration Language with parser, AST, generator, Rust API, and Node SDK.',
      href: `${base}/docs/acl`,
      icon: Lock,
      lightColor: 'bg-zinc-100 text-zinc-700',
      darkColor: 'dark:bg-zinc-800 dark:text-zinc-300',
    },
    {
      name: 'AHP',
      tag: lang === 'cn' ? 'Agent 协议' : 'Agent Protocol',
      description:
        lang === 'cn'
          ? '传输无关 JSON-RPC harness protocol，支持事件、typed decisions、批处理和多种 transport。'
          : 'Transport-agnostic JSON-RPC harness protocol for events, typed decisions, batching, and multiple transports.',
      href: `${base}/docs/ahp`,
      icon: Workflow,
      lightColor: 'bg-blue-50 text-blue-700',
      darkColor: 'dark:bg-blue-900/40 dark:text-blue-400',
    },
    {
      name: 'Event',
      tag: lang === 'cn' ? '事件总线' : 'Event Bus',
      description:
        lang === 'cn'
          ? 'Provider 无关 event bus：publish、subscribe、history、schema、routing、NATS 和 payload security。'
          : 'Provider-agnostic event bus for publish, subscribe, history, schema, routing, NATS, and payload security.',
      href: `${base}/docs/event`,
      icon: Zap,
      lightColor: 'bg-yellow-50 text-yellow-700',
      darkColor: 'dark:bg-yellow-900/40 dark:text-yellow-400',
    },
    {
      name: 'Lane',
      tag: lang === 'cn' ? '优先级队列' : 'Priority Queue',
      description:
        lang === 'cn'
          ? '6 条内置通道、重试/DLQ、限流、持久化存储、33k–50k ops/sec。'
          : '6 built-in lanes, retry/DLQ, rate limiting, persistent storage, 33k–50k ops/sec.',
      href: `${base}/docs/lane`,
      icon: Layers,
      lightColor: 'bg-amber-50 text-amber-600',
      darkColor: 'dark:bg-amber-900/40 dark:text-amber-400',
    },
    {
      name: 'Search',
      tag: lang === 'cn' ? '元搜索' : 'Meta Search',
      description:
        lang === 'cn'
          ? '9 个引擎共识排名 — DuckDuckGo、Brave、Google、百度，支持代理轮换。'
          : '9-engine consensus ranking — DuckDuckGo, Brave, Google, Baidu, proxy rotation.',
      href: `${base}/docs/search`,
      icon: Search,
      lightColor: 'bg-teal-50 text-teal-600',
      darkColor: 'dark:bg-teal-900/40 dark:text-teal-400',
    },
    {
      name: 'Memory',
      tag: lang === 'cn' ? '记忆存储' : 'Memory Storage',
      description:
        lang === 'cn'
          ? '情节 / 语义 / 程序 / 工作记忆，原子写入持久化，相关性衰减评分。'
          : 'Episodic / semantic / procedural / working memory, atomic persistence, relevance decay scoring.',
      href: `${base}/docs/memory`,
      icon: Database,
      lightColor: 'bg-indigo-50 text-indigo-600',
      darkColor: 'dark:bg-indigo-900/40 dark:text-indigo-400',
    },
    {
      name: 'TUI',
      tag: lang === 'cn' ? '终端 UI' : 'Terminal UI',
      description:
        lang === 'cn'
          ? 'TEA/Flexbox 终端 UI 框架，包含 menus、tables、pickers、diffs、logs、status surfaces。'
          : 'TEA/Flexbox terminal UI framework with menus, tables, pickers, diffs, logs, and status surfaces.',
      href: `${base}/docs/tui`,
      icon: PanelTop,
      lightColor: 'bg-purple-50 text-purple-600',
      darkColor: 'dark:bg-purple-900/40 dark:text-purple-400',
    },
    {
      name: 'Common',
      tag: lang === 'cn' ? '共享原语' : 'Shared Primitives',
      description:
        lang === 'cn'
          ? '共享 privacy、tool、workspace path 和 framed transport 类型，供 A3S crates 复用。'
          : 'Shared privacy, tool, workspace path, and framed transport primitives reused across A3S crates.',
      href: `${base}/docs/common`,
      icon: Puzzle,
      lightColor: 'bg-stone-100 text-stone-700',
      darkColor: 'dark:bg-stone-800 dark:text-stone-300',
    },
  ];

  const observability = [
    {
      name: 'Observer',
      tag: lang === 'cn' ? 'eBPF 观测' : 'eBPF Telemetry',
      description:
        lang === 'cn'
          ? '语言无关 eBPF telemetry，观测 agent tools、files、LLM calls、DNS、egress，并支持可选 kernel guards。'
          : 'Language-agnostic eBPF telemetry for agent tools, files, LLM calls, DNS, egress, and optional kernel guards.',
      href: `${base}/docs/observer`,
      icon: Eye,
      lightColor: 'bg-lime-50 text-lime-700',
      darkColor: 'dark:bg-lime-900/40 dark:text-lime-400',
    },
    {
      name: 'Sentry',
      tag: lang === 'cn' ? '运行时安全' : 'Runtime Safety',
      description:
        lang === 'cn'
          ? 'L1 规则、L2 LLM 检查、L3 agent review 的分层 runtime security control。'
          : 'Tiered runtime security control with L1 rules, L2 LLM checks, and L3 agent review.',
      href: `${base}/docs/sentry`,
      icon: ShieldCheck,
      lightColor: 'bg-red-50 text-red-600',
      darkColor: 'dark:bg-red-900/40 dark:text-red-400',
    },
  ];

  return { frameworks, applications, distribution, middleware, libraries, observability };
}

const installSnippets = [
  { label: 'Rust', cmd: 'cargo add a3s-code-core a3s-flow a3s-tui' },
  { label: 'Python', cmd: 'pip install a3s-code a3s-lane a3s-search' },
  { label: 'Node.js', cmd: 'npm install @a3s-lab/code @a3s-lab/lane' },
  { label: 'Homebrew', cmd: 'brew tap a3s-lab/tap && brew install a3s-search a3s-power' },
];

// ─── ModuleCard ───────────────────────────────────────────────────────────────

function ModuleCard({
  name, tag, description, href, icon: Icon, lightColor, darkColor,
}: {
  name: string; tag: string; description: string; href: string;
  icon: React.ElementType; lightColor: string; darkColor: string;
}) {
  return (
    <Link
      href={href}
      className="module-card group flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-6 hover:-translate-y-1 dark:border-slate-700 dark:bg-slate-800/60"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${lightColor} ${darkColor}`}>
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
        <ArrowRight
          className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-indigo-500 dark:text-slate-600 dark:group-hover:text-indigo-400"
          strokeWidth={2}
        />
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-base font-bold text-slate-900 dark:text-slate-100">{name}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            {tag}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage({ lang = 'en' }: { lang?: Lang }) {
  const tr = t[lang];
  const { frameworks, applications, distribution, middleware, libraries, observability } = getModules(lang);
  const docsHref = lang === 'cn' ? '/cn/docs/code' : '/docs/code';

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--ct-bg)', fontFamily: 'var(--ct-font)', color: 'var(--ct-text)' }}
    >
      {/* ── Nav ── */}
      <SiteNav lang={lang} section="Docs" />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-3xl dark:opacity-10" style={{ background: 'radial-gradient(circle, #4F46E5, #7C3AED)' }} />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-0 h-[400px] w-[400px] rounded-full opacity-10 blur-3xl dark:opacity-5" style={{ background: 'radial-gradient(circle, #7C3AED, #4F46E5)' }} />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 dark:border-indigo-800/60 dark:bg-indigo-950/50">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{tr.badge}</span>
          </div>
          <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl" style={{ letterSpacing: '-0.02em' }}>
            {tr.heroTitle1}{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{tr.heroGradient}</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-500 dark:text-slate-400 sm:text-xl">{tr.heroSub}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={docsHref} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5" style={{ boxShadow: 'var(--ct-shadow-btn)' }}>
              {tr.getStarted}<ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="https://github.com/A3S-Lab" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700">
              <Github className="h-4 w-4" />{tr.viewGithub}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why A3S ── */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">{tr.whyLabel}</span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">{tr.whyHeading}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500 dark:text-slate-400">{tr.whySub}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tr.pillars.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-slate-100 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Framework ── */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">{tr.frameworkLabel}</span>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{tr.frameworkHeading}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {frameworks.map((m) => <ModuleCard key={m.name} {...m} />)}
          </div>
        </div>
      </section>

      {/* ── Applications ── */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-500">{tr.appsLabel}</span>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{tr.appsHeading}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {applications.map((m) => <ModuleCard key={m.name} {...m} />)}
          </div>
        </div>
      </section>

      {/* ── Distribution ── */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-500">{tr.distributionLabel}</span>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{tr.distributionHeading}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {distribution.map((m) => <ModuleCard key={m.name} {...m} />)}
          </div>
        </div>
      </section>

      {/* ── Middleware ── */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">{tr.middlewareLabel}</span>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{tr.middlewareHeading}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {middleware.map((m) => <ModuleCard key={m.name} {...m} />)}
          </div>
        </div>
      </section>

      {/* ── Libraries ── */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">{tr.libsLabel}</span>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{tr.libsHeading}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {libraries.map((m) => <ModuleCard key={m.name} {...m} />)}
          </div>
        </div>
      </section>

      {/* ── Observability ── */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-lime-600 dark:text-lime-400">{tr.obsLabel}</span>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{tr.obsHeading}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {observability.map((m) => <ModuleCard key={m.name} {...m} />)}
          </div>
        </div>
      </section>

      {/* ── Install ── */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800/60" style={{ boxShadow: 'var(--ct-shadow-card)' }}>
            <div className="border-b border-slate-100 px-8 py-6 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/40">
                  <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr.installTitle}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{tr.installSub}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-700 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {installSnippets.map(({ label, cmd }) => (
                <div key={label} className="px-8 py-5">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
                  <code className="block rounded-lg bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-300" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{cmd}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-2xl px-8 py-16 text-center" style={{ background: 'linear-gradient(135deg, #1e1b4b, #2e1065)' }}>
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, #4F46E5, #7C3AED)' }} />
            <div className="relative">
              <h2 className="mb-4 text-3xl font-extrabold text-white sm:text-4xl">{tr.ctaHeading}</h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-indigo-200">{tr.ctaSub}</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href={docsHref} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50">
                  {tr.readDocs}<ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="https://github.com/A3S-Lab" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-7 py-3.5 text-sm font-semibold text-indigo-200 transition-all duration-200 hover:border-indigo-300 hover:text-white">
                  <Github className="h-4 w-4" />{tr.starGithub}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 px-4 py-10 dark:border-slate-700/60 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-sm font-bold text-transparent">A3S Lab</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">{tr.footerLicense} {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: 'GitHub', href: 'https://github.com/A3S-Lab' },
              { label: 'crates.io', href: 'https://crates.io/crates/a3s-code-core' },
              { label: 'PyPI', href: 'https://pypi.org/project/a3s-code/' },
              { label: 'npm', href: 'https://www.npmjs.com/package/@a3s-lab/code' },
            ].map(({ label, href }) => (
              <Link key={label} href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 transition-colors hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400">{label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
