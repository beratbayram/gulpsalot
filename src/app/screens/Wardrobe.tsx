import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { sfx } from '../../audio'
import {
  DECOR,
  HATS,
  SKINS,
  isDecorUnlocked,
  isUnlocked,
  secretOf,
  type SecretId,
} from '../../game/cosmetics'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { DECOR_ART } from '../ui/decorArt'
import { LockIcon } from '../ui/icons'
import { Panel } from '../ui/Panel'
import { GulpsalotFace } from '../ui/GulpsalotFace'

/** Pick Gulpsalot's color and hat, and dress up the pond. The game shows changes live. */
export function Wardrobe() {
  const t = useT()
  const look = useAppStore((s) => s.look)
  const best = useAppStore((s) => s.best)
  const secrets = useAppStore((s) => s.secrets)
  const decor = useAppStore((s) => s.decor)
  const missionsDone = useAppStore((s) => s.stats.missions)
  const setLook = useAppStore((s) => s.setLook)
  const setDecor = useAppStore((s) => s.setDecor)
  const close = () => useAppStore.getState().setScreen('title')

  return (
    <Panel title={t('wardrobe.title')} onClose={close}>
      <div className="panel__body panel__scroll">
        <section>
          <h3 className="panel__label">{t('wardrobe.skins')}</h3>
          <div className="tiles">
            {SKINS.map((skin) => (
              <Tile
                key={skin.id}
                name={t(`skin.${skin.id}`)}
                lockLabel={lockLabel(t, t(`skin.${skin.id}`), skin.unlockAt, secretOf(skin))}
                badge={secretOf(skin) ? '?' : skin.unlockAt}
                locked={!isUnlocked(skin, best, secrets)}
                selected={look.skin === skin.id}
                onPick={() => setLook({ ...look, skin: skin.id })}
              >
                <GulpsalotFace skin={skin.id} hat="none" />
              </Tile>
            ))}
          </div>
        </section>
        <section>
          <h3 className="panel__label">{t('wardrobe.hats')}</h3>
          <div className="tiles">
            {HATS.map((hat) => (
              <Tile
                key={hat.id}
                name={t(`hat.${hat.id}`)}
                lockLabel={lockLabel(t, t(`hat.${hat.id}`), hat.unlockAt, secretOf(hat))}
                badge={secretOf(hat) ? '?' : hat.unlockAt}
                locked={!isUnlocked(hat, best, secrets)}
                selected={look.hat === hat.id}
                onPick={() => setLook({ ...look, hat: hat.id })}
              >
                <GulpsalotFace skin={look.skin} hat={hat.id} />
              </Tile>
            ))}
          </div>
        </section>
        <section>
          <h3 className="panel__label">{t('wardrobe.pond')}</h3>
          <div className="tiles">
            {DECOR.map((item) => {
              const Art = DECOR_ART[item.id]
              const name = t(`decor.${item.id}`)
              const on = decor.includes(item.id)
              return (
                <Tile
                  key={item.id}
                  name={name}
                  lockLabel={t('wardrobe.decorLocked', { name, n: item.missions })}
                  badge={item.missions}
                  locked={!isDecorUnlocked(item, missionsDone)}
                  selected={on}
                  onPick={() =>
                    setDecor(on ? decor.filter((d) => d !== item.id) : [...decor, item.id])
                  }
                >
                  <Art />
                </Tile>
              )
            })}
          </div>
        </section>
        <p className="wardrobe__caption">
          {t(`skin.${look.skin}`)} · {t(`hat.${look.hat}`)}
        </p>
      </div>
    </Panel>
  )
}

function lockLabel(
  t: ReturnType<typeof useT>,
  name: string,
  unlockAt: number,
  secret: SecretId | null,
) {
  return secret
    ? t('wardrobe.secret', { hint: t(`secret.${secret}`) })
    : t('wardrobe.locked', { name, n: unlockAt })
}

interface TileProps {
  name: string
  lockLabel: string
  badge: ReactNode
  locked: boolean
  selected: boolean
  onPick: () => void
  children: ReactNode
}

function Tile({ name, lockLabel, badge, locked, selected, onPick, children }: TileProps) {
  const label = locked ? lockLabel : name
  return (
    <m.button
      type="button"
      className="tile"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      disabled={locked}
      whileTap={locked ? undefined : { scale: 0.9, y: 2 }}
      onPointerDown={() => {
        if (locked) return
        sfx.uiTap()
        haptics.tap()
      }}
      onClick={onPick}
    >
      <span className="tile__art">{children}</span>
      {locked && (
        <span className="tile__lock">
          <LockIcon />
          {badge}
        </span>
      )}
    </m.button>
  )
}
