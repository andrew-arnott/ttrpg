import { ENEMIES_BY_ID } from '../data/enemies'
import { enemyDefense, type BattleEnemy } from '../lib/battle'
import { Portrait } from './Portrait'

/** Everything about an enemy at a glance, shown when its icon is hovered or focused. */
export function EnemyStatCard({ enemy }: { enemy: BattleEnemy }) {
  const def = ENEMIES_BY_ID[enemy.defId]
  if (!def) return null
  const defense = enemyDefense(enemy)
  const statuses = [
    ...enemy.sealed.map((s) => `Sealed ${s.tokenId}`),
    enemy.provokedBy ? 'Provoked' : '',
    enemy.disabled ? 'Disabled' : '',
    enemy.empowered > 0 ? `+${enemy.empowered} attack this round` : '',
  ].filter(Boolean)

  return (
    <div className="statcard" role="tooltip">
      <div className="statcard-head">
        <Portrait kind="enemy" id={enemy.defId} size="md" />
        <div>
          <strong className="party-name">{enemy.name}</strong>
          <p className="hint">{def.blurb}</p>
        </div>
      </div>

      <dl className="statcard-stats">
        <div>
          <dt>HP</dt>
          <dd>
            {enemy.hp}/{enemy.maxHp}
          </dd>
        </div>
        <div>
          <dt>Defense</dt>
          <dd>
            {defense}
            {defense !== enemy.defense && <small> (base {enemy.defense})</small>}
          </dd>
        </div>
      </dl>

      <h4 className="statcard-title">Attacks, after the players act</h4>
      <ul className="statcard-list">
        {def.attacks.map((a) => (
          <li key={a.name}>
            <b>{a.name}</b>: attack {a.attackValue}, {a.damage} damage
            {a.area && ', hits everyone in the room'}
          </li>
        ))}
      </ul>

      {def.triggers.length > 0 && (
        <>
          <h4 className="statcard-title">Triggered</h4>
          <ul className="statcard-list">
            {def.triggers.map((t) => (
              <li key={t.name}>
                <b>{t.name}</b>: {t.text}
              </li>
            ))}
          </ul>
        </>
      )}

      {statuses.length > 0 && (
        <div className="tokens" style={{ marginTop: 8 }}>
          {statuses.map((s) => (
            <span className="chip" key={s}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
