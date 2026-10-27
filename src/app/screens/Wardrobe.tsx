import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { sfx } from '../../audio'
import { HATS, SKINS, isUnlocked } from '../../game/cosmetics'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { LockIcon } from '../ui/icons'
import { Panel } from '../ui/Panel'
import { PofikFace } from '../ui/PofikFace'

/** Pick Pofik's color and hat. The game shows the change live behind the panel. */
export function Wardrobe() {
  const t = useT()
  const look = useAppStore((s) => s.look)
  const best = useAppStore((s) => s.best)
  const setLook = useAppStore((s) => s.setLook)
  const close = () => useAppStore.getState().setScreen('title')

  return (
    <Panel title={t('wardrobe.title')} onClose={close}>
      <div className="panel__body">
        <section>
          <h3 className="panel__label">{t('wardrobe.skins')}</h3>
          <div className="tiles">
            {SKINS.map((skin) => (
              <Tile
                key={skin.id}
                name={t(`skin.${skin.id}`)}
                unlockAt={skin.unlockAt}
                locked={!isUnlocked(skin, best)}
                selected={look.skin === skin.id}
                onPick={() => setLook({ ...look, skin: skin.id })}
              >
                <PofikFace skin={skin.id} hat="none" />
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
                unlockAt={hat.unlockAt}
                locked={!isUnlocked(hat, best)}
                selected={look.hat === hat.id}
                onPick={() => setLook({ ...look, hat: hat.id })}
              >
                <PofikFace skin={look.skin} hat={hat.id} />
              </Tile>
            ))}
          </div>
        </section>
        <p className="wardrobe__caption">
          {t(`skin.${look.skin}`)} · {t(`hat.${look.hat}`)}
        </p>
      </div>
    </Panel>
  )
}

interface TileProps {
  name: string
  unlockAt: number
  locked: boolean
  selected: boolean
  onPick: () => void
  children: ReactNode
}

function Tile({ name, unlockAt, locked, selected, onPick, children }: TileProps) {
  const t = useT()
  const label = locked ? t('wardrobe.locked', { name, n: unlockAt }) : name
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
          {unlockAt}
        </span>
      )}
    </m.button>
  )
}
