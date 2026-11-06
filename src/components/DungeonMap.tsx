import { artUrl } from '../lib/art'
import type { DungeonRoom } from '../data/dungeon'
import {
  adjacentRoomIds,
  roomById,
  roomCenter,
  visibleRoomIds,
  type DungeonState,
  type PartyMember,
} from '../lib/dungeonState'
import { AVATAR_COLORS } from '../lib/partyColors'
import { torchLevel, type TorchLevel } from '../lib/torch'

const CORRIDOR_WIDTH = 30
const AVATAR_RADIUS = 22
const AVATAR_SPACING = 52
const ROW_SPACING = 50
const LABEL_CHAR_WIDTH = 10.5
const LABEL_LINE_HEIGHT = 24

const GLOW_RADIUS: Record<TorchLevel, number> = { bright: 340, steady: 250, dim: 170, out: 0 }

function wrapLabel(name: string, maxChars: number): string[] {
  const lines: string[] = []
  for (const word of name.split(' ')) {
    const last = lines[lines.length - 1]
    if (last !== undefined && last.length + 1 + word.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

function avatarPositions(room: DungeonRoom, count: number, labelLines: number) {
  const perRow = Math.max(1, Math.floor((room.w - 16) / AVATAR_SPACING))
  const rows = Math.ceil(count / perRow)
  const top = room.y + 14 + labelLines * LABEL_LINE_HEIGHT
  const bottom = room.y + room.h - 10
  const blockHeight = rows * ROW_SPACING
  const startY = top + Math.max(0, (bottom - top - blockHeight) / 2) + ROW_SPACING / 2
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, count - row * perRow)
    const col = i % perRow
    const rowWidth = (inRow - 1) * AVATAR_SPACING
    return {
      x: room.x + room.w / 2 - rowWidth / 2 + col * AVATAR_SPACING,
      y: startY + row * ROW_SPACING,
    }
  })
}

function Avatar({ member, index, x, y }: { member: PartyMember; index: number; x: number; y: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const src = artUrl('profession', member.professionId)
  const clipId = `avatar-clip-${index}`
  return (
    <g className="avatar" transform={`translate(${x} ${y})`}>
      <title>{member.name}</title>
      <clipPath id={clipId}>
        <circle r={AVATAR_RADIUS} />
      </clipPath>
      <circle r={AVATAR_RADIUS + 3} fill="#000" />
      {src && (
        <image
          href={src}
          x={-AVATAR_RADIUS}
          y={-AVATAR_RADIUS}
          width={AVATAR_RADIUS * 2}
          height={AVATAR_RADIUS * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      <circle r={AVATAR_RADIUS} fill="none" stroke={color} strokeWidth={4} />
      <circle cx={AVATAR_RADIUS - 2} cy={AVATAR_RADIUS - 2} r={9} fill={color} stroke="#000" strokeWidth={2} />
      <text x={AVATAR_RADIUS - 2} y={AVATAR_RADIUS + 2} className="avatar-index">
        {index + 1}
      </text>
    </g>
  )
}

interface Props {
  state: DungeonState
  onMove: (roomId: string) => void
}

export function DungeonMap({ state, onMove }: Props) {
  const { dungeon, party, roomId, explored, torch } = state
  const level = torchLevel(torch)
  const lit = new Set(visibleRoomIds(dungeon, roomId, level))
  const known = new Set([...explored, ...lit])
  const exits = new Set(adjacentRoomIds(dungeon, roomId))
  const origin = roomCenter(roomById(dungeon, roomId))
  const glowRadius = GLOW_RADIUS[level]

  return (
    <svg
      className="dungeon-map"
      viewBox={`0 0 ${dungeon.width} ${dungeon.height}`}
      role="group"
      aria-label={`Map of ${dungeon.name}. The party is in ${roomById(dungeon, roomId).name}.`}
    >
      <defs>
        <pattern id="floor" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#1b2468" />
          <path d="M0 0H32V32H0Z" fill="none" stroke="#141c55" strokeWidth="2" />
          <rect x="2" y="2" width="3" height="3" fill="#2a3590" />
          <rect x="18" y="20" width="3" height="3" fill="#2a3590" />
        </pattern>
        <radialGradient id="torch-glow">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ff9a3c" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ff7a1c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={dungeon.width} height={dungeon.height} fill="#02030f" />

      {dungeon.links.map((link) => {
        const a = roomCenter(roomById(dungeon, link.from))
        const b = roomCenter(roomById(dungeon, link.to))
        const seen = known.has(link.from) || known.has(link.to)
        if (!seen) return null
        const opacity = lit.has(link.from) || lit.has(link.to) ? 1 : 0.4
        return (
          <g key={`${link.from}-${link.to}`} opacity={opacity}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#000" strokeWidth={CORRIDOR_WIDTH + 8} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9fb0f5" strokeWidth={CORRIDOR_WIDTH + 2} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1b2468" strokeWidth={CORRIDOR_WIDTH - 4} />
          </g>
        )
      })}

      {dungeon.rooms.map((room) => {
        if (!known.has(room.id)) return null
        const current = room.id === roomId
        const reachable = exits.has(room.id)
        const labelLines = wrapLabel(room.name, Math.floor((room.w - 16) / LABEL_CHAR_WIDTH))
        const move = () => reachable && onMove(room.id)
        return (
          <g
            key={room.id}
            opacity={lit.has(room.id) ? 1 : 0.45}
            className={`room${current ? ' current' : ''}${reachable ? ' reachable' : ''}`}
            role={reachable ? 'button' : undefined}
            tabIndex={reachable ? 0 : undefined}
            aria-label={reachable ? `Move the party to ${room.name}` : undefined}
            onClick={move}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                move()
              }
            }}
          >
            <rect x={room.x - 4} y={room.y - 4} width={room.w + 8} height={room.h + 8} fill="#000" />
            <rect
              className="room-wall"
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              fill="url(#floor)"
              strokeWidth={5}
            />
            {labelLines.map((line, i) => (
              <text
                key={i}
                className="room-label"
                x={room.x + room.w / 2}
                y={room.y + 26 + i * LABEL_LINE_HEIGHT}
              >
                {line}
              </text>
            ))}
            {current &&
              party.map((member, i) => {
                const spot = avatarPositions(room, party.length, labelLines.length)[i]
                return <Avatar key={member.key} member={member} index={i} x={spot.x} y={spot.y} />
              })}
          </g>
        )
      })}

      {glowRadius > 0 && (
        <circle
          className="torch-glow"
          cx={origin.x}
          cy={origin.y}
          r={glowRadius}
          fill="url(#torch-glow)"
          pointerEvents="none"
        />
      )}

      {level === 'out' && (
        <g pointerEvents="none">
          <rect width={dungeon.width} height={dungeon.height} fill="#000" opacity={0.35} />
          <text x={dungeon.width / 2} y={dungeon.height - 18} className="dark-notice">
            The torch is out. You can barely see.
          </text>
        </g>
      )}
    </svg>
  )
}
