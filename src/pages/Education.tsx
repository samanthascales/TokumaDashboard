import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { BookOpen, CheckCircle2, Clock, PlayCircle, Search } from 'lucide-react';
import { useSimulatedLoad } from '../lib/hooks';
import { Badge, Card, CardSkeleton, EmptyState, Modal, PageHeader, Segmented } from '../components/ui';
import { tk, useT } from '../i18n';

interface Course {
  id: number;
  title: string;
  cat: string;
  kind: string;
  mins: number;
  progress: number;
  desc: string;
  /** The lesson itself, in short steps. Lessons without points are still being written. */
  points?: string[];
  /** Where in Tokuma to try what the lesson teaches. */
  link?: { to: string; label: string };
}

const COURSES: Course[] = [
  {
    id: 9, title: tk('Understanding your circularity score'), cat: tk('Circularity'), kind: tk('Guide'), mins: 5, progress: 0,
    desc: tk('What the score means, what goes into it, and the quickest ways to raise it.'),
    points: [
      tk('Your circularity score runs from 0 to 100. It shows how well your business keeps materials in use instead of throwing them away.'),
      tk('It has five equal parts: the materials you use (circular inflow), what happens to your waste and old products (circular outflow), how long your products last, how much you earn per kilogram of new material, and how much money comes from repairs, resale and rental.'),
      tk('The parts are combined so that a weak part pulls the score down. Being strong in one area cannot hide doing nothing in another.'),
      tk('Look at it like profit: check it every month and set a goal. A score of 40 makes you a Circular Grower, 70 a Circular Leader.'),
      tk('The method is based on published research and standards (ISO 59020, Ellen MacArthur Foundation, WBCSD). A few details are still being confirmed.'),
    ],

    link: { to: '/app/circularity', label: tk('See your score') },
  },
  {
    id: 1, title: tk('Circular economy fundamentals'), cat: tk('Circularity'), kind: tk('Course'), mins: 6, progress: 0,
    desc: tk('Why “take, make, throw away” wastes money, and how circular businesses keep materials in use.'),
    points: [
      tk('Most businesses work in a straight line: take materials, make a product, sell it, and it gets thrown away.'),
      tk('A circular business keeps products and materials in use for longer: it uses recycled or reused materials, repairs products, resells them, rents them out or takes them back.'),
      tk('This is good for the planet, and it can save money: reused materials can cost less, and repairs and resale bring in extra income.'),
      tk('You do not have to change everything at once. Start with one product or one material.'),
    ],
    link: { to: '/app/circularity', label: tk('See your score') },
  },
  {
    id: 10, title: tk('Reading your profit & loss'), cat: tk('Money basics'), kind: tk('Guide'), mins: 4, progress: 0,
    desc: tk('Money in, money out, and what is left: the report that shows whether you made money.'),
    points: [
      tk('Money in is what customers paid you. Money out is what you paid to run the business.'),
      tk('Profit = money in − money out. If the result is below zero, it is a loss.'),
      tk('Loans and grants are not profit: a loan must be paid back, and a grant usually happens only once.'),
      tk('Profit margin tells you how much of each dollar you keep. If it is low, look at your prices and your biggest costs.'),
    ],
    link: { to: '/app/reports', label: tk('Open your profit & loss') },
  },
  {
    id: 11, title: tk('Your balance sheet in plain words'), cat: tk('Money basics'), kind: tk('Guide'), mins: 4, progress: 0,
    desc: tk('What you own, what you owe, and what is yours.'),
    points: [
      tk('What you own (assets): your cash, the stock you have to sell, and equipment like machines or a van.'),
      tk('What you owe (liabilities): loans, unpaid bills and credit card balances.'),
      tk('What you own − what you owe = what is yours (owner’s equity). Growing this number over time means your business is getting stronger.'),
      tk('Banks often ask for a balance sheet before they give a loan.'),
    ],
    link: { to: '/app/reports?tab=balance', label: tk('Open your balance sheet') },
  },
  {
    id: 12, title: tk('Cash flow: why profit is not the same as cash'), cat: tk('Money basics'), kind: tk('Guide'), mins: 4, progress: 0,
    desc: tk('How a business can make money on paper and still run short of cash.'),
    points: [
      tk('Cash flow is when money actually arrives and leaves your bank account.'),
      tk('You can make a profit and still run short of cash, for example after buying a lot of stock before a busy season.'),
      tk('Try to keep enough cash to cover at least 3 months of normal spending.'),
      tk('If cash is tight, collect money owed to you sooner and spread out big purchases.'),
    ],
    link: { to: '/app/reports?tab=cash', label: tk('Open your cash flow') },
  },
  {
    id: 13, title: tk('Finding your break-even point'), cat: tk('Money basics'), kind: tk('Guide'), mins: 3, progress: 0,
    desc: tk('How many items you need to sell each month to cover your costs.'),
    points: [
      tk('Regular costs (rent, wages, marketing) have to be paid every month, whatever you sell.'),
      tk('Each item you sell brings in its profit per item: the price minus what it cost you.'),
      tk('Break-even = regular costs ÷ profit per item. Sell more than that and you make a profit.'),
      tk('Raising your price a little or lowering your cost can lower your break-even point a lot.'),
    ],
    link: { to: '/app/reports?tab=breakeven', label: tk('Try the calculator') },
  },
  { id: 3, title: tk('Designing for disassembly'), cat: tk('Design'), kind: tk('Course'), mins: 40, progress: 0, desc: tk('Mono-materials, reversible fasteners and labelling that make recycling possible.') },
  { id: 4, title: tk('Running a take-back programme'), cat: tk('Operations'), kind: tk('Playbook'), mins: 18, progress: 0, desc: tk('Logistics, incentives and resale economics for collecting used products.') },
  { id: 5, title: tk('Choosing reliable circular suppliers'), cat: tk('Supply chain'), kind: tk('Guide'), mins: 15, progress: 0, desc: tk('Certifications that matter (GRS, GOTS, C2C) and how lead time affects your stock.') },
  { id: 6, title: tk('Pitching circularity to lenders'), cat: tk('Funding'), kind: tk('Video'), mins: 9, progress: 0, desc: tk('Turn verified impact data into better loan terms and grant applications.') },
];

