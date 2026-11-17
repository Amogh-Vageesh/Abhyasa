// Home "hub" tiles — one place for everything beyond the daily routine (no duplicates in More).
import { Icon, Tile } from './icons';
import { rupees } from './components';
import { sportStats } from './Sports';
import { weekOf } from './Explore';
import { addDays, ymd } from './lib/logic';
import { levelInfo } from './lib/xp';

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m || 0}m`);

export function HomeShortcuts({ F, go, moneyLabel, balance, openMistakes, due, onRevise }) {
  const sp = sportStats(F.sports || [], addDays(ymd(), -6));
  const wk = weekOf(F);
  const medals = (F.achievements || []).length;
  let lv = null; try { lv = levelInfo(F); } catch {}
  const tiles = [
    ['sports', 'trophy', 'green', 'Sports', sp.minutes ? `${fmtMin(sp.minutes)} this week` : 'Log a class', () => go('sports')],
    ['achv', 'gift', 'amber', 'Achieve\u00adments', medals ? `${medals} so far` : 'Add your first', () => go('sports', 'achievements')],
    ['explore', 'bulb', 'purple', 'Explore', wk ? `Week ${wk} of 12` : 'Beyond school', () => go('explore')],
    ['money', 'rupee', 'teal', 'My money', moneyLabel, () => go('finance')],
    ['rewards', 'wallet', 'amber', 'Rewards', rupees(balance), () => go('wallet')],
    ['fixit', 'mistake', 'red', 'Fix-its', `${openMistakes} open`, () => go('mistakes')],
    ['revise', 'repeat', 'blue', 'Revision', `${due} due`, onRevise],
    ['badges', 'target', 'pink', 'Badges', lv ? `Level ${lv.level}` : 'Level up', () => go('badges')]
  ];
  return (
    <div className="hub">
      {tiles.map(([k, icon, tone, label, sub, fn]) => (
        <button key={k} className="hub-tile" onClick={fn}>
          <Tile icon={icon} tone={tone} />
          <b>{label}</b>
          <small>{sub}</small>
        </button>
      ))}
    </div>
  );
}
