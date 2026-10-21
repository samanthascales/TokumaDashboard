import { SCORE_VERSION, type ScoreLevel } from '../lib/score';
import { t, useT } from '../i18n';

export const levelName = (l: ScoreLevel) => (l === 'leader' ? t('Circular Leader') : l === 'grower' ? t('Circular Grower') : t('Circular Starter'));
export const levelTone = (l: ScoreLevel) => (l === 'leader' ? 'green' : l === 'grower' ? 'amber' : 'red') as 'green' | 'amber' | 'red';

/** Plain-language explanation of the circularity score, reused wherever the score appears. */
export function ScoreExplainer() {
  useT();
  return (
    <>
      <p>{t('Your circularity score shows how circular your business is, from 0 to 100. A circular business keeps materials in use for as long as possible, instead of “take, make, throw away”.')}</p>
      <p>{t('Tokuma treats it as seriously as profit: profit shows how your business is doing with money, the score shows how it is doing for the planet.')}</p>
      <p>{t('It is built from five pillars based on published research: circular inflow, circular outflow, product life & use, resource productivity and circular business model.')}</p>
      <p className="text-gray-300">{t('Method: {version}. A few details are still being confirmed with experts, so it may change.', { version: SCORE_VERSION })}</p>
    </>
  );
}