export default function Education() {
  const t = useT();
  const navigate = useNavigate();
  const ready = useSimulatedLoad('education');
  const [openId, setOpenId] = useState<number | null>(null);
  const lesson = COURSES.find((c) => c.id === openId) ?? null;
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const cats = ['All', ...new Set(COURSES.map((c) => c.cat))];
  const list = COURSES.filter((c) => (cat === 'All' || c.cat === cat) && `${c.title} ${t(c.title)}`.toLowerCase().includes(q.toLowerCase()));
  const inProgress = COURSES.find((c) => c.progress > 0 && c.progress < 100);

  return (
    <>
      <PageHeader title={t('Learn')} sub={t('Short lessons on running a business and making it circular. No business background needed.')} />
      {inProgress && (
        <Card className="mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <PlayCircle className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="muted text-xs">{t('Continue where you left off')}</p>
            <p className="font-semibold">{t(inProgress.title)}</p>
            <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
              <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${inProgress.progress}%` }} />
            </div>
          </div>
          <button className="btn-primary">{t('Resume')}</button>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input ps-9" placeholder={t('Search lessons')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: t(c) }))} />
      </div>
      {!ready ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} className="h-[220px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title={t('No lessons found')} body={t('Try another search or category.')} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((c) => (
            <Card key={c.id} hover className="group flex cursor-pointer flex-col overflow-hidden transition hover:-translate-y-0.5" onClick={() => setOpenId(c.id)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenId(c.id)}>
              <div className="relative h-24 bg-gradient-to-br from-brand-600/90 to-brand-900">
                <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 200 96" preserveAspectRatio="none" aria-hidden>
                  <circle cx={30 + c.id * 18} cy="20" r="40" fill="white" />
                  <circle cx={170 - c.id * 9} cy="90" r="30" fill="white" />
                </svg>
                <span className="absolute start-4 top-4">
                  <Badge className="bg-white/15 text-white ring-white/20">{t(c.kind)}</Badge>
                </span>
                {c.progress === 100 && <CheckCircle2 className="absolute end-4 top-4 h-5 w-5 text-white" />}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">{t(c.cat)}</p>
                <p className="mt-1 font-semibold leading-snug">{t(c.title)}</p>
                <p className="muted mt-1 flex-1 text-sm">{t(c.desc)}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="muted flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {t('{n} min', { n: c.mins })}
                  </span>
                  <span className={clsx('font-medium', c.points ? 'text-brand-700 dark:text-brand-400' : 'text-gray-500')}>{c.points ? t('Start') : t('Coming soon')}</span>
                </div>
                {c.progress > 0 && c.progress < 100 && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                    <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${c.progress}%` }} />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={!!lesson}
        onClose={() => setOpenId(null)}
        title={lesson ? t(lesson.title) : ''}
        sub={lesson ? `${t(lesson.cat)} · ${t('{n} min', { n: lesson.mins })}` : undefined}
        footer={
          lesson?.link ? (
            <>
              <button className="btn-secondary" onClick={() => setOpenId(null)}>
                {t('Close')}
              </button>
              <button className="btn-primary" onClick={() => navigate(lesson.link!.to)}>
                {t(lesson.link.label)}
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => setOpenId(null)}>
              {t('Close')}
            </button>
          )
        }
      >
        {lesson?.points ? (
          <ol className="space-y-3">
            {lesson.points.map((p, i) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{i + 1}</span>
                <span>{t(p)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted text-sm">{t('This lesson is still being written. Check back soon.')}</p>
        )}
      </Modal>
    </>
  );
}
