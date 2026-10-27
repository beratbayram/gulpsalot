import type { ReactNode } from 'react'
import type { PreyKind } from '../../game/rules'
import type { StingSource } from '../../game/progress'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { Panel } from '../ui/Panel'

const PREY: PreyKind[] = ['fly', 'golden', 'dragonfly', 'firefly', 'moth', 'beetle', 'ladybug']
const STINGS: StingSource[] = ['bee', 'wasp', 'spider', 'heron']

/** Lifetime records: insects per kind, ouches, time played and bests. */
export function Stats() {
  const t = useT()
  const stats = useAppStore((s) => s.stats)
  const best = useAppStore((s) => s.best)
  const modeBest = useAppStore((s) => s.modeBest)
  const close = () => useAppStore.getState().setScreen('title')
  const minutes = Math.floor(stats.playSeconds / 60)

  return (
    <Panel title={t('stats.title')} onClose={close}>
      <div className="panel__scroll stats">
        <StatGroup title={t('stats.overview')}>
          <Row label={t('stats.runs')} value={stats.runs} />
          <Row label={t('stats.time')} value={t('stats.minutes', { n: minutes })} />
          <Row label={t('stats.best')} value={best} />
          <Row label={t('mode.rush.name')} value={modeBest.rush} />
          <Row label={t('mode.sharp.name')} value={modeBest.sharp} />
          <Row label={t('stats.bestCombo')} value={`x${Math.max(1, stats.bestCombo)}`} />
          <Row label={t('stats.missions')} value={stats.missions} />
        </StatGroup>
        <StatGroup title={t('stats.caught')}>
          {PREY.map((kind) => (
            <Row key={kind} label={t(`insect.${kind}`)} value={stats.caught[kind]} />
          ))}
          <Row label={t('stats.bullseyes')} value={stats.bullseyes} />
          <Row label={t('stats.sets')} value={stats.sets} />
          <Row label={t('stats.burps')} value={stats.burps} />
        </StatGroup>
        <StatGroup title={t('stats.ouches')}>
          {STINGS.map((by) => (
            <Row key={by} label={t(`sting.${by}`)} value={stats.stings[by]} />
          ))}
          <Row label={t('stats.boops')} value={stats.boops} />
        </StatGroup>
      </div>
    </Panel>
  )
}

function StatGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stats__group">
      <h3 className="panel__label">{title}</h3>
      <dl>{children}</dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stats__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
