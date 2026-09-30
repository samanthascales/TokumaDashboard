import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useCloud } from '../../store/CloudProvider';
import { t as tr, useT } from '../../i18n';
import { Avatar, Field, Modal } from '../ui';

const PHOTO_SIZE = 256;

/** Center-crops an image file to a square and shrinks it to a small JPEG, so it fits in the saved profile. */
export async function resizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(tr('Choose an image file (JPG, PNG, WebP…).'));
  if (file.size > 15 * 1024 * 1024) throw new Error(tr('That image is too large. Choose one under 15 MB.'));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(tr('Couldn’t read that image.')));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; // transparent PNGs get a white background instead of black
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Draft = { ownerName: string; role: string; email: string; phone: string; avatar: string };

/** The person's own profile: photo, name, job title and contact details. */
export function ProfileEditor({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const t = useT();
  const { profile, setProfile } = useStore();
  const cloud = useCloud();
  const navigate = useNavigate();
  const pick = (): Draft => ({ ownerName: profile.ownerName, role: profile.role, email: profile.email, phone: profile.phone, avatar: profile.avatar });
  const [d, setD] = useState<Draft>(pick);
  const [touched, setTouched] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Start from the latest saved profile (e.g. after it loads from the account).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setD(pick()), [profile]);

  const errors = {
    ownerName: d.ownerName.trim().length < 2 ? t('Enter your full name') : null,
    email: d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) ? t('Enter a valid email address') : null,
    phone: d.phone.trim() && !/^[+\d][\d\s().-]{5,}$/.test(d.phone.trim()) ? t('Enter a valid phone number') : null,
  };
  const valid = !errors.ownerName && !errors.email && !errors.phone;
  const saved = pick();
  const dirty = (Object.keys(d) as (keyof Draft)[]).some((k) => d[k] !== saved[k]);
  const set = (k: keyof Draft, v: string) => setD((x) => ({ ...x, [k]: v }));

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError(null);
    setBusy(true);
    try {
      set('avatar', await resizePhoto(file));
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = () => {
    setTouched(true);
    if (!valid) return;
    setProfile({ ...profile, ownerName: d.ownerName.trim(), role: d.role.trim(), email: d.email.trim(), phone: d.phone.trim(), avatar: d.avatar }, t('Profile saved'));
    onDone?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="group relative rounded-full" onClick={() => fileRef.current?.click()} aria-label={t('Change photo')}>
          <Avatar name={d.ownerName || '?'} src={d.avatar} className="h-20 w-20 text-2xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          </span>
        </button>
        <div>
          <p className="text-sm font-medium">{t('Profile photo')}</p>
          <p className="muted text-xs">{t('JPG, PNG or WebP. It’s cropped to a square.')}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Camera className="h-3.5 w-3.5" /> {d.avatar ? t('Change photo') : t('Upload photo')}
            </button>
            {d.avatar && (
              <button type="button" className="btn-ghost btn-sm text-red-600 dark:text-red-400" onClick={() => set('avatar', '')}>
                <Trash2 className="h-3.5 w-3.5" /> {t('Remove')}
              </button>
            )}
          </div>
          {photoError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{photoError}</p>}
        </div>
        <input id="profile-photo" ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Full name')} error={touched ? errors.ownerName : null} className="sm:col-span-2">
          <input id="profile-name" className={clsx('input', touched && errors.ownerName && 'input-error')} value={d.ownerName} onChange={(e) => set('ownerName', e.target.value)} autoComplete="name" placeholder={t('Jane Doe')} />
        </Field>
        <Field label={t('Job title')}>
          <input id="profile-role" className="input" value={d.role} onChange={(e) => set('role', e.target.value)} placeholder={t('Founder & CEO')} />
        </Field>
        <Field label={t('Phone')} error={touched ? errors.phone : null} hint={t('Optional')}>
          <input id="profile-phone" type="tel" className={clsx('input', touched && errors.phone && 'input-error')} value={d.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" placeholder="+51 987 654 321" />
        </Field>
        <Field label={t('Contact email')} error={touched ? errors.email : null} hint={t('Shown to investors and partners')} className="sm:col-span-2">
          <input id="profile-email" type="email" className={clsx('input', touched && errors.email && 'input-error')} value={d.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder={t('you@company.com')} />
        </Field>
      </div>

      {cloud.user?.email && (
        <p className="muted rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/[0.03]">
          {t('You sign in with {email}.', { email: cloud.user.email })}{' '}
          <button
            type="button"
            className="font-medium text-brand-700 hover:underline dark:text-brand-400"
            onClick={() => {
              onCancel?.();
              navigate('/app/settings?section=account');
            }}
          >
            {t('Password and privacy settings')}
          </button>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
        <button
          type="button"
          className="btn-ghost me-auto"
          onClick={() => {
            onCancel?.();
            navigate('/app/settings?section=profile');
          }}
        >
          {t('Edit business profile')}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('Cancel')}
          </button>
        )}
        <button type="button" className="btn-primary" disabled={!dirty || busy} onClick={save}>
          {t('Save profile')}
        </button>
      </div>
    </div>
  );
}

/** Opened from the name menu in the top bar (see `openProfile`). */
export function ProfileModal() {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('tokuma:profile', h);
    return () => window.removeEventListener('tokuma:profile', h);
  }, []);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t('Your profile')} sub={t('How you appear in Tokuma and to investors')}>
      {open && <ProfileEditor onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />}
    </Modal>
  );
}
