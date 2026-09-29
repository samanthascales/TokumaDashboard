import { useState } from 'react';
import clsx from 'clsx';
import { BookOpen, CheckCircle2, Clock, PlayCircle, Search } from 'lucide-react';
import { useSimulatedLoad } from '../lib/hooks';
import { Badge, Card, CardSkeleton, EmptyState, PageHeader, Segmented } from '../components/ui';

const COURSES = [
  { id: 1, title: 'Circular economy fundamentals', cat: 'Basics', kind: 'Course', mins: 25, progress: 100, desc: 'The butterfly diagram, material loops and why “take-make-waste” is a cost centre.' },
  { id: 2, title: 'Measuring your circularity rate', cat: 'Metrics', kind: 'Guide', mins: 12, progress: 60, desc: 'How Tokuma calculates circularity from sales and bills of materials — and how to improve it.' },
  { id: 3, title: 'Designing for disassembly', cat: 'Design', kind: 'Course', mins: 40, progress: 0, desc: 'Mono-materials, reversible fasteners and labelling that make recycling possible.' },
  { id: 4, title: 'Running a take-back programme', cat: 'Operations', kind: 'Playbook', mins: 18, progress: 20, desc: 'Logistics, incentives and resale economics for collecting used products.' },
  { id: 5, title: 'Choosing reliable circular suppliers', cat: 'Supply chain', kind: 'Guide', mins: 15, progress: 0, desc: 'Certifications that matter (GRS, GOTS, C2C) and how lead time affects your stock.' },
  { id: 6, title: 'Pitching circularity to lenders', cat: 'Funding', kind: 'Video', mins: 9, progress: 0, desc: 'Turn verified impact data into better loan terms and grant applications.' },
  { id: 7, title: 'Inventory planning for seasonal peaks', cat: 'Operations', kind: 'Guide', mins: 14, progress: 0, desc: 'Reorder points, safety stock and planning ahead of holiday demand.' },
  { id: 8, title: 'Carbon accounting for logistics', cat: 'Supply chain', kind: 'Course', mins: 30, progress: 0, desc: 'Transport emission factors and how mode shifts reduce your footprint.' },
];

export default function Education() {
  const ready = useSimulatedLoad('education');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const cats = ['All', ...new Set(COURSES.map((c) => c.cat))];
  const list = COURSES.filter((c) => (cat === 'All' || c.cat === cat) && c.title.toLowerCase().includes(q.toLowerCase()));
  const done = COURSES.filter((c) => c.progress === 100).length;
  const inProgress = COURSES.find((c) => c.progress > 0 && c.progress < 100);

  return (
    <>
      <PageHeader title="Education hub" sub={`${done} of ${COURSES.length} completed · learn the practices behind your metrics`} />
      {inProgress && (
        <Card className="mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <PlayCircle className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="muted text-xs">Continue where you left off</p>
            <p className="font-semibold">{inProgress.title}</p>
            <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
              <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${inProgress.progress}%` }} />
            </div>
          </div>
          <button className="btn-primary">Resume</button>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search lessons" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c }))} />
      </div>
      {!ready ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} className="h-[220px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No lessons found" body="Try another search or category." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((c) => (
            <Card key={c.id} hover className="group flex cursor-pointer flex-col overflow-hidden transition hover:-translate-y-0.5">
              <div className="relative h-24 bg-gradient-to-br from-brand-600/90 to-brand-900">
                <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 200 96" preserveAspectRatio="none" aria-hidden>
                  <circle cx={30 + c.id * 18} cy="20" r="40" fill="white" />
                  <circle cx={170 - c.id * 9} cy="90" r="30" fill="white" />
                </svg>
                <span className="absolute left-4 top-4">
                  <Badge className="bg-white/15 text-white ring-white/20">{c.kind}</Badge>
                </span>
                {c.progress === 100 && <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-white" />}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">{c.cat}</p>
                <p className="mt-1 font-semibold leading-snug">{c.title}</p>
                <p className="muted mt-1 flex-1 text-sm">{c.desc}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="muted flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {c.mins} min
                  </span>
                  <span className={clsx('font-medium', c.progress === 100 ? 'text-brand-700 dark:text-brand-400' : 'text-gray-500')}>{c.progress === 100 ? 'Completed' : c.progress ? `${c.progress}%` : 'Start'}</span>
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
    </>
  );
}
