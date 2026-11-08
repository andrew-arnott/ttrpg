import { TOKENS } from '../data/tokens'
import {
  engagementGroups,
  enemyDefense,
  type BattleEnemy,
  type BattlePlayer,
  type BattleState,
} from '../lib/battle'
import { AVATAR_COLORS } from '../lib/partyColors'
import { EnemyStatCard } from './EnemyStatCard'
import { Portrait } from './Portrait'

function HpBar({ hp, max }: { hp: number; max: number }) {
  return (
    <div className="hp-bar" role="img" aria-label={`${hp} of ${max} HP`}>
      <span className="hp-fill" style={{ width: `${(hp / max) * 100}%` }} />
      <span className="hp-text">
        {hp}/{max}
      </span>
    </div>
  )
}

function PlayerCard({ p, active }: { p: BattlePlayer; active: boolean }) {
  const down = p.hp <= 0
  return (
    <div className={`combatant player${down ? ' down' : ''}${active ? ' active' : ''}`}>
      <span className="party-avatar" style={{ borderColor: AVATAR_COLORS[p.colorIndex % AVATAR_COLORS.length] }}>
        <Portrait kind="profession" id={p.professionId} size="sm" />
      </span>
      <div className="combatant-info">
        <span className="party-name">{p.name}</span>
        <HpBar hp={p.hp} max={p.maxHp} />
        <div className="tokens" style={{ marginTop: 4 }}>
          <span className="chip" title="Defense score this round">
            Defense <span className="count">{p.defense}</span>
          </span>
          {p.shieldsInPlay > 0 && (
            <span className="chip" title={TOKENS.shield.effect}>
              Shield <span className="count">{p.shieldsInPlay}</span>
            </span>
          )}
          {Object.entries(p.resources)
            .filter(([, n]) => n > 0)
            .map(([id, n]) => (
              <span className="chip" key={id} title={TOKENS[id]?.effect}>
                {TOKENS[id]?.name ?? id} <span className="count">{n}</span>
              </span>
            ))}
        </div>
        {down && <span className="tag warn">Down</span>}
      </div>
    </div>
  )
}

function EnemyCard({ e }: { e: BattleEnemy }) {
  const down = e.hp <= 0
  const defense = enemyDefense(e)
  return (
    <div className={`combatant enemy stat-hover${down ? ' down' : ''}`} tabIndex={0}>
      <span className="party-avatar" style={{ borderColor: '#ff6a6a' }}>
        <Portrait kind="enemy" id={e.defId} size="sm" />
      </span>
      <div className="combatant-info">
        <span className="party-name">{e.name}</span>
        <HpBar hp={e.hp} max={e.maxHp} />
        <div className="tokens" style={{ marginTop: 4 }}>
          <span className="chip" title="Players test against this to hit">
            Defense <span className="count">{defense}</span>
            {defense !== e.defense && <span className="mod">({e.defense})</span>}
          </span>
          {e.sealed.map((s, i) => (
            <span className="chip" key={i} title="Sealed on this enemy">
              Sealed {TOKENS[s.as ?? s.tokenId]?.name ?? s.tokenId}
            </span>
          ))}
          {e.provokedBy && <span className="chip">Provoked</span>}
          {e.disabled && <span className="chip">Disabled</span>}
          {e.empowered > 0 && <span className="chip">+{e.empowered} attack</span>}
        </div>
      </div>
      <EnemyStatCard enemy={e} />
    </div>
  )
}

export function BattleBoard({ battle, activeKey }: { battle: BattleState; activeKey: string | null }) {
  const groups = engagementGroups(battle)
  const downPlayers = battle.players.filter((p) => p.hp <= 0)
  const defeated = battle.enemies.filter((e) => e.hp <= 0)

  return (
    <section className="card">
      <div className="card-head">
        <span className="step-index">Round {battle.round}</span>
        <h2>Engagement groups</h2>
        <p className="hint">
          Players and enemies can only attack those in their own group. Enemies attack after everyone has
          acted. Hover an enemy for its stat card.
        </p>
      </div>

      <div className="engagement-groups">
        {groups.map((g, i) => (
          <div className="engagement-group" key={g.id}>
            <span className="step-index">Group {i + 1}</span>
            <div className="engagement-sides">
              <div className="stack">
                {g.players.map((p) => (
                  <PlayerCard key={p.key} p={p} active={p.key === activeKey} />
                ))}
              </div>
              <span className="versus" aria-hidden="true">
                vs
              </span>
              <div className="stack">
                {g.enemies.length === 0 ? (
                  <span className="hint">No enemies</span>
                ) : (
                  g.enemies.map((e) => <EnemyCard key={e.id} e={e} />)
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(downPlayers.length > 0 || defeated.length > 0) && (
        <>
          <h3 className="section-title">Out of the fight</h3>
          <div className="engagement-sides">
            <div className="stack">
              {downPlayers.map((p) => (
                <PlayerCard key={p.key} p={p} active={p.key === activeKey} />
              ))}
            </div>
            <span />
            <div className="stack">
              {defeated.map((e) => (
                <EnemyCard key={e.id} e={e} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
